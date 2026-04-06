def build_prompt_by_context(context: str, transcript: str, vitals_text: str = "") -> str:
    """
    Build a strict, extractive medical consultation prompt for a doctor-patient conversation.
    This version removes AI suggestions completely and outputs only what is explicitly mentioned.
    
    Args:
        context (str): Clinical category (e.g., "Maternity", "Pediatric", "Generic").
        transcript (str): Doctor-patient conversation or notes.
        vitals_text (str): Additional vitals information, already formatted as text.

    Returns:
        str: A structured, strictly extractive prompt string.
    """

    print(f"🧠 Building STRICT EXTRACTIVE prompt for context: {context}")

    base_prompt = f"""
You are a medical documentation assistant AI helping a doctor in real time.
Your ONLY task is to extract information from the given conversation and 
format it as a structured SOAP note. **Do NOT make suggestions, add diagnoses,
recommend labs, medicines, or scans on your own.**

### STRICT RULES:
- Be purely EXTRACTIVE: write only what is explicitly mentioned by the doctor or patient.
- If information is not present, leave the field as "None" (do not guess or fill in).
- Do not expand, explain, or suggest additional steps.
- Maintain professional medical language for EMR use.

### OUTPUT STRUCTURE (MUST FOLLOW EXACTLY):

Patient Demographics:
- Name: <Extract if mentioned, else "None">
- Age: <Extract if mentioned, else "None">
- Gender: <Extract if mentioned, else "None">

Medical Documentation:

- **Chief Complaints**: List main patient-reported complaints. If none mentioned, write "None".
- **Present Illness**: Summarize details of the current illness (onset, duration, progression). If none mentioned, write "None".
- **Past Medical/Surgical History**: List previous diseases, conditions, or surgeries. If none mentioned, write "None".
- **Family History**: Mention relevant medical history in family members. If none mentioned, write "None".
- **Personal/Social History**: Mention lifestyle details (smoking, alcohol, occupation, etc.). If none mentioned, write "None".
- **Developmental History**: Mention developmental milestones if applicable. If none mentioned, write "None".
- **Examination**: List clinical findings and vitals (include {vitals_text} if provided). If none mentioned, write "None".
- **Diagnosis**: Write exactly the diagnosis stated by the doctor. If none mentioned, write "None".
- **Procedure**: Mention any procedure performed or planned. If none mentioned, write "None".
- **OB History**: Mention obstetric history details if provided. If none mentioned, write "None".
- **Doctor Note**: Extract additional doctor remarks or notes. If none mentioned, write "None".
- **Doctor Recommendation and Advice**: Mention doctor's recommendations, medicines, tests, or follow-up advice. If none mentioned, write "None".

### CONTEXT:
- Clinical Category: {context}
- Patient Vitals: {vitals_text if vitals_text else "No vitals provided"}

### CONVERSATION TRANSCRIPT:
\"\"\"{transcript}\"\"\"

### GUIDELINES:
- Be precise, structured, and professional.
- Leave missing information as "None".
- DO NOT generate recommendations, treatment suggestions, or additional advice.
- DO NOT create information that is not in the transcript.
"""

    if context == "Maternity":
        return base_prompt + """
### Maternity-Specific Fields (ONLY if explicitly mentioned):
- Gravida/Para
- LMP, EDD
- Obstetric history and complications
- Current pregnancy findings: USG, fetal heart rate, fundal height
- Medications and supplements
- Advice given by doctor
"""

    elif context == "Pediatric":
        return base_prompt + """
### Pediatric-Specific Fields (ONLY if explicitly mentioned):
- Age, weight, growth parameters
- Birth and vaccination history
- Developmental milestones
- Feeding history, parental concerns
- Medications and follow-up advice given by doctor
"""

    else:
        return base_prompt + """
### Generic Consultation Details (ONLY if explicitly mentioned):
- Past medical/surgical history
- Risk factors and comorbidities
- Labs and imaging mentioned
- Follow-up or lifestyle advice given by doctor
"""
