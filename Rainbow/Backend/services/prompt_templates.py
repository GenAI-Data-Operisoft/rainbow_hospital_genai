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
- PRIMARY PATIENT ONLY: The consultation is for one primary patient (the person the doctor is primarily treating in this visit). If the conversation incidentally mentions another person by name (e.g., a sibling, second child, spouse, or any other family member) along with their own symptoms, complaints, diagnosis, or any medicine/advice the doctor gives for them — ignore ALL of that entirely. This includes: their name, their condition, their diagnosis, and any prescription, syrup, medicine, or recommendation the doctor makes specifically for them. Do NOT let any information about a secondary person appear anywhere in the output — not in Chief Complaints, not in Diagnosis, and especially not in Doctor Recommendation and Advice. Only extract information that directly relates to the primary patient. Do NOT add any note, comment, or explanation about what was skipped — just silently omit it.

### OUTPUT STRUCTURE (MUST FOLLOW EXACTLY):

Patient Demographics:
- Name: <Extract the name of the PATIENT being treated, not the parent or guardian. If a parent/guardian introduces themselves (e.g., "my name is X and my son/daughter Y has fever"), the patient name is the child (Y), not the parent (X). If not mentioned, write "None">
- Age: <Extract the age of the PATIENT being treated, not the parent. If not mentioned, write "None">
- Gender: <Extract the gender of the PATIENT. If not explicitly stated but inferable from context (e.g., "my son" = Male, "my daughter" = Female), use that. If not determinable, write "None">

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
- **Doctor Note**: Extract general doctor observations, remarks, or non-prescriptive comments (e.g., "patient seems anxious", "review in 2 weeks", "condition is improving"). Do NOT include medicines, dosages, or treatment instructions here. If none mentioned, write "None".
- **Doctor Recommendation and Advice**: Extract ONLY medicines, dosages, syrups, tablets, injections, treatment instructions, tests ordered, lifestyle advice, and follow-up instructions that are prescribed or instructed BY THE DOCTOR in this consultation. This includes informal phrasing like "take this syrup", "one cup syrup", "I am giving you this medicine", "continue this tablet", "get this test done". Do NOT include medicines or treatments that the patient mentions they are already currently taking or using on their own — those belong in Past Medical/Surgical History. If none mentioned, write "None".

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
