"""Authentication, Doctor Registration, Patient Onboarding Wizard & Activation Router.

Implements:
- Doctor Account Registration
- 3-Step Patient Onboarding Wizard (Height, Weight, Age, Auto PAT-000124) —
  creates the patient fully ACTIVE immediately, no email invitation step
- Legacy invitation/activation endpoints (kept for any patient record still
  carrying an unconsumed invitation from before this wizard changed)
"""

from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.db import get_doctor_db, get_patient_db
from app.models_v2 import (
    DoctorRegistrationIn,
    PatientActivationIn,
    PatientSelfRegistrationIn,
    PatientWizardCreateIn,
    PatientWizardOut,
)
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import (
    AuthenticatedUser,
    ClerkIdentity,
    get_current_user,
    require_role,
    require_verified_clerk_session,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def calculate_age(dob_str: str) -> int:
    """Calculates age in years from DOB YYYY-MM-DD."""
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        today = datetime.now()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 35


@router.get("/me")
async def get_me(user: AuthenticatedUser = Depends(get_current_user)) -> dict:
    """Tells the frontend whether the signed-in account has a real linked
    doctor/patient record yet. `get_current_user` falls back to the raw
    Clerk id as `user_id` when nothing is linked — so `user_id != clerk_id`
    is exactly "a real profile exists". Demo-mode sessions always have one
    (auto-provisioned on first use), so this only ever gates real Clerk
    logins into the one-time registration screen."""
    return {
        "role": user.role,
        "hasProfile": user.user_id != user.clerk_id,
        "fullName": user.full_name,
        "email": user.email,
    }


@router.post("/register-patient")
async def register_patient_account(
    payload: PatientSelfRegistrationIn,
    identity: ClerkIdentity = Depends(require_verified_clerk_session),
):
    """Self-serve patient registration: links the signed-in Clerk account to
    a new (or existing) patient document in MongoDB Atlas — the organic
    counterpart to `add_patient_wizard`, which only creates patients a
    doctor has explicitly invited."""
    db = get_patient_db()

    already_linked = db.patients.find_one(
        {"clerk_id": identity.clerk_id}, {"_id": 0, "id": 1, "name": 1, "email": 1}
    )
    if already_linked:
        return {
            "patient_id": already_linked["id"],
            "name": already_linked["name"],
            "email": already_linked["email"],
            "message": "This Clerk account is already registered as a patient.",
        }

    already_linked_as_doctor = get_doctor_db().doctors.find_one(
        {"clerk_id": identity.clerk_id}, {"_id": 0, "id": 1}
    )
    if already_linked_as_doctor:
        raise HTTPException(
            status_code=400,
            detail="This Google account is already registered as a Doctor. Sign in through the Doctor portal, or use a different account to register as a Patient.",
        )

    # A doctor's Add Patient Wizard creates a fully active patient record
    # directly (no email invitation step — see add_patient_wizard), so it
    # never has a clerk_id of its own yet. If the real patient now signs up
    # here with the same email, link this Clerk account to that existing
    # record instead of blocking on "already exists" — this is the only way
    # a doctor-created patient ever gets portal access. Doctor-entered
    # clinical data (conditions, allergies, etc.) is left untouched; only
    # the identity link is added.
    unclaimed = db.patients.find_one({"email": payload.email.lower(), "clerk_id": {"$exists": False}})
    if unclaimed:
        db.patients.update_one({"id": unclaimed["id"]}, {"$set": {"clerk_id": identity.clerk_id}})
        log_audit_event(
            actor_id=unclaimed["id"],
            actor_role="patient",
            action="CLAIM_PATIENT_ACCOUNT",
            target_patient_id=unclaimed["id"],
            resource="/api/auth/register-patient",
            details=f"Patient claimed doctor-created record {unclaimed.get('patient_id_code')} via Clerk sign-up.",
        )
        return {
            "patient_id": unclaimed["id"],
            "patient_id_code": unclaimed.get("patient_id_code", ""),
            "name": unclaimed["name"],
            "email": unclaimed["email"],
            "message": "Linked to your existing patient record.",
        }

    if db.patients.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="A patient account with this email already exists.")

    patient_id = f"pat_{uuid.uuid4().hex[:10]}"
    count = db.patients.count_documents({}) + 127
    pat_code = f"PAT-{count:06d}"
    age = calculate_age(payload.dob)
    now = datetime.now(timezone.utc).isoformat()

    db.patients.insert_one({
        "id": patient_id,
        "patient_id_code": pat_code,
        "name": payload.full_name,
        "dob": payload.dob,
        "age": age,
        "gender": payload.gender,
        "blood_group": payload.blood_group,
        "height_cm": payload.height_cm or 170.0,
        "weight_kg": payload.weight_kg or 70.0,
        "phone": payload.phone or "",
        "email": payload.email.lower(),
        "emergency_contact_name": payload.emergency_contact_name or "",
        "emergency_contact_phone": payload.emergency_contact_phone or "",
        "account_state": "ACTIVE",
        "created_at": now,
        "clerk_id": identity.clerk_id,
    })

    # Mirror into the legacy `profiles` collection too — Chat/Profile.tsx
    # (the "Home"/"Chat"/"Profile" sidebar pages) read patient details from
    # there via `clerkUserId`, which resolves to this patient's `id` (not
    # the raw Clerk id) once this record is linked — see
    # `clerk_auth.get_current_user`. Without this, the Profile page would
    # keep showing the generic placeholder ("John Doe", 170cm, 70kg)
    # instead of what was just entered.
    height_m = (payload.height_cm or 170.0) / 100
    bmi = round((payload.weight_kg or 70.0) / (height_m * height_m), 1) if height_m > 0 else 0.0
    db.profiles.update_one(
        {"clerkUserId": patient_id},
        {"$set": {
            "clerkUserId": patient_id,
            "fullName": payload.full_name,
            "age": age,
            "weightKg": payload.weight_kg or 70.0,
            "heightCm": payload.height_cm or 170.0,
            "bmi": bmi,
            "bloodGroup": payload.blood_group,
            "conditions": [],
            "medications": [],
            "emergencyContact": {
                "name": payload.emergency_contact_name or "",
                "relation": "",
                "phone": payload.emergency_contact_phone or "",
            },
        }},
        upsert=True,
    )

    # Auto-assign every brand-new self-registered patient to every doctor
    # currently in the system, so they show up in My Patients immediately —
    # no manual Add Patient Wizard / Link Existing Patient step needed. This
    # does NOT run for the "claim an existing record" branch above (that
    # patient was already assigned by the doctor who created them via the
    # wizard), and demo-mode patients are never touched (see
    # clerk_auth._provision_demo_account) — only a real self-registration
    # through this endpoint triggers it.
    for doc in get_doctor_db().doctors.find({}, {"_id": 0, "id": 1}):
        db.doctor_patient.insert_one({
            "id": f"asgn_{uuid.uuid4().hex[:10]}",
            "doctor_id": doc["id"],
            "patient_id": patient_id,
            "assigned_at": now,
            "status": "active",
        })

    log_audit_event(
        actor_id=patient_id,
        actor_role="patient",
        action="REGISTER_PATIENT_ACCOUNT",
        target_patient_id=patient_id,
        resource="/api/auth/register-patient",
        details=f"Patient account self-registered: {payload.full_name} ({pat_code})",
    )

    return {
        "patient_id": patient_id,
        "patient_id_code": pat_code,
        "name": payload.full_name,
        "email": payload.email,
        "message": "Patient account registered successfully.",
    }


