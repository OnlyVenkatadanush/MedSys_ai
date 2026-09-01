"""Patient Router: Dashboard, Published Doctor Advice, Medication Reminders, Diet Management & Clarification Chatbot."""

from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_patient_db
from app.models_v2 import (
    ConsultationSession,
    DietPlan,
    MealLogIn,
    MealLogRecord,
    MedicationLogIn,
    MedicationLogRecord,
    MedicationSchedule,
    PatientClarificationMessage,
)
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, require_role
from app.services.emergency_triage import evaluate_emergency_triage
from app.services.model_router import generate_completion

router = APIRouter(prefix="/api/patient", tags=["patient"])


class PatientChatIn(BaseModel):
    message: str


def _ensure_sample_patient_data(patient_id: str):
    """Seeds default sample data for patient dashboard if first time viewing."""
    db = get_patient_db()
    # Ensure sample medication schedule
    if db.medication_schedules.count_documents({"patient_id": patient_id}) == 0:
        db.medication_schedules.insert_many([
            {
                "id": "med_sample_1",
                "patient_id": patient_id,
                "medication_name": "Lisinopril",
                "dosage": "10 mg",
                "frequency": "Once daily in the morning",
                "times_per_day": 1,
                "start_date": "2026-08-01",
                "active": True,
            },
            {
                "id": "med_sample_2",
                "patient_id": patient_id,
                "medication_name": "Metformin",
                "dosage": "500 mg",
                "frequency": "Twice daily after meals",
                "times_per_day": 2,
                "start_date": "2026-08-01",
                "active": True,
            },
        ])

    # Ensure sample finalized consultation
    if db.consultation_sessions.count_documents({"patient_id": patient_id, "status": "finalized"}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        db.consultation_sessions.insert_one({
            "id": "cs_sample_1",
            "patient_id": patient_id,
            "doctor_id": "doc_01",
            "doctor_name": "Dr. Sarah Smith, MD",
            "patient_name": "John Doe",
            "created_at": now,
            "updated_at": now,
            "status": "finalized",
            "symptoms": ["Mild fatigue", "Headache"],
            "vitals": {"bp_systolic": 130, "bp_diastolic": 85, "heart_rate": 74, "temperature_c": 36.8, "spo2_pct": 98},
            "doctor_diagnosis": "Mild Tension Headache & Essential Hypertension",
            "prescriptions": [
                {
                    "medication_name": "Acetaminophen",
                    "dosage": "500 mg",
                    "frequency": "As needed for pain",
                    "duration_days": 5,
                    "instructions": "Take with full glass of water",
                }
            ],
            "doctor_notes": "Patient is responding well to Lisinopril 10mg. Continue current dosage and maintain low-sodium diet.",
            "diet_recommendations": ["DASH Diet guidelines: low sodium (<2g/day)", "Increased potassium rich foods (bananas, spinach)"],
            "follow_up_date": "2026-09-15",
            "signed_off_at": now,
        })


@router.get("/dashboard")
async def get_patient_dashboard(
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Retrieves patient dashboard: active care plan, finalized doctor advice, medication reminders, upcoming appointments."""
    db = get_patient_db()
    _ensure_sample_patient_data(user.user_id)

    finalized_consultations = list(
        db.consultation_sessions.find(
            {"patient_id": user.user_id, "status": "finalized"},
            {"_id": 0}
        ).sort("signed_off_at", -1)
    )

    medications = list(
        db.medication_schedules.find(
            {"patient_id": user.user_id, "active": True},
            {"_id": 0}
        )
    )

    recent_logs = list(
        db.medication_logs.find(
            {"patient_id": user.user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10)
    )

    diet_plan = db.diet_plans.find_one({"patient_id": user.user_id}, {"_id": 0}) or {
        "guidelines": "Heart Healthy & Low Sodium Diet",
        "allowed_foods": ["Fresh fruits", "Leafy green vegetables", "Whole grains", "Lean poultry"],
        "restricted_foods": ["Added sugars", "Sodium > 2000mg/day", "Fried foods"],
    }

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="READ_PATIENT_DASHBOARD",
        target_patient_id=user.user_id,
        resource="/api/patient/dashboard",
    )

    return {
        "patient_id": user.user_id,
        "recent_doctor_advice": finalized_consultations[:3],
        "active_medications": medications,
        "medication_logs": recent_logs,
        "diet_plan": diet_plan,
    }


@router.get("/medications")
async def get_patient_medications(
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Lists all active medication schedules & log history."""
    db = get_patient_db()
    _ensure_sample_patient_data(user.user_id)
    schedules = list(db.medication_schedules.find({"patient_id": user.user_id, "active": True}, {"_id": 0}))
    logs = list(db.medication_logs.find({"patient_id": user.user_id}, {"_id": 0}).sort("timestamp", -1).limit(20))
    return {"schedules": schedules, "logs": logs}


@router.post("/medications/log", response_model=MedicationLogRecord)
async def log_medication_dose(
    payload: MedicationLogIn,
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Patient confirms taking or skipping a scheduled medication dose."""
    db = get_patient_db()
    now = datetime.now(timezone.utc).isoformat()
    record = MedicationLogRecord(
        id=f"medlog_{uuid.uuid4().hex[:10]}",
        patient_id=user.user_id,
        medication_id=payload.medication_id,
        medication_name=payload.medication_name,
        dosage=payload.dosage,
        timestamp=now,
        status=payload.status,
        notes=payload.notes,
    )
    db.medication_logs.insert_one(record.model_dump())

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="LOG_MEDICATION_DOSE",
        target_patient_id=user.user_id,
        resource="/api/patient/medications/log",
        details=f"Medication {payload.medication_name} marked as {payload.status}",
    )
    return record


@router.get("/diet")
async def get_patient_diet_plan(
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Retrieves patient diet recommendations and logged meals."""
    db = get_patient_db()
    plan = db.diet_plans.find_one({"patient_id": user.user_id}, {"_id": 0})
    meals = list(db.meal_logs.find({"patient_id": user.user_id}, {"_id": 0}).sort("timestamp", -1).limit(15))
    return {"diet_plan": plan, "meal_logs": meals}


@router.post("/diet/meals", response_model=MealLogRecord)
async def log_patient_meal(
    payload: MealLogIn,
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Logs a meal for patient nutrition tracking."""
    db = get_patient_db()
    now = datetime.now(timezone.utc).isoformat()
    record = MealLogRecord(
        id=f"meal_{uuid.uuid4().hex[:10]}",
        patient_id=user.user_id,
        meal_type=payload.meal_type,
        food_items=payload.food_items,
        timestamp=now,
        notes=payload.notes,
    )
    db.meal_logs.insert_one(record.model_dump())
    return record


@router.post("/chat", response_model=PatientClarificationMessage)
async def patient_clarification_chat(
    payload: PatientChatIn,
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Patient Clarification Chatbot: Answers patient queries grounded in their authorized doctor advice with emergency triage guardrails."""
    triage = evaluate_emergency_triage(payload.message)
    db = get_patient_db()
    now = datetime.now(timezone.utc).isoformat()

    # If critical red flag symptoms detected, trigger immediate emergency response
    if triage["is_red_flag"]:
        return PatientClarificationMessage(
            id=f"msg_{uuid.uuid4().hex[:10]}",
            role="assistant",
            content=f"⚠️ **EMERGENCY WARNING**: We detected potential critical symptoms ({', '.join(triage['detected_keywords'])}).\n\n{triage['emergency_guidance']}",
            created_at=now,
            is_red_flag=True,
            emergency_guidance=triage["emergency_guidance"],
        )

    # Contextual grounding on finalized doctor advice
    latest_consult = db.consultation_sessions.find_one(
        {"patient_id": user.user_id, "status": "finalized"},
        sort=[("signed_off_at", -1)],
    )

    advice_summary = "No recent consultation recorded."
    if latest_consult:
        advice_summary = (
            f"Diagnosis: {latest_consult.get('doctor_diagnosis', 'N/A')}. "
            f"Doctor Notes: {latest_consult.get('doctor_notes', 'N/A')}. "
            f"Prescriptions: {[rx.get('medication_name') for rx in latest_consult.get('prescriptions', [])]}."
        )

    system_prompt = f"""
You are MedSys AI Patient Clarification Assistant.
Answer the patient's questions warmly, clearly, and accurately.
Ground your answers in their authorized doctor's finalized instructions:
{advice_summary}

Rules:
1. Emphasize that you are an AI assistant helping clarify doctor's orders, NOT a doctor.
2. If the user asks about changing dosages or severe symptoms, instruct them to contact their attending doctor.
3. Be reassuring, clear, and helpful.
"""

    try:
        response_text = await generate_completion(
            messages=[{"role": "user", "content": payload.message}],
            system_prompt=system_prompt,
        )
    except Exception as e:
        response_text = f"I am here to help clarify your care plan! Based on your doctor's notes: {advice_summary}. Please consult your doctor for medical decisions."

    msg = PatientClarificationMessage(
        id=f"msg_{uuid.uuid4().hex[:10]}",
        role="assistant",
        content=response_text,
        created_at=now,
        is_red_flag=False,
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="PATIENT_CHAT_QUERY",
        target_patient_id=user.user_id,
        resource="/api/patient/chat",
    )

    return msg
