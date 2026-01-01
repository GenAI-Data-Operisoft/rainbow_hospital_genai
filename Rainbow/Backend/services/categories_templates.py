# categories_templates.py
def build_categories_prompt(context: str, transcript: str, summary: str = "", categories: str = "") -> str:
    """
    Build a structured prompt for Bedrock to map transcript/summary to defined categories.

    Args:
        context (str): Clinical context ("Maternity", "Pediatric", "Generic").
        transcript (str): Doctor-patient conversation or notes.
        summary (str): Optional previous model summary.
        categories (str): JSON skeleton of keys to populate.

    Returns:
        str: A structured prompt instructing the model to output JSON array.
    """
    print(f"🧠 Building structured categories prompt for context: {context}")

    # Default JSON skeleton for each context if categories not provided

    prompt = f"""
You are a clinical assistant. Based on the doctor's notes and conversation, extract relevant medical details
and map them to the following structured format.

Input Transcript:
\"\"\"{transcript}\"\"\"

If a summary is available, also consider it:
\"\"\"{summary}\"\"\"

Strictly Use the JSON skeleton below and fill the keys with values from the transcript/summary:
{categories}

Important:
- If a field is not mentioned, leave it empty or as an empty array.
- Do NOT include extra explanations, only return the JSON array.
- Keep the JSON valid and parsable.
- No extra text outside the JSON structure.
"""

    return prompt



























# def build_categories_prompt(context: str, transcript: str, summary: str = "", categories: str = "") -> str:
#     """
#     Build a medical prescription/summary prompt based on clinical context.

#     Args:
#         context (str): The clinical category (e.g., "Maternity", "Pediatric", "Generic").
#         transcript (str): Doctor-patient conversation or notes.
#         vitals_text (str): Additional vitals information, already formatted as text.

#     Returns:
#         str: A structured prompt string.
#     """

#     print(f"🧠 Building prompt for context: {context}")

#     if context == "Maternity":
#         return f"""
# You are a clinical assistant helping an obstetrician/gynecologist prepare a maternity consultation summary 
# based on the doctor's notes. Extract and organize only the relevant details.

# Include the following if mentioned:
# - Patient details (name, age, gravida, para, LMP, EDD)
# - Chief complaints (pain, bleeding, movements, etc.)
# - Obstetric history
# - Current pregnancy findings (USG reports, fetal heart, fundal height)
# - Medications and supplements (iron, calcium, folic acid, etc.)
# - Investigations (blood tests, scans)
# - Advice and follow-up instructions (next visit, warning signs, delivery planning)

# Patient's & Doctor's Conversation:
# \"\"\"{transcript}\"\"\"

# Summarize in structured markdown format, concise and clear.
# """

#     elif context == "Pediatric":
#         return f"""
# You are a clinical assistant helping a pediatrician prepare a consultation summary 
# from doctor's notes. Extract and organize only the relevant details.

# Include sections if available:
# - Context: Pediatric Consultation Summary
# - Patient details (name, age, weight)
# - Chief complaints
# - Birth history / vaccination history
# - Growth and development milestones
# - Clinical findings
# - Medications prescribed (with dose, frequency, duration)
# - Investigations (if any)
# - Advice to parents / caregivers
# - Follow-up plan

# Patient's & Doctor's Conversation:
# \"\"\"{transcript}\"\"\"


# Provide a structured summary in clear markdown for parent understanding.
# """

#     else:  # Generic case
#         return f"""
# You are a clinical assistant preparing a general medical consultation summary 
# from doctor's notes.

# Include sections if available:
# 1. Chief complaint
# 2. Summary of findings
# 3. Provisional diagnosis
# 4. Medications (dose, frequency, duration)
# 5. Investigations (if any)
# 6. Advice and follow-up

# Patient's & Doctor's Conversation:
# \"\"\"{transcript}\"\"\"

# Summarize in professional, structured markdown for clarity.
# """