@router.post("/register-doctor")
async def register_doctor_account(
    payload: DoctorRegistrationIn,
    identity: ClerkIdentity = Depends(require_verified_clerk_session),
):
    """Doctor Registration: links the signed-in Clerk account to a new (or
    existing) doctor document in MongoDB Atlas. Requires a completed Clerk
    sign-up first — see `require_verified_clerk_session`."""
    db = get_doctor_db()

    already_linked = db.doctors.find_one(
        {"clerk_id": identity.clerk_id}, {"_id": 0, "id": 1, "name": 1, "email": 1}
    )
    if already_linked:
        return {
            "doctor_id": already_linked["id"],
            "name": already_linked["name"],
            "email": already_linked["email"],
            "message": "This Clerk account is already registered as a doctor.",
        }

    already_linked_as_patient = get_patient_db().patients.find_one(
        {"clerk_id": identity.clerk_id}, {"_id": 0, "id": 1}
    )
    if already_linked_as_patient:
        raise HTTPException(
            status_code=400,
            detail="This Google account is already registered as a Patient. Sign in through the Patient portal, or use a different account to register as a Doctor.",
        )

    if db.doctors.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="A doctor account with this email already exists.")

    doc_id = f"doc_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    db.doctors.insert_one({
        "id": doc_id,
        "name": payload.full_name,
        "email": payload.email.lower(),
        "phone": payload.phone,
        "specialization": payload.specialization,
        "license_number": payload.license_number,
        "hospital_name": payload.hospital_name or "MedSys Hospital Network",
        "experience_years": payload.experience_years or 5,
        "created_at": now,
        "clerk_id": identity.clerk_id,
    })

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
    """3-Step Patient Onboarding Wizard executed by Doctor:
    1. Creates patient record with auto-generated Patient ID (PAT-000XXX), DOB, Age, Height (cm), Weight (kg).
    2. Records Blood Group, Allergies, Chronic Conditions, Emergency Contact.
    3. Records initial clinical intake notes.
    The patient is created fully ACTIVE immediately — no email invitation
    step. If this patient later signs up for the portal themselves with the
    same email, register_patient_account links their Clerk account to this
    same record rather than creating a duplicate or blocking them.
    """
    db = get_patient_db()
    doctor_db = get_doctor_db()

    if db.patients.find_one({"email": payload.identity.email.lower()}):
        raise HTTPException(status_code=400, detail="A patient with this email address already exists.")

    patient_id = f"pat_{uuid.uuid4().hex[:10]}"

    # Auto-generate PAT-000XXX code
    count = db.patients.count_documents({}) + 127
    pat_code = f"PAT-{count:06d}"

    full_name = f"{payload.identity.first_name.strip()} {payload.identity.last_name.strip()}"
    age = calculate_age(payload.identity.dob)
    now = datetime.now(timezone.utc).isoformat()

    # Step 1: Insert into patients collection
    db.patients.insert_one({
        "id": patient_id,
        "patient_id_code": pat_code,
        "name": full_name,
        "dob": payload.identity.dob,
        "age": age,
        "gender": payload.identity.gender,
        "blood_group": payload.medical.blood_group,
        "height_cm": payload.identity.height_cm or 170.0,
        "weight_kg": payload.identity.weight_kg or 70.0,
        "phone": payload.identity.phone,
        "email": payload.identity.email.lower(),
        "emergency_contact_name": payload.medical.emergency_contact_name or "",
        "emergency_contact_phone": payload.medical.emergency_contact_phone or "",
        "account_state": "ACTIVE",
        "created_at": now,
    })

    # Step 2: Create Doctor-Patient RBAC Assignment
    if not doctor_db.doctors.find_one({"id": user.user_id}):
        # user.user_id is a raw Clerk id here (this doctor hasn't gone
        # through /register-doctor) — link clerk_id too so the next request
        # resolves this same row via clerk_auth._find_by_clerk_id instead of
        # relying on id == clerk_id by coincidence.
        doctor_db.doctors.insert_one({
            "id": user.user_id,
            "name": user.full_name,
            "email": user.email,
            "phone": "+1-555-0100",
            "specialization": "Cardiology & Internal Medicine",
            "license_number": "MD-994821",
            "hospital_name": "St. Jude Medical Center",
            "experience_years": 10,
            "created_at": now,
            "clerk_id": user.clerk_id,
        })

    db.doctor_patient.insert_one({
        "id": f"asgn_{uuid.uuid4().hex[:10]}",
        "doctor_id": user.user_id,
        "patient_id": patient_id,
        "assigned_at": now,
        "status": "active",
    })

    # Step 3: Insert Conditions & Allergies
    for cond in payload.medical.conditions:
        if cond.get("condition_name"):
            db.patient_conditions.insert_one({
                "id": f"cond_{uuid.uuid4().hex[:10]}",
                "patient_id": patient_id,
                "condition_name": cond["condition_name"],
                "diagnosed_date": now[:10],
                "status": "active",
            })

    for alg in payload.medical.allergies:
        if alg.get("allergen"):
            db.allergies.insert_one({
                "id": f"alg_{uuid.uuid4().hex[:10]}",
                "patient_id": patient_id,
                "allergen": alg["allergen"],
                "reaction": alg.get("reaction", "Reaction noted"),
                "severity": alg.get("severity", "moderate"),
            })

    # Step 4: Insert Initial Clinical Consultation Notes if provided
    if payload.clinical and (payload.clinical.initial_symptoms or payload.clinical.initial_doctor_notes):
        db.consultations.insert_one({
            "id": f"cs_{uuid.uuid4().hex[:10]}",
            "patient_id": patient_id,
            "doctor_id": user.user_id,
            "symptoms": payload.clinical.initial_symptoms or "Initial Intake",
            "doctor_notes": payload.clinical.initial_doctor_notes or "",
            "status": "draft",
            "created_at": now,
        })

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="CREATE_PATIENT_WIZARD",
        target_patient_id=patient_id,
        resource="/api/auth/add-patient-wizard",
        details=f"Doctor created active patient record {pat_code} ({full_name}).",
    )

    return PatientWizardOut(
        patient_id=patient_id,
        patient_id_code=pat_code,
        name=full_name,
        email=payload.identity.email,
        account_state="ACTIVE",
        message=f"Patient record {pat_code} created successfully.",
    )


