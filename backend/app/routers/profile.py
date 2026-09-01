import asyncio

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_doctor_db, get_patient_db
from app.models import DoctorProfileRecord, ProfileIn, ProfileRecord
from app.services import model_router, supermemory_client
from app.services.mock_data import DEFAULT_DOCTOR_PROFILE, DEFAULT_PROFILE
from app.services.clerk_auth import require_clerk_auth

router = APIRouter(prefix="/profile", tags=["profile"])

# Only these document kinds are personal medical records — web search
# results (kind "web") aren't relevant to History/Medications.
DOCUMENT_KINDS_FOR_HISTORY = ["report", "consultation", "consult_prescription", "prescription"]


def _dedupe_conditions(manual: list[str], extracted: list[str]) -> list[str]:
    seen: dict[str, str] = {}
    for condition in [*manual, *extracted]:
        key = condition.strip().lower()
        if key and key not in seen:
            seen[key] = condition.strip()
    return list(seen.values())


def _dedupe_medications(manual: list[dict], extracted: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for med in [*manual, *extracted]:
        name = med.get("name", "").strip()
        key = name.lower()
        if key and key not in seen:
            seen[key] = {"name": name, "dosage": med.get("dosage", "").strip()}
    return list(seen.values())


@router.get("", response_model=ProfileRecord)
async def get_profile(user_id: str = Depends(require_clerk_auth)) -> dict:
    db = get_patient_db()
    profile = db.profiles.find_one({"clerkUserId": user_id}, {"_id": 0, "clerkUserId": 0})
    if not profile:
        profile = dict(DEFAULT_PROFILE)

    sources = list(
        db.sources.find(
            {"clerkUserId": user_id, "kind": {"$in": DOCUMENT_KINDS_FOR_HISTORY}},
            {"id": 1, "content": 1, "excerpt": 1, "extractedConditions": 1, "extractedMedications": 1},
        )
    )

    # Documents uploaded since the extraction cache existed already carry
    # extractedConditions/extractedMedications from upload time — reading
    # those is instant. Anything uploaded before that (or never processed
    # for some other reason) gets extracted once here, then persisted, so
    # this fallback only ever runs once per document, never again after.
    missing = [s for s in sources if "extractedConditions" not in s]

    async def _backfill_missing() -> None:
        if not missing:
            return
        results = await asyncio.gather(
            *(
                model_router.extract_medical_history([s.get("content") or s.get("excerpt", "")])
                for s in missing
            )
        )
        for source, result in zip(missing, results):
            db.sources.update_one(
                {"id": source["id"]},
                {
                    "$set": {
                        "extractedConditions": result["conditions"],
                        "extractedMedications": result["medications"],
                    }
                },
            )
            source["extractedConditions"] = result["conditions"]
            source["extractedMedications"] = result["medications"]

    # The document backfill and the knowledge-graph reads (symptoms/
    # medications surfaced from chat, same store the Home graph reads)
    # don't depend on each other — run them together.
    _, graph_symptoms, graph_medications = await asyncio.gather(
        _backfill_missing(),
        supermemory_client.list_all_symptoms(user_id),
        supermemory_client.list_all_medications(user_id),
    )

    extracted_conditions: list[str] = []
    extracted_medications: list[dict] = []
    for source in sources:
        extracted_conditions.extend(source.get("extractedConditions", []))
        extracted_medications.extend(source.get("extractedMedications", []))

    extracted_conditions.extend(s["name"].capitalize() for s in graph_symptoms)
    extracted_medications.extend(
        {"name": m["name"].capitalize(), "dosage": m.get("dosage", "")} for m in graph_medications
    )

    profile["conditions"] = _dedupe_conditions(profile.get("conditions", []), extracted_conditions)
    profile["medications"] = _dedupe_medications(profile.get("medications", []), extracted_medications)
    return profile


@router.put("", response_model=ProfileRecord)
def save_profile(body: ProfileIn, user_id: str = Depends(require_clerk_auth)) -> dict:
    db = get_patient_db()
    height_m = body.heightCm / 100
    bmi = round(body.weightKg / (height_m * height_m), 1) if height_m > 0 else 0.0
    record = {**body.model_dump(), "bmi": bmi}
    db.profiles.update_one(
        {"clerkUserId": user_id}, {"$set": {**record, "clerkUserId": user_id}}, upsert=True
    )
    return record


# Doctor-authored profile (bio, specializations, board certifications). Kept
# in a separate collection from the patient `profiles` above since the two
# shapes don't overlap — both key on the same `clerkUserId` from Clerk auth,
# so each doctor's edits are isolated to their own account (previously this
# lived only in the browser's localStorage, so it wasn't scoped per-account
# at all).
@router.get("/doctor", response_model=DoctorProfileRecord)
async def get_doctor_profile(user_id: str = Depends(require_clerk_auth)) -> dict:
    db = get_doctor_db()
    profile = db.doctor_profiles.find_one({"clerkUserId": user_id}, {"_id": 0, "clerkUserId": 0})
    return profile or dict(DEFAULT_DOCTOR_PROFILE)


@router.put("/doctor", response_model=DoctorProfileRecord)
def save_doctor_profile(body: DoctorProfileRecord, user_id: str = Depends(require_clerk_auth)) -> dict:
    db = get_doctor_db()
    record = body.model_dump()
    db.doctor_profiles.update_one(
        {"clerkUserId": user_id}, {"$set": {**record, "clerkUserId": user_id}}, upsert=True
    )
    return record
