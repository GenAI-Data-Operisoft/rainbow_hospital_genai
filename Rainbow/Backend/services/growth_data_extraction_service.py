"""
Growth Data Extraction Service
Extracts child growth metrics from medical transcripts using AI
"""

import json
import re
from typing import Dict, Optional
from services.aws_bedrock_service import AWSBedrockService
from services.growth_data_templates import build_growth_data_extraction_prompt


class GrowthDataExtractionService:
    def __init__(self):
        self.aws_bedrock_service = AWSBedrockService(model_name="nova-lite")
        print("✅ GrowthDataExtractionService initialized")
    
    async def extract_growth_data(self, transcript: str, context: str = "Generic") -> Optional[Dict]:
        """
        Extract child growth data from medical transcript.
        
        Args:
            transcript: Medical conversation transcript
            context: Medical context (Pediatrics, Generic, etc.)
        
        Returns:
            Dictionary with growth data or None if extraction fails
            {
                "name": str or None,
                "age": int or None (in months),
                "weight": float or None (in kg),
                "height": float or None (in cm),
                "gender": "boy" or "girl" or None,
                "confidence": float (0.0-1.0),
                "extracted_text": str
            }
        """
        
        if not transcript or len(transcript.strip()) < 10:
            print("⚠️ Transcript too short for growth data extraction")
            return None
        
        try:
            print(f"📊 Extracting growth data from transcript ({len(transcript)} chars)...")
            
            # Build extraction prompt
            prompt = build_growth_data_extraction_prompt(transcript, context)
            
            # Call AI model
            result = await self.aws_bedrock_service.invoke_model_async(prompt)
            
            if not result or 'output' not in result:
                print("❌ No output from AI model")
                return None
            
            raw_output = result['output']
            print(f"🔍 Raw AI output: {raw_output[:200]}...")
            
            # Parse JSON from output
            growth_data = self._parse_json_output(raw_output)
            
            if not growth_data:
                print("❌ Failed to parse growth data JSON")
                return None
            
            # Validate and clean data
            growth_data = self._validate_and_clean(growth_data)
            
            # Check if we have meaningful data
            if not self._has_meaningful_data(growth_data):
                print("ℹ️ No meaningful growth data found in transcript")
                return None
            
            print(f"✅ Growth data extracted successfully:")
            print(f"   - Name: {growth_data.get('name')}")
            print(f"   - Age: {growth_data.get('age')} months")
            print(f"   - Weight: {growth_data.get('weight')} kg")
            print(f"   - Height: {growth_data.get('height')} cm")
            print(f"   - Gender: {growth_data.get('gender')}")
            print(f"   - Confidence: {growth_data.get('confidence')}")
            
            return growth_data
            
        except Exception as e:
            print(f"❌ Growth data extraction error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _parse_json_output(self, raw_output: str) -> Optional[Dict]:
        """Parse JSON from AI model output, handling various formats."""
        
        try:
            # Try direct JSON parse
            return json.loads(raw_output)
        except json.JSONDecodeError:
            pass
        
        # Try to extract JSON from markdown code blocks
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_output, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Try to find JSON object in text
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_output, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        print(f"⚠️ Could not parse JSON from output: {raw_output[:200]}")
        return None
    
    def _validate_and_clean(self, data: Dict) -> Dict:
        """Validate and clean extracted growth data."""
        
        cleaned = {
            "name": None,
            "age": None,
            "weight": None,
            "height": None,
            "gender": None,
            "confidence": 0.0,
            "extracted_text": ""
        }
        
        # Name
        if data.get('name') and isinstance(data['name'], str):
            cleaned['name'] = data['name'].strip()
        
        # Age (must be positive integer, reasonable range 0-60 months for infant charts)
        if data.get('age') is not None:
            try:
                age = float(data['age'])
                if 0 <= age <= 240:  # 0-20 years (extended range)
                    cleaned['age'] = int(age)
            except (ValueError, TypeError):
                pass
        
        # Weight (must be positive float, reasonable range)
        if data.get('weight') is not None:
            try:
                weight = float(data['weight'])
                if 0.5 <= weight <= 150:  # 0.5kg to 150kg
                    cleaned['weight'] = round(weight, 1)
            except (ValueError, TypeError):
                pass
        
        # Height (must be positive float, reasonable range)
        if data.get('height') is not None:
            try:
                height = float(data['height'])
                if 30 <= height <= 250:  # 30cm to 250cm
                    cleaned['height'] = round(height, 1)
            except (ValueError, TypeError):
                pass
        
        # Gender (normalize)
        if data.get('gender'):
            gender = str(data['gender']).lower().strip()
            if gender in ['boy', 'male', 'm', 'लड़का', 'మగ']:
                cleaned['gender'] = 'boy'
            elif gender in ['girl', 'female', 'f', 'लड़की', 'ఆడ']:
                cleaned['gender'] = 'girl'
        
        # Confidence
        if data.get('confidence') is not None:
            try:
                confidence = float(data['confidence'])
                cleaned['confidence'] = max(0.0, min(1.0, confidence))
            except (ValueError, TypeError):
                cleaned['confidence'] = 0.5
        
        # Extracted text
        if data.get('extracted_text'):
            cleaned['extracted_text'] = str(data['extracted_text'])[:500]
        
        return cleaned
    
    def _has_meaningful_data(self, data: Dict) -> bool:
        """Check if extracted data has meaningful information."""
        
        # Must have at least age and one measurement (weight or height)
        has_age = data.get('age') is not None
        has_weight = data.get('weight') is not None
        has_height = data.get('height') is not None
        
        # Minimum requirement: age + (weight OR height)
        return has_age and (has_weight or has_height)
