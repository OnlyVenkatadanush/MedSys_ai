"""Doctor Router: Patient Switcher, Timeline, Consultation Management & AI Decision Support."""

from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_db
from app.models_v2 import (
    ConsultationCreateIn,
    ConsultationFinalizeIn,
    ConsultationSession,
    DoctorPatientAssignment,
    MedicationSchedule,
)
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, require_role, verify_patient_access
from app.services.doctor_ai_service import generate_doctor_ai_support

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


def _ensure_mock_assignments(doctor_id: str):
    """Seed initial sample patients if doctor has no active patient assignments."""
    db = get_db()
    existing = db.doctor_patient_assignments.count_documents({"doctor_id": doctor_id})
    if existing == 0:
        sample_patients = [
            {
                "id": "asgn_01",
                "doctor_id": doctor_id,
                "patient_id": "pat_01",
                "patient_name": "John Doe",
                "patient_age": 42,
                "patient_gender": "Male",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
            },
            {
                "id": "asgn_02",
                "doctor_id": doctor_id,
                "patient_id": "pat_02",
                "patient_name": "Emma Watson",
                "patient_age": 29,
                "patient_gender": "Female",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
            },
            {
                "id": "asgn_03",
                "doctor_id": doctor_id,
                "patient_id": "pat_03",
                "patient_name": "Robert Chen",
                "patient_age": 61,
                "patient_gender": "Male",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
            },
        ]
        db.doctor_patient_assignments.insert_many(sample_patients)


@router.get("/patients", response_model=List[DoctorPatientAssignment])
async def get_assigned_patients(
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Returns list of patients assigned to the authorized doctor."""
    db = get_db()
    _ensure_mock_assignments(user.user_id)
    
    assignments = list(db.doctor_patient_assignments.find(
        {"doctor_id": user.user_id, "status": "active"}, {"_id": 0}
    ))
    
    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="LIST_ASSIGNED_PATIENTS",
        target_patient_id="ALL",
        resource="/api/doctor/patients",
        details=f"Retrieved {len(assignments)} assigned patients",
    )
    return assignments


@router.get("/patient/{patient_id}/timeline")
async def get_patient_timeline(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Retrieves full clinical timeline for authorized patient."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to access patient medical timeline",
        )

    db = get_db()
    consultations = list(db.consultation_sessions.find({"patient_id": patient_id}, {"_id": 0}))
    lab_reports = list(db.lab_reports.find({"patient_id": patient_id}, {"_id": 0}))
    medications = list(db.medication_schedules.find({"patient_id": patient_id, "active": True}, {"_id": 0}))
    patient_profile = db.profiles.find_one({"userId": patient_id}, {"_id": 0}) or {
        "fullName": "John Doe",
        "age": 42,
        "weightKg": 75,
        "heightCm": 178,
        "bloodGroup": "O+",
        "conditions": ["Mild Hypertension"],
        "medications": [{"name": "Lisinopril", "dosage": "10 mg"}],
        "emergencyContact": {"name": "Jane Doe", "relation": "Spouse", "phone": "+1-555-0199"},
    }

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="READ_PATIENT_TIMELINE",
        target_patient_id=patient_id,
        resource=f"/api/doctor/patient/{patient_id}/timeline",
    )

    return {
        "patient_id": patient_id,
        "profile": patient_profile,
        "consultations": consultations,
        "lab_reports": lab_reports,
        "active_medications": medications,
    }


@router.post("/consultations", response_model=ConsultationSession)
async def create_consultation_session(
    payload: ConsultationCreateIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Creates a new clinical consultation session in draft state."""
    if not verify_patient_access(payload.patient_id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized doctor access to patient",
        )

    db = get_db()
    session_id = f"cs_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    patient_asgn = db.doctor_patient_assignments.find_one({"patient_id": payload.patient_id})
    patient_name = patient_asgn["patient_name"] if patient_asgn else "John Doe"

    session = ConsultationSession(
        id=session_id,
        patient_id=payload.patient_id,
        doctor_id=user.user_id,
        doctor_name=user.full_name,
        patient_name=patient_name,
        created_at=now,
        updated_at=now,
        status="draft",
        symptoms=payload.symptoms,
        vitals=payload.vitals,
        doctor_notes=payload.doctor_notes or "",
    )

    db.consultation_sessions.insert_one(session.model_dump())

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="CREATE_CONSULTATION",
        target_patient_id=payload.patient_id,
        resource=f"/api/doctor/consultations/{session_id}",
    )

    return session


