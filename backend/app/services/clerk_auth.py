"""Verifies Clerk session JWTs on incoming requests and enforces RBAC & Patient Data Isolation.

Identity resolution has exactly two paths, both isolated per-account:
1. A verified Clerk JWT, resolved to the doctors/patients document whose
   `clerk_id` matches the token's `sub` claim (see `_find_by_clerk_id`).
   Role is decided purely by which collection a linked record lives in —
   never by the client-sent `X-User-Role` header — so an unlinked/new Clerk
   identity always resolves to "patient", regardless of what the client
   asks for. A real doctor account still only exists by completing
   `/api/auth/register-doctor`, which is what creates that linked record.
2. Demo mode (`settings.medsys_demo_mode`): a per-browser `X-Demo-Session-Id`
   header is used to auto-provision an isolated demo doctor/patient record on
   first use (see `_provision_demo_account`). Two different demo sessions
   never resolve to the same identity.

There is no third path — no shared hardcoded fallback user.
"""

import uuid
from datetime import datetime, timezone

import jwt
from pydantic import BaseModel
from fastapi import Header, HTTPException, Depends, status
from jwt import PyJWKClient

from app.config import settings
from app.db import get_doctor_db, get_patient_db
from app.models_v2 import UserRole

_jwks_client: PyJWKClient | None = None


class AuthenticatedUser(BaseModel):
    user_id: str
    clerk_id: str
    email: str
    full_name: str
    role: UserRole


class ClerkIdentity(BaseModel):
    """Raw, verified Clerk identity — no linked MedSys account required.

    Used only by the registration/activation endpoints that create that
    link; every other endpoint depends on `get_current_user`/`require_role`
    instead, which require the link to already exist.
    """

    clerk_id: str
    email: str
    full_name: str


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.clerk_issuer:
            raise HTTPException(
                status_code=500,
                detail="Clerk is not configured (missing/invalid CLERK_PUBLISHABLE_KEY)",
            )
        _jwks_client = PyJWKClient(f"{settings.clerk_issuer}/.well-known/jwks.json")
    return _jwks_client


