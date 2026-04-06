import json
import boto3
import time
from typing import Dict, Optional
from services.prompt_templates import build_prompt_by_context
from services.categories_templates import build_categories_prompt
from services.Evaluation_templates import build_evaluation_prompt

# AWS Bedrock runtime client
bedrock_client = boto3.client('bedrock-runtime', region_name='ap-south-1')

# Model mapping
MODEL_IDS = {
    "nova-lite": "apac.amazon.nova-lite-v1:0",
    "nova-pro": "apac.amazon.nova-pro-v1:0",
    "claude-sonnet3.5": "apac.anthropic.claude-3-5-sonnet-20240620-v1:0",
    "claude-sonnet3.5v2": "apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
    "claude-haiku3": "apac.anthropic.claude-3-haiku-20240307-v1:0",
    "mistral-large": "mistral.mistral-large-2402-v1:0",
    "mistral-8x7b": "mistral.mixtral-8x7b-instruct-v0:1",
    "mistral-7b": "mistral.mistral-7b-instruct-v0:2",
}

MODEL_FAMILIES = {
    "nova": ["nova-lite", "nova-pro"],
    "claude": ["claude-sonnet3.5", "claude-sonnet3.5v2", "claude-haiku3"],
    "mistral": ["mistral-large", "mistral-8x7b", "mistral-7b"]
}


# The build_evaluation_prompt function is imported from services.Evaluation_templates