@router.get("/invitation/{token}")
async def get_invitation_details(token: str):
    """Verifies patient invitation token and returns account details for activation screen."""
    db = get_patient_db()

    inv = db.patient_invitations.find_one({"invitation_token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation token.")

    patient = db.patients.find_one({"id": inv["patient_id"]}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation token.")

    return {
        "invitation_token": token,
        "patient_id": patient["id"],
        "patient_id_code": patient["patient_id_code"],
        "name": patient["name"],
        "email": patient["email"],
        "account_state": patient["account_state"],
    }


@router.post("/activate-patient")
async def activate_patient_account(
    payload: PatientActivationIn,
    identity: ClerkIdentity = Depends(require_verified_clerk_session),
):
    """Patient Account Activation: links the signed-in Clerk account (created
    with the invited email) to the patient record created by the doctor's
    onboarding wizard. Clerk owns credentials now — there is no separate
    password to store here. Updates account state from PENDING_ACTIVATION to ACTIVE.
    """
    db = get_patient_db()

    inv = db.patient_invitations.find_one(
        {"invitation_token": payload.invitation_token, "status": "pending"}
    )
    if not inv:
        raise HTTPException(status_code=400, detail="Invalid, expired, or already activated invitation token.")

    patient_id = inv["patient_id"]

    patient = db.patients.find_one({"id": patient_id}, {"_id": 0, "email": 1, "clerk_id": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found.")
    if patient.get("clerk_id") and patient["clerk_id"] != identity.clerk_id:
        raise HTTPException(status_code=400, detail="This patient record is already linked to a different account.")
    if identity.email and patient.get("email") and identity.email.lower() != patient["email"].lower():
        raise HTTPException(status_code=400, detail="Signed-in email does not match the invited patient email.")

    now = datetime.now(timezone.utc).isoformat()

    db.patients.update_one(
        {"id": patient_id}, {"$set": {"account_state": "ACTIVE", "clerk_id": identity.clerk_id}}
    )
    db.patient_invitations.update_one(
        {"invitation_token": payload.invitation_token}, {"$set": {"status": "activated"}}
    )

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
