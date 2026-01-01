from typing import Dict


def identify_speaker(transcript: str) -> Dict:
    """Identify speaker from transcript content"""
    text = transcript.lower()

    # Patient indicators
    patient_indicators = ['pain', 'painful', 'hurt', 'feel', 'my hand', 'my head',
                          'my stomach', 'i have', 'it hurts', 'i feel', 'help me',
                          'what should', 'when should', 'pulse']

    if any(indicator in text for indicator in patient_indicators):
        return {'speaker': 'PATIENT', 'confidence': 0.7}

    # Doctor indicators
    doctor_indicators = ['patient', 'medicine', 'prescription', 'diagnosis',
                         'treatment', 'symptoms', 'blood pressure', 'fever',
                         'tablet', 'injection', 'test', 'report', 'normal',
                         'high', 'low', 'detects']

    if any(indicator in text for indicator in doctor_indicators):
        return {'speaker': 'DOCTOR', 'confidence': 0.8}

    # Default to SPEAKER for neutral content
    return {'speaker': 'SPEAKER', 'confidence': 0.3}
