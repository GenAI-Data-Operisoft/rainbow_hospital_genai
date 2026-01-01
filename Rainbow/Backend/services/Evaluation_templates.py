def build_evaluation_prompt(context: str, transcript: str, categories: str, prescription: str = "") -> str:
    """
    Build a structured evaluation prompt for Bedrock to check if prescription and categories are correct.

    Args:
        context (str): Additional context information
        transcript (str): Real-time doctor-patient conversation
        categories (str): JSON output of extracted categories to be evaluated
        prescription (str): Generated prescription text to be evaluated

    Returns:
        str: A structured evaluation prompt instructing the model to give numerical scores with reasoning
    """

    prompt = f"""
You are a senior clinical reviewer evaluating medical category extraction and prescription generation from a real-time doctor-patient conversation.

**Input Transcript:**
\"\"\"{transcript}\"\"\"

**Generated Categories:**
{categories}

**Generated Prescription:**
\"\"\"{prescription}\"\"\"

**Your Task:**
Evaluate how well the categories and prescription capture the medical information from the transcript. Provide numerical confidence scores (1.00-10.00, up to 2 decimal places) with specific reasoning.

**Categories to Evaluate:**
- SYMPTOMS: Patient-reported symptoms and complaints
- OBJECTIVE: Observable/measurable clinical findings
- ASSESSMENT: Clinical assessment and diagnoses
- VITALS: Vital signs and measurements
- PLAN: Treatment plans and follow-up instructions
- NOTES: Additional clinical notes and observations
- FEATURES: Clinical features and presentations
- HISTORY: Medical history and background
- CLINICAL_ALERTS: Important warnings or critical information

Respond ONLY with a valid JSON object:

{{
  "categories_evaluation": {{
    "completeness_score": <1.00-10.00>,
    "accuracy_score": <1.00-10.00>,
    "relevance_score": <1.00-10.00>,
    "overall_score": <1.00-10.00>,
    "reasoning": [
      "Brief point about what was captured correctly",
      "Brief point about what was missed - quote from transcript: 'example text'",
      "Brief point about incorrect categorization - quote: 'example text'"
    ]
  }},
  "prescription_evaluation": {{
    "clinical_appropriateness_score": <1.00-10.00>,
    "completeness_score": <1.00-10.00>,
    "overall_score": <1.00-10.00>,
    "reasoning": [
      "Brief point about appropriate medications for discussed conditions",
      "Brief point about missing elements - quote: 'example from transcript'",
      "Brief point about instruction completeness"
    ]
  }},
  "overall_assessment_score": <1.00-10.00>,
  "critical_findings": [
    "Any critical medical information that was missed or incorrectly handled"
  ]
}}

**Scoring Guidelines:**
- 9.00-10.00: Excellent capture/appropriateness
- 7.00-8.99: Good with minor gaps
- 5.00-6.99: Adequate but notable issues
- 3.00-4.99: Poor with significant problems
- 1.00-2.99: Very poor or dangerous omissions

**Important:**
- Reference specific quotes from transcript in reasoning
- Keep reasoning points concise and actionable
- Focus on clinical relevance and patient safety
- No extra text outside JSON object
"""

    return prompt