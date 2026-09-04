import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db import get_patient_db
from app.routers.profile import save_profile, get_profile
from app.models import ProfileIn, EmergencyContact, Medication
from app.routers.chat import _aggregate_patient_ehr_context
import asyncio

async def test_profile_flow():
    db = get_patient_db()
    test_uid = "pat_test_demographics"

    # Seed patient record in db.patients
    db.patients.delete_many({"id": test_uid})
    db.profiles.delete_many({"clerkUserId": test_uid})

    db.patients.insert_one({
        "id": test_uid,
        "name": "Jane Smith",
        "age": 42,
        "gender": "Female",
        "blood_group": "AB+",
        "height_cm": 165.0,
        "weight_kg": 58.0,
        "emergency_contact_name": "Bob Smith",
        "emergency_contact_phone": "+1987654321",
    })

    print("--- 1. Testing get_profile fallback from db.patients ---")
    prof = await get_profile(user_id=test_uid)
    assert prof["fullName"] == "Jane Smith", f"Expected Jane Smith, got {prof['fullName']}"
    assert prof["age"] == 42
    assert prof["bloodGroup"] == "AB+"
    assert prof["heightCm"] == 165.0
    assert prof["weightKg"] == 58.0
    assert prof["bmi"] == round(58.0 / ((165.0/100)**2), 1)
    print("PASS: get_profile retrieved demographics properly.")

    print("--- 2. Testing save_profile synchronization ---")
    update_data = ProfileIn(
        fullName="Jane Doe-Smith",
        age=43,
        weightKg=60.0,
        heightCm=166.0,
        bloodGroup="AB-",
        conditions=["Hypertension"],
        medications=[Medication(name="Amlodipine", dosage="5mg")],
        emergencyContact=EmergencyContact(name="Bob Smith", relation="Spouse", phone="+1987654321")
    )
    saved = save_profile(update_data, user_id=test_uid)
    assert saved["bmi"] == round(60.0 / ((166.0/100)**2), 1)

    # Check MongoDB db.profiles
    prof_doc = db.profiles.find_one({"clerkUserId": test_uid})
    assert prof_doc is not None
    assert prof_doc["fullName"] == "Jane Doe-Smith"
    assert prof_doc["bloodGroup"] == "AB-"

    # Check MongoDB db.patients sync
    pat_doc = db.patients.find_one({"id": test_uid})
    assert pat_doc is not None
    assert pat_doc["name"] == "Jane Doe-Smith"
    assert pat_doc["age"] == 43
    assert pat_doc["blood_group"] == "AB-"
    assert pat_doc["height_cm"] == 166.0
    assert pat_doc["weight_kg"] == 60.0
    print("PASS: save_profile synced both db.profiles and db.patients in MongoDB.")

    print("--- 3. Testing _aggregate_patient_ehr_context biometrics injection ---")
    blocks = _aggregate_patient_ehr_context(db, test_uid)
    combined = "\n\n".join(blocks)
    assert "Jane Doe-Smith" in combined
    assert "43 y/o" in combined
    assert "AB-" in combined
    assert "166.0 cm" in combined
    assert "60.0 kg" in combined
    assert "BMI: 21.8" in combined
    print("PASS: Demographic & Biometrics block accurately generated for LLM context.")

    # Cleanup
    db.patients.delete_many({"id": test_uid})
    db.profiles.delete_many({"clerkUserId": test_uid})
    print("\nALL PROFILE & BIOMETRIC VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_profile_flow())
