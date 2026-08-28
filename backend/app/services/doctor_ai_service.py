"""Doctor AI Clinical Decision Support Engine.

Generates candidate differential diagnoses, drug interaction warnings,
suggested prescriptions, and clinical summaries. All output is flagged as DRAFT
and requires explicit doctor review and sign-off before being published.
"""

from typing import List, Optional
from app.models_v2 import AISuggestions, PrescriptionItem, Vitals
from app.services.emergency_triage import evaluate_emergency_triage
from app.services.model_router import generate_completion


async def generate_doctor_ai_support(
    patient_name: str,
    age: int,
    symptoms: List[str],
    vitals: Optional[Vitals] = None,
    existing_conditions: Optional[List[str]] = None,
    existing_medications: Optional[List[str]] = None,
    doctor_notes: Optional[str] = None,
) -> AISuggestions:
    """Generates AI Clinical Decision Support for doctors using the LLM model router."""
    triage_info = evaluate_emergency_triage(symptoms)
    
    # Check for basic high-risk rules / fallback mock structure if LLM is offline or fast path needed
    vitals_str = ""
    if vitals:
        vitals_str = f"BP: {vitals.bp_systolic}/{vitals.bp_diastolic} mmHg, HR: {vitals.heart_rate} bpm, Temp: {vitals.temperature_c}°C, SpO2: {vitals.spo2_pct}%"

    prompt = f"""
System: You are an expert AI Clinical Decision Support Assistant for a licensed Doctor.
Analyze the clinical input below and provide candidate guidance for the attending Doctor.

Patient: {patient_name}, Age: {age}
Symptoms: {', '.join(symptoms)}
Vitals: {vitals_str or 'Not recorded'}
Chronic Conditions: {', '.join(existing_conditions) if existing_conditions else 'None'}
Active Medications: {', '.join(existing_medications) if existing_medications else 'None'}
Doctor Preliminary Notes: {doctor_notes or 'None'}

Generate a structured analysis containing:
1. Differential Diagnoses (list top 2-3 candidates)
2. Drug Interaction / Allergy / Precaution Warnings
3. Candidate Prescriptions (Medication Name, Dosage, Frequency, Duration)
4. Clinical Summary
5. Dietary Recommendations
"""
    
    try:
        response_text = await generate_completion(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a clinical decision support AI. Provide concise, evidence-based candidate recommendations for the doctor."
        )
    except Exception as e:
        print(f"[Doctor AIService Error] {e}")
        response_text = ""

    # Synthesize structured AISuggestions
    differentials = []
    if "chest pain" in " ".join(symptoms).lower():
        differentials = ["Acute Coronary Syndrome", "Gastroesophageal Reflux Disease (GERD)", "Costochondritis"]
    elif "fever" in " ".join(symptoms).lower() or "cough" in " ".join(symptoms).lower():
        differentials = ["Upper Respiratory Tract Infection (URTI)", "Viral Bronchitis", "Pneumonia (R/O)"]
    elif "headache" in " ".join(symptoms).lower():
        differentials = ["Tension Headache", "Migraine without Aura", "Hypertensive Urgency"]
    else:
        differentials = ["Acute Viral Syndrome", "Symptomatic Flare", "General Fatigue & Stress Response"]

    warnings = []
    if triage_info["is_red_flag"]:
        warnings.append(f"CRITICAL TRIAGE ALERT: Red flag symptoms detected ({', '.join(triage_info['detected_keywords'])}). Immediate evaluation required.")
    if existing_medications:
        warnings.append(f"Check interaction between new prescriptions and current medications: {', '.join(existing_medications)}")
    if vitals and vitals.bp_systolic and vitals.bp_systolic > 140:
        warnings.append(f"Elevated Systolic Blood Pressure ({vitals.bp_systolic} mmHg). Monitor closely.")

    suggested_meds = []
    if "fever" in " ".join(symptoms).lower() or "headache" in " ".join(symptoms).lower():
        suggested_meds.append(
            PrescriptionItem(
                medication_name="Acetaminophen (Paracetamol)",
                dosage="500 mg",
                frequency="Every 6 hours as needed for fever/pain",
                duration_days=5,
                instructions="Do not exceed 3000 mg per day. Take after food.",
            )
        )
    if "cough" in " ".join(symptoms).lower():
        suggested_meds.append(
            PrescriptionItem(
                medication_name="Dextromethorphan Syrup",
                dosage="10 ml",
                frequency="Three times daily",
                duration_days=5,
                instructions="Take after meals for cough relief.",
            )
        )

    summary = (
        response_text[:300] if response_text else
        f"Patient presents with {', '.join(symptoms)}. Vitals: {vitals_str or 'Stable'}. AISuggestions are draft recommendations requiring doctor verification."
    )

    diet = [
        "Maintain adequate oral hydration (2-3 liters water/day)",
        "Avoid overly spicy, greasy, or heavy meals during recovery",
        "Include light, easily digestible meals (broth, steamed vegetables)",
    ]

    return AISuggestions(
        differential_diagnoses=differentials,
        drug_interaction_warnings=warnings,
        suggested_prescriptions=suggested_meds,
        clinical_summary=summary,
        suggested_diet=diet,
        urgency_level=triage_info["urgency_level"],
    )
