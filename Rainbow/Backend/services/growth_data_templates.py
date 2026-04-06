"""
Growth Data Extraction Prompt Templates
Extracts child growth information from medical transcripts
"""

def build_growth_data_extraction_prompt(transcript: str, context: str = "Generic") -> str:
    """
    Build prompt for extracting child growth data from medical transcript.
    
    Args:
        transcript: The medical conversation transcript
        context: Medical context (Pediatrics, Generic, etc.)
    
    Returns:
        Formatted prompt for AI model
    """
    
    prompt = f"""You are a medical data extraction assistant. Extract child growth information from the following medical transcript.

TRANSCRIPT:
{transcript}

TASK:
Extract the following information about a child/baby/infant:
1. Name (child's name if mentioned)
2. Age (convert to months - e.g., "2 years" = 24 months, "6 months" = 6)
3. Weight (in kilograms - convert if needed, e.g., "8.5 pounds" = 3.86 kg)
4. Height/Length (in centimeters - convert if needed, e.g., "30 inches" = 76.2 cm)
5. Gender (normalize to "boy" or "girl")

IMPORTANT RULES:
- Convert all ages to MONTHS (e.g., "2 years" → 24, "1.5 years" → 18, "6 months" → 6)
- Convert all weights to KILOGRAMS (e.g., "8 pounds" → 3.63 kg)
- Convert all heights to CENTIMETERS (e.g., "30 inches" → 76.2 cm)
- Gender must be "boy" or "girl" (normalize "male"→"boy", "female"→"girl")
- Use null for any field not found in the transcript
- Confidence: 1.0 if explicitly stated, 0.7-0.9 if inferred, 0.5 if uncertain
- Extract the most recent/relevant mention if multiple children discussed

MULTI-LANGUAGE SUPPORT:
- Handle Hindi: साल (years), महीने (months), किलो (kg), सेंटीमीटर (cm)
- Handle Telugu: సంవత్సరాలు (years), నెలలు (months)
- Handle mixed language transcripts

RETURN ONLY VALID JSON (no markdown, no explanation):
{{
    "name": "string or null",
    "age": number or null,
    "weight": number or null,
    "height": number or null,
    "gender": "boy" or "girl" or null,
    "confidence": 0.0-1.0,
    "extracted_text": "relevant snippet from transcript showing the data"
}}

EXAMPLES:

Example 1:
Transcript: "The child's name is Rahul. He is 2 years old, weighs 12.5 kg, and his height is 86 cm."
Output: {{"name": "Rahul", "age": 24, "weight": 12.5, "height": 86.0, "gender": "boy", "confidence": 1.0, "extracted_text": "Rahul. He is 2 years old, weighs 12.5 kg, and his height is 86 cm"}}

Example 2:
Transcript: "Baby girl, 6 months old, weight is 8 kg"
Output: {{"name": null, "age": 6, "weight": 8.0, "height": null, "gender": "girl", "confidence": 0.9, "extracted_text": "Baby girl, 6 months old, weight is 8 kg"}}

Example 3:
Transcript: "बच्चे का नाम अर्जुन है। उसकी उम्र 18 महीने है और वजन 10 किलो है।"
Output: {{"name": "Arjun", "age": 18, "weight": 10.0, "height": null, "gender": "boy", "confidence": 0.85, "extracted_text": "अर्जुन है। उसकी उम्र 18 महीने है और वजन 10 किलो है"}}

Example 4:
Transcript: "Patient has fever and cough. Prescribed antibiotics."
Output: {{"name": null, "age": null, "weight": null, "height": null, "gender": null, "confidence": 0.0, "extracted_text": "No growth data found"}}

Now extract from the provided transcript above.
"""
    
    return prompt
