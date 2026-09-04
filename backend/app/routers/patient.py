"""Patient Router: Dashboard, Published Doctor Advice, Medication Reminders, Diet Management & Clarification Chatbot."""

import json
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from app.db import get_doctor_db, get_patient_db
from app.services.pdf_service import generate_consultation_pdf
from app.models_v2 import (
    ConsultationSession,
    DietPlan,
    MealLogIn,
    MealLogRecord,
    MedicationLogIn,
    MedicationLogRecord,
    MedicationSchedule,
    PatientClarificationMessage,
    PrescriptionIn,
)
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, require_role
from app.services.emergency_triage import evaluate_emergency_triage
from app.services.model_router import generate_completion

router = APIRouter(prefix="/api/patient", tags=["patient"])


class PatientChatIn(BaseModel):
    message: str


def _map_prescription_to_schedule(rx: dict) -> dict:
    freq = rx.get("frequency", "Once daily")
    freq_lower = freq.lower()
    times = 1
    if "twice" in freq_lower or "2 times" in freq_lower or "bid" in freq_lower:
        times = 2
    elif "three" in freq_lower or "3 times" in freq_lower or "tid" in freq_lower:
        times = 3
    elif "four" in freq_lower or "4 times" in freq_lower or "qid" in freq_lower:
        times = 4

    return {
        "id": rx.get("id") or f"rx_{uuid.uuid4().hex[:8]}",
        "patient_id": rx.get("patient_id", ""),
        "medication_name": rx.get("medication_name", "Medication"),
        "dosage": rx.get("dosage", ""),
        "frequency": freq,
        "times_per_day": times,
        "start_date": (rx.get("created_at") or datetime.now(timezone.utc).isoformat())[:10],
        "active": rx.get("status") == "active" or rx.get("active", True),
        "prescribed_by_doctor_id": rx.get("doctor_id", "doc_01"),
    }


def _ensure_sample_patient_data(patient_id: str):
    """Seeds default sample data for patient dashboard if first time viewing."""
    db = get_patient_db()
    now = datetime.now(timezone.utc).isoformat()

    # Ensure sample prescriptions
    if db.prescriptions.count_documents({"patient_id": patient_id}) == 0:
        db.prescriptions.insert_many([
            {
                "id": "rx_sample_1",
                "consultation_id": "cs_sample_1",
                "patient_id": patient_id,
                "doctor_id": "doc_01",
                "medication_name": "Lisinopril",
                "dosage": "10 mg",
                "frequency": "Once daily in morning",
                "duration_days": 30,
                "instructions": "Take with water in the morning",
                "status": "active",
                "created_at": now,
            },
            {
                "id": "rx_sample_2",
                "consultation_id": "cs_sample_1",
                "patient_id": patient_id,
                "doctor_id": "doc_01",
                "medication_name": "Metformin",
                "dosage": "500 mg",
                "frequency": "Twice daily with meals",
                "duration_days": 30,
                "instructions": "Take with meals",
                "status": "active",
                "created_at": now,
            },
        ])

    # Ensure sample finalized consultation
    if db.consultations.count_documents({"patient_id": patient_id, "status": "finalized"}) == 0:
        db.consultations.insert_one({
            "id": "cs_sample_1",
            "patient_id": patient_id,
            "doctor_id": "doc_01",
            "symptoms": "Mild fatigue, Headache",
            "doctor_notes": "Patient is responding well to Lisinopril 10mg. Continue current dosage and maintain low-sodium diet.",
            "final_diagnosis": "Mild Tension Headache & Essential Hypertension",
            "diet_advice": "DASH Diet guidelines: low sodium (<2g/day), Increased potassium rich foods (bananas, spinach)",
            "follow_up_date": "2026-09-15",
            "status": "finalized",
            "created_at": now,
            "finalized_at": now,
        })


