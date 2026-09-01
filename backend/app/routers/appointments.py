"""Appointment Management Router for MedSys AI 2.0.

Implements two-way Patient-Doctor Appointment Lifecycle:
1. Patient checks Doctor Availability & Schedule Slots (Available vs Busy).
2. Patient submits Appointment Request (status = 'requested').
3. Doctor reviews incoming requests in Doctor Appointments Center and Accepts (confirms), Declines, or Completes.
4. Persists to MongoDB Atlas (appointments collection) with audit logging.
"""

from datetime import datetime, timezone
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.db import get_doctor_db, get_patient_db
from app.models_v2 import AppointmentCreateIn, AppointmentRecord
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, get_current_user, require_role

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


class TimeSlot(BaseModel):
    time: str
    status: str  # "available" or "busy"
    appointment_id: Optional[str] = None


class DoctorAvailabilityOut(BaseModel):
    doctor_id: str
    doctor_name: str
    date: str
    slots: List[TimeSlot]


class AppointmentActionIn(BaseModel):
    action: str = Field(..., example="confirm")  # confirm, decline, complete, cancel
    notes: Optional[str] = ""


# Default daily schedule slots
DEFAULT_DAILY_SLOTS = [
    "09:00 AM",
    "10:00 AM",
    "11:30 AM",
    "02:00 PM",
    "03:30 PM",
    "04:30 PM",
]