class AWSBedrockService:
    def __init__(self, model_name: str = "nova-lite", region: str = "ap-south-1"):
        self.model_name = model_name
        self.model_id = MODEL_IDS.get(model_name, MODEL_IDS["nova-lite"])
        self.region = region
        self.client = boto3.client("bedrock-runtime", region_name=region)
        print(f"✅ Initialized AWSBedrockService with model {self.model_name} ({self.model_id}) in region {self.region}")

    def set_model(self, model_name: str):
        """Switch to a different model dynamically"""
        if model_name in MODEL_IDS:
            self.model_name = model_name
            self.model_id = MODEL_IDS[model_name]
            print(f"🔄 Model switched to {self.model_name} ({self.model_id})")
        else:
            raise ValueError(f"❌ Unknown model: {model_name}")

    def get_model_family(self):
        for family, models in MODEL_FAMILIES.items():
            if self.model_name in models:
                return family
        return "nova"

    def create_request_body(self, prompt: str) -> Dict:
        family = self.get_model_family()
        if family == "mistral":
            return {"prompt": prompt, "max_tokens": 2000, "temperature": 0.0}
        elif family == "claude":
            return {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
            }
        else:  # nova
            return {
                "inferenceConfig": {"max_new_tokens": 2000},
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
            }

    def parse_response(self, response: Dict) -> Dict:
        """Return summary text, model info, token usage, and stats"""
        family = self.get_model_family()
        output = None
        usage = {}

        if family == "mistral":
            output = response["outputs"][0]["text"]
            usage = response.get("usage", {})
        elif family == "claude":
            output = response["content"][0]["text"]
            usage = response.get("usage", {})
        else:  # nova
            output = response["output"]["message"]["content"][0]["text"]
            usage = response.get("usage", {})

        input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens") or 0
        output_tokens = usage.get("output_tokens") or usage.get("completion_tokens") or 0
        total_tokens = input_tokens + output_tokens

        print(f"📊 Token usage - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}")

        return {
            "output": output,
            "stats": {
                "model": self.model_name,
                "model_id": self.model_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
            },
        }

    def invoke_model(self, prompt: str) -> Dict:
        request_body = self.create_request_body(prompt)
        try:
            print(f"🔍 Invoking model: {self.model_name} ({self.model_id})")
            start = time.time()
            response = self.client.invoke_model(
                modelId=self.model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(request_body),
            )
            duration = time.time() - start
            print(f"🚀 Model {self.model_name} invoked in {duration:.2f} seconds")
            body = json.loads(response["body"].read())
            parsed_response = self.parse_response(body)
            parsed_response["stats"]["latency_seconds"] = round(duration, 2)
            return parsed_response
        except Exception as e:
            print(f"❌ Error invoking model: {e}")
            return {"output": f"Error generating summary: {e}", "stats": None}

    async def invoke_model_async(self, prompt: str) -> Dict:
        """Async version of invoke_model for use in async contexts"""
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.invoke_model, prompt)

    async def generate_medical_categories(self, session: Dict, context: str = "Generic", summary: str = "") -> Dict:
        transcript = session.get("transcript_buffer", "").strip()
        summary = summary.strip()
        session_categories = session.get("medical_categories")
        if session_categories:
            categories = "\n\nMedical Categories:\n"
            for key in session_categories.items():
                if key:
                    categories += f" {key}:\n"
        # print(f"🧩 Existing session categories: {session_categories}")
        if not transcript:
            return {"output": "Transcript is empty. Cannot generate categories.", "stats": None}

        # ✅ Check if frontend-selected model matches current backend model
        frontend_model = session.get("selected_model")
        if frontend_model and frontend_model != self.model_name:
            print(f"⚠️ Warning: Frontend selected model '{frontend_model}' "
                  f"but backend is using '{self.model_name}'")

        # Build structured prompt
        prompt = build_categories_prompt(context, transcript, summary, categories)

        print(f"🧠 Building prompt : {prompt}")
        print(f"📋 Final prompt built for context: {context}")
        return self.invoke_model(prompt)

    async def generate_medical_summary(
        self, session: Dict, context: str = "Generic", vitals_text: str = ""
    ) -> Dict:
        transcript = session.get("transcript_buffer", "").strip()
        if not transcript:
            return {"output": "Transcript is empty. Cannot generate summary.", "stats": None}

        # ✅ Check if frontend-selected model matches current backend model
        frontend_model = session.get("selected_model")
        if frontend_model and frontend_model != self.model_name:
            print(f"⚠️ Warning: Frontend selected model '{frontend_model}' "
                  f"but backend is using '{self.model_name}'")

        # Build structured prompt
        prompt = build_prompt_by_context(context, transcript, vitals_text)

        print(f"📋 Final prompt built for context: {context}")
        return self.invoke_model(prompt)

    async def evaluate_medical_output(
        self, session: Dict, context: str = "Generic", categories: str = "", prescription: str = ""
    ) -> Dict:
        """
        Evaluate generated medical categories and prescription against the original transcript.
        Always uses claude-haiku3 for evaluation regardless of user's selected model.
        
        Args:
            session (Dict): Session containing transcript and other data
            context (str): Medical context (Generic, Emergency, etc.)
            categories (str): Generated medical categories to evaluate
            prescription (str): Generated prescription to evaluate
            
        Returns:
            Dict: Evaluation results with feedback and stats
        """
        transcript = session.get("transcript_buffer", "").strip()
        if not transcript:
            return {"output": "Transcript is empty. Cannot perform evaluation.", "stats": None}

        # Store current model settings
        original_model_name = self.model_name
        original_model_id = self.model_id
        
        try:
            # Force switch to claude-haiku3 for evaluation
            self.set_model("claude-haiku3")
            print(f"🔄 Temporarily switched to {self.model_name} for evaluation")
            
            # Build evaluation prompt
            prompt = build_evaluation_prompt(context, transcript, categories, prescription)

            print(f"🔍 Building evaluation prompt for context: {context}")
            print(f"📋 Evaluating categories length: {len(categories)} chars, prescription length: {len(prescription)} chars")
            
            result = self.invoke_model(prompt)
            
            # Try to parse JSON response for validation
            try:
                if result.get("output"):
                    json.loads(result["output"])
                    print("✅ Evaluation response is valid JSON")
            except json.JSONDecodeError as e:
                print(f"⚠️ Warning: Evaluation response is not valid JSON: {e}")
            
            return result
            
        finally:
            # Always restore the original model, even if an error occurs
            self.model_name = original_model_name
            self.model_id = original_model_id
            print(f"🔄 Restored original model: {self.model_name}")