@router.get("/dashboard")
async def get_patient_dashboard(
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Retrieves patient dashboard: active care plan, finalized doctor advice, medication reminders, upcoming appointments."""
    db = get_patient_db()
    doctor_db = get_doctor_db()
    _ensure_sample_patient_data(user.user_id)

    raw_consultations = list(
        db.consultations.find(
            {"patient_id": user.user_id, "status": "finalized"},
            {"_id": 0}
        ).sort("finalized_at", -1).limit(5)
    )

    finalized_consultations = []
    for c in raw_consultations:
        doc_record = doctor_db.doctors.find_one({"id": c.get("doctor_id")}, {"_id": 0, "name": 1})
        doc_name = doc_record.get("name") if doc_record else "Dr. Sarah Smith, MD"

        rx_rows = list(db.prescriptions.find({"consultation_id": c["id"]}, {"_id": 0}))
        prescriptions = [
            PrescriptionIn(
                medication_name=r.get("medication_name", ""),
                dosage=r.get("dosage", ""),
                frequency=r.get("frequency", ""),
                duration_days=int(r.get("duration_days", 30)),
                instructions=r.get("instructions", ""),
            )
            for r in rx_rows
        ]

        symptoms_list = []
        if isinstance(c.get("symptoms"), str):
            symptoms_list = [s.strip() for s in c["symptoms"].split(",") if s.strip()]
        elif isinstance(c.get("symptoms"), list):
            symptoms_list = c.get("symptoms")

        diet_list = []
        if isinstance(c.get("diet_advice"), str):
            diet_list = [d.strip() for d in c["diet_advice"].split(",") if d.strip()]
        elif isinstance(c.get("diet_recommendations"), list):
            diet_list = c.get("diet_recommendations")

        finalized_consultations.append(
            ConsultationSession(
                id=c["id"],
                patient_id=user.user_id,
                doctor_id=c.get("doctor_id", "doc_01"),
                doctor_name=doc_name,
                patient_name=user.full_name or "Patient",
                created_at=c.get("created_at", ""),
                updated_at=c.get("finalized_at") or c.get("created_at", ""),
                status="finalized",
                symptoms=symptoms_list,
                doctor_diagnosis=c.get("final_diagnosis") or c.get("doctor_diagnosis") or "",
                prescriptions=prescriptions,
                doctor_notes=c.get("doctor_notes") or "",
                diet_recommendations=diet_list,
                follow_up_date=c.get("follow_up_date"),
                signed_off_at=c.get("finalized_at"),
            )
        )

    active_rx = list(
        db.prescriptions.find(
            {"patient_id": user.user_id, "status": "active"},
            {"_id": 0}
        )
    )
    medications = [_map_prescription_to_schedule(rx) for rx in active_rx]

    recent_logs = list(
        db.medication_logs.find(
            {"patient_id": user.user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10)
    )

    patient_diet_doc = db.patient_diet.find_one({"patient_id": user.user_id}, {"_id": 0})
    if patient_diet_doc and "diet_plan" in patient_diet_doc:
        diet_plan = patient_diet_doc["diet_plan"]
    else:
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

    active_rx = list(
        db.prescriptions.find(
            {"patient_id": user.user_id, "status": "active"},
            {"_id": 0}
        )
    )
    schedules = [_map_prescription_to_schedule(rx) for rx in active_rx]
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
    patient_diet_doc = db.patient_diet.find_one({"patient_id": user.user_id}, {"_id": 0})
    if patient_diet_doc and "diet_plan" in patient_diet_doc:
        plan = patient_diet_doc["diet_plan"]
    else:
        plan = db.diet_plans.find_one({"patient_id": user.user_id}, {"_id": 0}) or {
            "guidelines": "Heart Healthy & Low Sodium Diet",
            "allowed_foods": ["Fresh fruits", "Leafy green vegetables", "Whole grains", "Lean poultry"],
            "restricted_foods": ["Added sugars", "Sodium > 2000mg/day", "Fried foods"],
        }
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
    latest_consult = db.consultations.find_one(
        {"patient_id": user.user_id, "status": "finalized"},
        sort=[("finalized_at", -1), ("created_at", -1)],
    )

    active_rx = list(db.prescriptions.find({"patient_id": user.user_id, "status": "active"}, {"_id": 0}))

    advice_summary = "No recent consultation recorded."
    if latest_consult:
        med_names = [r.get("medication_name") for r in active_rx if r.get("medication_name")]
        advice_summary = (
            f"Diagnosis: {latest_consult.get('final_diagnosis') or latest_consult.get('doctor_diagnosis', 'N/A')}. "
            f"Doctor Notes: {latest_consult.get('doctor_notes', 'N/A')}. "
            f"Active Prescriptions: {', '.join(med_names) if med_names else 'None'}."
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


@router.get("/consultations/{session_id}/pdf")
async def download_patient_consultation_pdf(
    session_id: str,
    user: AuthenticatedUser = Depends(require_role("patient")),
):
    """Allows patient to download their signed consultation summary & prescription PDF."""
    pdb = get_patient_db()
    ddb = get_doctor_db()

    consultation = pdb.consultations.find_one({"id": session_id, "patient_id": user.user_id}, {"_id": 0})
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation session not found for this patient")

    doctor_info = ddb.doctors.find_one({"id": consultation.get("doctor_id")}, {"_id": 0}) or {
        "name": consultation.get("doctor_name") or "Dr. Attending Physician",
        "specialization": "General Practice & Internal Medicine",
        "hospital_name": "MedSys Healthcare Clinic",
        "license_number": "MED-SYS-77402",
    }

    patient_info = pdb.patients.find_one({"id": user.user_id}, {"_id": 0}) or {}
    prof = pdb.profiles.find_one({"clerkUserId": user.user_id}, {"_id": 0}) or {}
    combined_patient = {**patient_info, **prof}

    prescriptions = list(pdb.prescriptions.find({"consultation_id": session_id}, {"_id": 0}))

    vitals = {}
    if consultation.get("vitals_json"):
        try:
            vitals = json.loads(consultation["vitals_json"])
        except Exception:
            pass

    diet_advice = consultation.get("diet_advice", "")

    pdf_bytes = generate_consultation_pdf(
        doctor_info=doctor_info,
        patient_info=combined_patient,
        consultation=consultation,
        prescriptions=prescriptions,
        diet_advice=diet_advice,
        vitals=vitals,
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="PATIENT_EXPORT_PRESCRIPTION_PDF",
        target_patient_id=user.user_id,
        resource=f"/api/patient/consultations/{session_id}/pdf",
        details=f"Patient exported prescription PDF for session {session_id}",
    )

    filename = f"Prescription_{session_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