def _decode_bearer_token(authorization: str | None) -> dict | None:
    """Returns verified JWT claims, or None if there's no usable bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token or token == "mock-dev-token":
        return None
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=settings.clerk_issuer,
        options={"require": ["exp", "iat", "sub"]},
        leeway=30,
    )


async def require_verified_clerk_session(
    authorization: str | None = Header(default=None),
) -> ClerkIdentity:
    """Verifies a Clerk session JWT and returns the raw identity claims.

    Used by `/api/auth/register-doctor` and `/api/auth/activate-patient`,
    which must run *before* a doctors/patients row is linked to this Clerk
    account — every other endpoint should depend on `get_current_user` or
    `require_role` instead.
    """
    try:
        claims = _decode_bearer_token(authorization)
    except Exception:
        claims = None
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in with Clerk before continuing.",
        )
    return ClerkIdentity(
        clerk_id=claims["sub"],
        email=claims.get("email") or claims.get("email_address") or "",
        full_name=claims.get("name") or claims.get("full_name") or "",
    )


def _find_by_clerk_id(role: UserRole, clerk_id: str) -> dict | None:
    if role == "doctor":
        return get_doctor_db().doctors.find_one({"clerk_id": clerk_id}, {"_id": 0})
    return get_patient_db().patients.find_one({"clerk_id": clerk_id}, {"_id": 0})


def _provision_demo_account(role: UserRole, demo_session_id: str) -> dict:
    """Auto-creates (or fetches) an isolated demo doctor/patient record keyed
    by a per-browser demo-session id, so distinct demo sessions never
    collide on the same data — unlike the old hardcoded doc_01/pat_01
    fallback."""
    demo_clerk_id = f"demo_{demo_session_id}"
    existing = _find_by_clerk_id(role, demo_clerk_id)
    if existing:
        return existing

    short = demo_session_id.replace("-", "")[:12] or "0"
    now = datetime.now(timezone.utc).isoformat()

    if role == "doctor":
        new_id = f"doc_demo{short}"
        record = {
            "id": new_id,
            "name": f"Dr. Demo {short[:6]}",
            "email": f"demo-doc-{short}@medsys.demo",
            "phone": "",
            "specialization": "General Practice",
            "license_number": "DEMO",
            "hospital_name": "MedSys Demo Clinic",
            "experience_years": 5,
            "created_at": now,
            "is_active": 1,
            "clerk_id": demo_clerk_id,
        }
        get_doctor_db().doctors.insert_one(record)
    else:
        new_id = f"pat_demo{short}"
        record = {
            "id": new_id,
            "patient_id_code": f"PAT-DEMO-{short[:6]}",
            "name": f"Demo Patient {short[:6]}",
            "dob": "1990-01-01",
            "age": 35,
            "gender": "Unspecified",
            "blood_group": "O+",
            "height_cm": 170.0,
            "weight_kg": 70.0,
            "phone": "",
            "email": f"demo-pat-{short}@medsys.demo",
            "emergency_contact_name": "",
            "emergency_contact_phone": "",
            "account_state": "ACTIVE",
            "created_at": now,
            "is_active": 1,
            "clerk_id": demo_clerk_id,
        }
        get_patient_db().patients.insert_one(record)

    record.pop("_id", None)
    return record


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_demo_session_id: str | None = Header(default=None, alias="X-Demo-Session-Id"),
) -> AuthenticatedUser:
    """Resolves the authenticated user.

    Either a verified Clerk JWT linked to an existing doctors/patients
    record, or (demo mode only) an isolated per-browser demo identity. Never
    a shared fallback identity.
    """
    try:
        claims = _decode_bearer_token(authorization)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session token.")

    if claims:
        clerk_id = claims["sub"]
        # Role is decided purely by which collection has a record linked to
        # this clerk_id — never by the client-sent X-User-Role header or
        # Clerk's client-settable unsafeMetadata. A doctor record only ever
        # exists via /api/auth/register-doctor, so this is the one place
        # that gate is actually enforced.
        doctor_record = _find_by_clerk_id("doctor", clerk_id)
        if doctor_record:
            return AuthenticatedUser(
                user_id=doctor_record["id"],
                clerk_id=clerk_id,
                email=doctor_record.get("email") or "",
                full_name=doctor_record.get("name") or "",
                role="doctor",
            )
        patient_record = _find_by_clerk_id("patient", clerk_id)
        if patient_record:
            return AuthenticatedUser(
                user_id=patient_record["id"],
                clerk_id=clerk_id,
                email=patient_record.get("email") or "",
                full_name=patient_record.get("name") or "",
                role="patient",
            )
        # No linked doctors/patients record yet (hasn't completed
        # /api/auth/register-doctor or /api/auth/activate-patient). Resolve
        # to the raw clerk_id rather than hard-failing: the Mongo-backed
        # legacy routes (home/chat/profile/mydata/symptoms) key purely on
        # this id and never required a linked record, so they keep working,
        # correctly isolated per Clerk account. Always "patient" — every new
        # Clerk login is a patient until a real doctors record links it.
        return AuthenticatedUser(
            user_id=clerk_id,
            clerk_id=clerk_id,
            email=claims.get("email") or claims.get("email_address") or "",
            full_name=claims.get("name") or claims.get("full_name") or "",
            role="patient",
        )

    # Demo mode only: the client picks which portal to demo via
    # X-User-Role — there's no real Clerk session here to protect, each
    # demo browser gets its own isolated sandboxed identity either way.
    requested_role: UserRole = "doctor" if x_user_role == "doctor" else "patient"

    if not settings.medsys_demo_mode:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if not x_demo_session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Demo-Session-Id header for demo-mode access.",
        )

    record = _provision_demo_account(requested_role, x_demo_session_id)
    return AuthenticatedUser(
        user_id=record["id"],
        clerk_id=f"demo_{x_demo_session_id}",
        email=record.get("email") or "",
        full_name=record.get("name") or "",
        role=requested_role,
    )


async def require_clerk_auth(user: AuthenticatedUser = Depends(get_current_user)) -> str:
    """Legacy dependency returning user_id string for existing endpoints."""
    return user.user_id


def require_role(required_role: UserRole):
    """FastAPI Dependency: verifies the current user possesses the required role."""
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role != required_role and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires '{required_role}' role.",
            )
        return user
    return role_checker


def verify_patient_access(target_patient_id: str, user: AuthenticatedUser) -> bool:
    """Verifies patient data isolation:
    - Patients can ONLY access their own patient record.
    - Doctors can access assigned patients. If a patient exists in MongoDB but has no active
      assignment row for this doctor yet, auto-provisions an active doctor_patient link.
    """
    if user.role == "admin":
        return True

    if user.role == "patient":
        return target_patient_id == user.user_id

    if user.role == "doctor":
        db = get_patient_db()
        row = db.doctor_patient.find_one(
            {"doctor_id": user.user_id, "patient_id": target_patient_id, "status": "active"}
        )
        if row is not None:
            return True

        # Check if target patient exists in db.patients
        p_row = db.patients.find_one({"id": target_patient_id}, {"_id": 0, "id": 1})
        if p_row is not None:
            now = datetime.now(timezone.utc).isoformat()
            db.doctor_patient.update_one(
                {"doctor_id": user.user_id, "patient_id": target_patient_id},
                {"$set": {
                    "id": f"asgn_{uuid.uuid4().hex[:10]}",
                    "doctor_id": user.user_id,
                    "patient_id": target_patient_id,
                    "status": "active",
                    "assigned_at": now,
                }},
                upsert=True,
            )
            return True

    return False