@router.get("/availability", response_model=DoctorAvailabilityOut)
async def get_doctor_availability(
    doctor_id: str = Query("doc_01"),
    date: str = Query("2026-09-05"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Returns Doctor's available and booked time slots for a given date so patient can select an available slot."""
    db = get_patient_db()

    # Get doctor name
    doc_row = get_doctor_db().doctors.find_one({"id": doctor_id}, {"_id": 0})
    doc_name = doc_row["name"] if doc_row else "Dr. Sarah Smith, MD"

    # Query existing appointments for this doctor on this date
    appts = list(db.appointments.find(
        {
            "doctor_id": doctor_id,
            "appointment_date": {"$regex": f"^{date}"},
            "status": {"$in": ["requested", "confirmed"]},
        },
        {"_id": 0, "id": 1, "appointment_date": 1, "status": 1},
    ))

    booked_times = {}
    for a in appts:
        appt_date_str = a["appointment_date"]
        # extract time if stored like "2026-09-05T10:00:00" or "09:00 AM"
        for slot in DEFAULT_DAILY_SLOTS:
            if slot in appt_date_str or (slot.startswith("09") and "09:00" in appt_date_str) or (slot.startswith("10") and "10:00" in appt_date_str):
                booked_times[slot] = a["id"]

    slots = []
    for slot in DEFAULT_DAILY_SLOTS:
        if slot in booked_times:
            slots.append(TimeSlot(time=slot, status="busy", appointment_id=booked_times[slot]))
        else:
            slots.append(TimeSlot(time=slot, status="available"))

    return DoctorAvailabilityOut(
        doctor_id=doctor_id,
        doctor_name=doc_name,
        date=date,
        slots=slots,
    )


@router.post("/request", response_model=AppointmentRecord)
async def request_appointment(
    payload: AppointmentCreateIn,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Patient Endpoint: Submits an appointment request to the doctor."""
    db = get_patient_db()

    patient_id = user.user_id if user.role == "patient" else "pat_01"
    doctor_id = payload.doctor_id or "doc_01"

    # Fetch Patient Name
    p_row = db.patients.find_one({"id": patient_id}, {"_id": 0})
    patient_name = p_row["name"] if p_row else user.full_name

    # Fetch Doctor Name
    d_row = get_doctor_db().doctors.find_one({"id": doctor_id}, {"_id": 0})
    doctor_name = d_row["name"] if d_row else "Dr. Sarah Smith, MD"

    appt_id = f"apt_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    db.appointments.insert_one({
        "id": appt_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "patient_name": patient_name,
        "doctor_name": doctor_name,
        "appointment_date": payload.appointment_date,
        "reason": payload.reason,
        "status": "requested",
        "notes": payload.notes or "",
        "created_at": now,
    })

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="REQUEST_APPOINTMENT",
        target_patient_id=patient_id,
        resource=f"/api/appointments/{appt_id}",
        details=f"Patient requested appointment with {doctor_name} for {payload.appointment_date}",
    )

    return AppointmentRecord(
        id=appt_id,
        patient_id=patient_id,
        doctor_id=doctor_id,
        patient_name=patient_name,
        doctor_name=doctor_name,
        appointment_date=payload.appointment_date,
        reason=payload.reason,
        status="requested",
        notes=payload.notes or "",
        created_at=now,
    )


@router.get("/doctor-queue", response_model=List[AppointmentRecord])
async def list_doctor_appointments(
    status_filter: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Doctor Endpoint: Lists incoming appointment requests & scheduled appointments for approval."""
    db = get_patient_db()

    if db.appointments.count_documents({"doctor_id": user.user_id}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        db.appointments.insert_many([
            {
                "id": f"apt_{uuid.uuid4().hex[:10]}",
                "patient_id": "pat_01",
                "doctor_id": user.user_id,
                "patient_name": "John Doe",
                "doctor_name": user.full_name,
                "appointment_date": "2026-09-05T10:00:00Z",
                "reason": "Blood Pressure Routine Follow-up & Medication Renewal",
                "status": "requested",
                "notes": "Patient requested morning slot.",
                "created_at": now,
            },
            {
                "id": f"apt_{uuid.uuid4().hex[:10]}",
                "patient_id": "pat_02",
                "doctor_id": user.user_id,
                "patient_name": "Emma Watson",
                "doctor_name": user.full_name,
                "appointment_date": "2026-09-06T14:30:00Z",
                "reason": "Asthma Symptom Evaluation & Inhaler Review",
                "status": "confirmed",
                "notes": "Confirmed by clinician.",
                "created_at": now,
            },
        ])

    query = {"doctor_id": user.user_id}
    if status_filter:
        query["status"] = status_filter

    rows = list(db.appointments.find(query, {"_id": 0}).sort("created_at", -1))

    return [
        AppointmentRecord(
            id=r["id"],
            patient_id=r["patient_id"],
            doctor_id=r["doctor_id"],
            patient_name=r.get("patient_name") or "Patient Record",
            doctor_name=r.get("doctor_name") or user.full_name,
            appointment_date=r.get("appointment_date") or r.get("date_time", ""),
            reason=r.get("reason") or "Routine Visit",
            status=r.get("status", "requested"),
            notes=r.get("notes") or "",
            created_at=r.get("created_at", ""),
        )
        for r in rows
    ]


@router.get("/patient-queue", response_model=List[AppointmentRecord])
async def list_patient_appointments(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Patient Endpoint: Lists all appointment requests & confirmed bookings for current patient."""
    db = get_patient_db()

    patient_id = user.user_id if user.role == "patient" else "pat_01"

    if db.appointments.count_documents({"patient_id": patient_id}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        db.appointments.insert_one({
            "id": f"apt_{uuid.uuid4().hex[:10]}",
            "patient_id": patient_id,
            "doctor_id": "doc_01",
            "patient_name": user.full_name or "Patient",
            "doctor_name": "Dr. Sarah Smith",
            "appointment_date": "2026-09-05T10:00:00Z",
            "reason": "Routine Follow-up & Blood Pressure Check",
            "status": "requested",
            "notes": "Awaiting doctor confirmation.",
            "created_at": now,
        })

    rows = list(db.appointments.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1))

    return [
        AppointmentRecord(
            id=r["id"],
            patient_id=r["patient_id"],
            doctor_id=r["doctor_id"],
            patient_name=r.get("patient_name") or user.full_name,
            doctor_name=r.get("doctor_name") or "Dr. Sarah Smith",
            appointment_date=r.get("appointment_date") or r.get("date_time", ""),
            reason=r.get("reason") or "Clinical Consultation",
            status=r.get("status", "requested"),
            notes=r.get("notes") or "",
            created_at=r.get("created_at", ""),
        )
        for r in rows
    ]


@router.post("/{appointment_id}/action", response_model=AppointmentRecord)
async def process_appointment_action(
    appointment_id: str,
    payload: AppointmentActionIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Doctor Endpoint: Doctor accepts (confirms), declines, or completes an appointment request."""
    db = get_patient_db()

    row = db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Appointment record not found.")

    new_status = row["status"]
    if payload.action == "confirm":
        new_status = "confirmed"
    elif payload.action in ("decline", "cancel"):
        new_status = "cancelled"
    elif payload.action == "complete":
        new_status = "completed"

    new_notes = payload.notes or row.get("notes") or ""

    db.appointments.update_one({"id": appointment_id}, {"$set": {"status": new_status, "notes": new_notes}})
    updated_row = db.appointments.find_one({"id": appointment_id}, {"_id": 0})

    log_audit_event(
        actor_id=user.user_id,
        actor_role="doctor",
        action=f"APPOINTMENT_{payload.action.upper()}",
        target_patient_id=updated_row["patient_id"],
        resource=f"/api/appointments/{appointment_id}",
        details=f"Doctor {user.full_name} set appointment status to {new_status}",
    )

    return AppointmentRecord(
        id=updated_row["id"],
        patient_id=updated_row["patient_id"],
        doctor_id=updated_row["doctor_id"],
        patient_name=updated_row["patient_name"],
        doctor_name=updated_row["doctor_name"],
        appointment_date=updated_row["appointment_date"],
        reason=updated_row["reason"],
        status=updated_row["status"],
        notes=updated_row["notes"] or "",
        created_at=updated_row["created_at"],
    )
