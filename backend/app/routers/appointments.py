"""Appointment Management Router."""

from datetime import datetime, timezone
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.models_v2 import AppointmentCreateIn, AppointmentRecord
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, get_current_user

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("", response_model=List[AppointmentRecord])
async def list_appointments(user: AuthenticatedUser = Depends(get_current_user)):
    """Lists appointments for the authenticated user (patient or doctor)."""
    db = get_db()
    query = {"doctor_id": user.user_id} if user.role == "doctor" else {"patient_id": user.user_id}
    appointments = list(db.appointments.find(query, {"_id": 0}).sort("date_time", 1))
    
    # Seed default appointments if empty
    if len(appointments) == 0:
        now = datetime.now(timezone.utc).isoformat()
        sample_appt = AppointmentRecord(
            id=f"apt_{uuid.uuid4().hex[:10]}",
            patient_id="pat_01",
            doctor_id="doc_01",
            patient_name="John Doe",
            doctor_name="Dr. Sarah Smith, MD",
            date_time="2026-09-05T10:00:00Z",
            reason="Routine Follow-up & Blood Pressure Check",
            status="confirmed",
            created_at=now,
        )
        db.appointments.insert_one(sample_appt.model_dump())
        appointments = [sample_appt]

    return appointments


@router.post("", response_model=AppointmentRecord)
async def create_appointment(
    payload: AppointmentCreateIn,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Requests/books a new appointment."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    
    patient_id = user.user_id if user.role == "patient" else "pat_01"
    doctor_id = payload.doctor_id if user.role == "patient" else user.user_id

    appt = AppointmentRecord(
        id=f"apt_{uuid.uuid4().hex[:10]}",
        patient_id=patient_id,
        doctor_id=doctor_id,
        patient_name=user.full_name if user.role == "patient" else "John Doe",
        doctor_name="Dr. Sarah Smith, MD",
        date_time=payload.date_time,
        reason=payload.reason,
        status="requested",
        created_at=now,
    )

    db.appointments.insert_one(appt.model_dump())

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="CREATE_APPOINTMENT",
        target_patient_id=patient_id,
        resource=f"/api/appointments/{appt.id}",
    )

    return appt


@router.post("/{appointment_id}/status", response_model=AppointmentRecord)
async def update_appointment_status(
    appointment_id: str,
    status: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Updates appointment status (confirmed, completed, cancelled)."""
    db = get_db()
    appt = db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    db.appointments.update_one({"id": appointment_id}, {"$set": {"status": status}})
    appt["status"] = status
    return AppointmentRecord(**appt)