@router.post("/consultations/{session_id}/ai-assist", response_model=ConsultationSession)
async def trigger_ai_decision_support(
    session_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Triggers the AI Clinical Decision Support Engine on a consultation session."""
    db = get_db()
    raw_session = db.consultation_sessions.find_one({"id": session_id}, {"_id": 0})
    if not raw_session:
        raise HTTPException(status_code=404, detail="Consultation session not found")

    session = ConsultationSession(**raw_session)
    if not verify_patient_access(session.patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    # Generate AI decision support
    ai_suggestions = await generate_doctor_ai_support(
        patient_name=session.patient_name or "Patient",
        age=42,
        symptoms=session.symptoms,
        vitals=session.vitals,
        doctor_notes=session.doctor_notes,
    )

    session.ai_suggestions = ai_suggestions
    session.updated_at = datetime.now(timezone.utc).isoformat()

    db.consultation_sessions.update_one(
        {"id": session_id},
        {"$set": {"ai_suggestions": ai_suggestions.model_dump(), "updated_at": session.updated_at}},
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="GENERATE_AI_DECISION_SUPPORT",
        target_patient_id=session.patient_id,
        resource=f"/api/doctor/consultations/{session_id}/ai-assist",
        details=f"Generated AI suggestions with urgency level: {ai_suggestions.urgency_level}",
    )

    return session


@router.post("/consultations/{session_id}/finalize", response_model=ConsultationSession)
async def finalize_consultation_session(
    session_id: str,
    payload: ConsultationFinalizeIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Doctor signs off on diagnosis, prescriptions, and advice (publishes to patient dashboard)."""
    db = get_db()
    raw_session = db.consultation_sessions.find_one({"id": session_id}, {"_id": 0})
    if not raw_session:
        raise HTTPException(status_code=404, detail="Consultation session not found")

    session = ConsultationSession(**raw_session)
    if not verify_patient_access(session.patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    now = datetime.now(timezone.utc).isoformat()
    session.doctor_diagnosis = payload.doctor_diagnosis
    session.prescriptions = payload.prescriptions
    session.doctor_notes = payload.doctor_notes
    session.diet_recommendations = payload.diet_recommendations
    session.follow_up_date = payload.follow_up_date
    session.status = "finalized"
    session.signed_off_at = now
    session.updated_at = now

    db.consultation_sessions.update_one(
        {"id": session_id},
        {"$set": session.model_dump()},
    )

    # Automatically sync active prescriptions into patient MedicationSchedules
    for rx in payload.prescriptions:
        med_id = f"med_{uuid.uuid4().hex[:10]}"
        med_schedule = MedicationSchedule(
            id=med_id,
            patient_id=session.patient_id,
            medication_name=rx.medication_name,
            dosage=rx.dosage,
            frequency=rx.frequency,
            times_per_day=2 if "twice" in rx.frequency.lower() else 1,
            start_date=now[:10],
            active=True,
            prescribed_by_doctor_id=user.user_id,
        )
        db.medication_schedules.insert_one(med_schedule.model_dump())

    # Update patient diet plan if provided
    if payload.diet_recommendations:
        db.diet_plans.update_one(
            {"patient_id": session.patient_id},
            {
                "$set": {
                    "id": f"diet_{session.patient_id}",
                    "patient_id": session.patient_id,
                    "doctor_id": user.user_id,
                    "guidelines": "Doctor Prescribed Nutritional Plan",
                    "allowed_foods": payload.diet_recommendations,
                    "restricted_foods": ["Processed sugar", "High sodium snacks"],
                    "updated_at": now,
                }
            },
            upsert=True,
        )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="FINALIZE_CONSULTATION_DOCTOR_SIGNOFF",
        target_patient_id=session.patient_id,
        resource=f"/api/doctor/consultations/{session_id}/finalize",
        details=f"Doctor signed off on diagnosis: {payload.doctor_diagnosis}",
    )

    return session
