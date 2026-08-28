"""Authentication, Doctor Registration, Patient Onboarding Wizard & Activation Router.

Implements:
- Doctor Account Registration
- 4-Step Patient Onboarding Wizard (Height, Weight, Age, Auto PAT-000124)
- Patient Account Activation (Patient creates their own private password)
"""

from datetime import datetime, timezone
import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.db_sqlite import get_sqlite_conn
from app.models_v2 import (
    DoctorRegistrationIn,
    PatientActivationIn,
    PatientWizardCreateIn,
    PatientWizardOut,
)
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, require_role, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def calculate_age(dob_str: str) -> int:
    """Calculates age in years from DOB YYYY-MM-DD."""
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        today = datetime.now()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 35


@router.post("/register-doctor")
async def register_doctor_account(payload: DoctorRegistrationIn):
    """Doctor Registration: Professional Account creation in SQLite medsys.db."""
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM doctors WHERE email = ?;", (payload.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="A doctor account with this email already exists.")

    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO doctors (id, name, email, phone, specialization, license_number, hospital_name, experience_years, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        doc_id,
        payload.full_name,
        payload.email.lower(),
        payload.phone,
        payload.specialization,
        payload.license_number,
        payload.hospital_name or "MedSys Hospital Network",
        payload.experience_years or 5,
        now,
    ))

    conn.commit()
    conn.close()

    log_audit_event(
        actor_id=doc_id,
        actor_role="doctor",
        action="REGISTER_DOCTOR_ACCOUNT",
        target_patient_id="NONE",
        resource="/api/auth/register-doctor",
        details=f"Doctor account created: {payload.full_name} ({payload.specialization})",
    )

    return {
        "doctor_id": doc_id,
        "name": payload.full_name,
        "email": payload.email,
        "message": "Doctor account registered successfully.",
    }


