"""Emergency & Critical Symptom Triage Service."""

from typing import Dict, List, Any

RED_FLAG_KEYWORDS = [
    "chest pain", "cardiac", "heart attack", "shortness of breath", "severe dyspnea",
    "difficulty breathing", "stroke", "numbness on one side", "slurred speech",
    "unconscious", "fainted", "syncope", "heavy bleeding", "uncontrolled bleeding",
    "anaphylaxis", "severe allergic reaction", "swollen tongue", "severe head trauma",
    "seizure", "suicidal"
]

EMERGENCY_GUIDANCE_TEXT = (
    "CRITICAL WARNING: The symptoms mentioned indicate a potential emergency requiring immediate medical attention. "
    "Please call emergency services (911 / 112 / 102) or go to the nearest emergency room immediately. "
    "Do not delay seeking emergency care."
)


def evaluate_emergency_triage(symptoms_or_text: List[str] | str) -> Dict[str, Any]:
    """Analyzes intake symptoms or user messages for critical red-flag emergency symptoms."""
    if isinstance(symptoms_or_text, list):
        text_content = " ".join(symptoms_or_text).lower()
    else:
        text_content = symptoms_or_text.lower()

    detected_flags = [kw for kw in RED_FLAG_KEYWORDS if kw in text_content]
    
    if detected_flags:
        return {
            "is_red_flag": True,
            "urgency_level": "critical",
            "detected_keywords": detected_flags,
            "emergency_guidance": EMERGENCY_GUIDANCE_TEXT,
        }
        
    return {
        "is_red_flag": False,
        "urgency_level": "routine",
        "detected_keywords": [],
        "emergency_guidance": None,
    }