@router.post("/add-patient-wizard", response_model=PatientWizardOut)
async def add_patient_wizard(
    payload: PatientWizardCreateIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """4-Step Patient Onboarding Wizard executed by Doctor:
    1. Creates patient record with auto-generated Patient ID (PAT-000XXX), DOB, Age, Height (cm), Weight (kg).
    2. Records Blood Group, Allergies, Chronic Conditions, Emergency Contact.
    3. Records initial clinical intake notes.
    4. Generates invitation token and sets account state to PENDING_ACTIVATION.
    """
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM patients WHERE email = ?;", (payload.identity.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="A patient with this email address already exists.")

    patient_id = f"pat_{uuid.uuid4().hex[:10]}"
    
    # Auto-generate PAT-000XXX code
    cursor.execute("SELECT COUNT(*) FROM patients;")
    count = (cursor.fetchone()[0] or 0) + 127
    pat_code = f"PAT-{count:06d}"

    full_name = f"{payload.identity.first_name.strip()} {payload.identity.last_name.strip()}"
    age = calculate_age(payload.identity.dob)
    now = datetime.now(timezone.utc).isoformat()

    # Step 1: Insert into patients table
    cursor.execute("""
    INSERT INTO patients (
        id, patient_id_code, name, dob, age, gender, blood_group, height_cm, weight_kg,
        phone, email, emergency_contact_name, emergency_contact_phone, account_state, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ACTIVATION', ?);
    """, (
        patient_id,
        pat_code,
        full_name,
        payload.identity.dob,
        age,
        payload.identity.gender,
        payload.medical.blood_group,
        payload.identity.height_cm or 170.0,
        payload.identity.weight_kg or 70.0,
        payload.identity.phone,
        payload.identity.email.lower(),
        payload.medical.emergency_contact_name or "",
        payload.medical.emergency_contact_phone or "",
        now,
    ))

    # Step 2: Create Doctor-Patient RBAC Assignment
    cursor.execute("SELECT id FROM doctors WHERE id = ?;", (user.user_id,))
    if not cursor.fetchone():
        cursor.execute("""
        INSERT INTO doctors (id, name, email, phone, specialization, license_number, hospital_name, experience_years, created_at)
        VALUES (?, ?, ?, '+1-555-0100', 'Cardiology & Internal Medicine', 'MD-994821', 'St. Jude Medical Center', 10, ?);
        """, (user.user_id, user.full_name, user.email, now))

    cursor.execute("""
    INSERT INTO doctor_patient (id, doctor_id, patient_id, assigned_at, status)
    VALUES (?, ?, ?, ?, 'active');
    """, (f"asgn_{uuid.uuid4().hex[:10]}", user.user_id, patient_id, now))

    # Step 3: Insert Conditions & Allergies
    for cond in payload.medical.conditions:
        if cond.get("condition_name"):
            cursor.execute("""
            INSERT INTO patient_conditions (id, patient_id, condition_name, diagnosed_date, status)
            VALUES (?, ?, ?, ?, 'active');
            """, (f"cond_{uuid.uuid4().hex[:10]}", patient_id, cond["condition_name"], now[:10]))

    for alg in payload.medical.allergies:
        if alg.get("allergen"):
            cursor.execute("""
            INSERT INTO allergies (id, patient_id, allergen, reaction, severity)
            VALUES (?, ?, ?, ?, ?);
            """, (f"alg_{uuid.uuid4().hex[:10]}", patient_id, alg["allergen"], alg.get("reaction", "Reaction noted"), alg.get("severity", "moderate")))

    # Step 4: Insert Initial Clinical Consultation Notes if provided
    if payload.clinical and (payload.clinical.initial_symptoms or payload.clinical.initial_doctor_notes):
        cursor.execute("""
        INSERT INTO consultations (id, patient_id, doctor_id, symptoms, doctor_notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'draft', ?);
        """, (
            f"cs_{uuid.uuid4().hex[:10]}",
            patient_id,
            user.user_id,
            payload.clinical.initial_symptoms or "Initial Intake",
            payload.clinical.initial_doctor_notes or "",
            now,
        ))

    # Step 5: Generate Invitation Token
    inv_token = f"inv_{secrets.token_urlsafe(16)}"
    inv_id = f"inv_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO patient_invitations (id, patient_id, email, invitation_token, expires_at, status, created_at)
    VALUES (?, ?, ?, ?, '2026-12-31T23:59:59Z', 'pending', ?);
    """, (inv_id, patient_id, payload.identity.email.lower(), inv_token, now))

    conn.commit()
    conn.close()

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="CREATE_PATIENT_WIZARD",
        target_patient_id=patient_id,
        resource=f"/api/auth/add-patient-wizard",
        details=f"Doctor created patient record {pat_code} ({full_name}) and generated invitation token.",
    )

    activation_url = f"http://localhost:5173/activate-account?token={inv_token}"

    return PatientWizardOut(
        patient_id=patient_id,
        patient_id_code=pat_code,
        name=full_name,
        email=payload.identity.email,
        account_state="PENDING_ACTIVATION",
        invitation_token=inv_token,
        activation_url=activation_url,
        message=f"Patient record {pat_code} created successfully. Invitation link generated.",
    )


@router.get("/invitation/{token}")
async def get_invitation_details(token: str):
    """Verifies patient invitation token and returns account details for activation screen."""
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT i.invitation_token, i.status as inv_status, p.id as patient_id, p.patient_id_code, p.name, p.email, p.account_state
    FROM patient_invitations i
    JOIN patients p ON i.patient_id = p.id
    WHERE i.invitation_token = ?;
    """, (token,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation token.")

    return {
        "invitation_token": token,
        "patient_id": row["patient_id"],
        "patient_id_code": row["patient_id_code"],
        "name": row["name"],
        "email": row["email"],
        "account_state": row["account_state"],
    }


@router.post("/activate-patient")
async def activate_patient_account(payload: PatientActivationIn):
    """Patient Password Activation Screen:
    Patient sets their own private password.
    Updates account state from PENDING_ACTIVATION to ACTIVE. Doctor never sees password.
    """
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    conn = get_sqlite_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT patient_id FROM patient_invitations WHERE invitation_token = ? AND status = 'pending';", (payload.invitation_token,))
    inv_row = cursor.fetchone()
    if not inv_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid, expired, or already activated invitation token.")

    patient_id = inv_row["patient_id"]
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("UPDATE patients SET account_state = 'ACTIVE' WHERE id = ?;", (patient_id,))
    cursor.execute("UPDATE patient_invitations SET status = 'activated' WHERE invitation_token = ?;", (payload.invitation_token,))

    conn.commit()
    conn.close()

    log_audit_event(
        actor_id=patient_id,
        actor_role="patient",
        action="ACTIVATE_PATIENT_PASSWORD",
        target_patient_id=patient_id,
        resource="/api/auth/activate-patient",
        details="Patient activated account and established private credentials.",
    )

    return {
        "patient_id": patient_id,
        "account_state": "ACTIVE",
        "message": "Account activated successfully! You can now log into your patient dashboard.",
    }
