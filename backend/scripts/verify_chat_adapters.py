import asyncio
import os
import sys
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_patient_db
from app.models import ChatMessageIn, ChatSessionIn
from app.services.clerk_auth import AuthenticatedUser
from app.services.domain_adapter import (
    parse_explicit_adapter_tag,
    classify_implicit_adapter,
    resolve_adapter,
    get_adapter_display_name,
    build_specialty_prompt_preamble,
)
from app.routers.chat import (
    create_session,
    list_sessions,
    post_session_message,
    _aggregate_patient_ehr_context,
)


def test_domain_adapter_tag_parsing():
    print("--- 1. Testing Explicit @adapter Tag Parsing ---")
    test_cases = [
        ("@radiology What does this nodule indicate?", "radiology", "What does this nodule indicate?"),
        ("@pathology Biopsy specimen cellular analysis", "pathology", "Biopsy specimen cellular analysis"),
        ("@dermatology Rash with scaling on left arm", "dermatology", "Rash with scaling on left arm"),
        ("@ophthalmology OCT scan shows macular edema", "ophthalmology", "OCT scan shows macular edema"),
        ("@chest_xray Bilateral opacity in lower lung fields", "chest_xray", "Bilateral opacity in lower lung fields"),
        ("@cardiology Elevated troponin levels and chest pressure", "cardiology", "Elevated troponin levels and chest pressure"),
        ("@clinical_reasoning Differential for acute epigastric pain", "clinical_reasoning", "Differential for acute epigastric pain"),
        ("Normal query without tag about general fatigue", None, "Normal query without tag about general fatigue"),
    ]

    for raw_msg, expected_tag, expected_clean in test_cases:
        tag, clean = parse_explicit_adapter_tag(raw_msg)
        assert tag == expected_tag, f"Expected tag {expected_tag}, got {tag} for '{raw_msg}'"
        assert clean == expected_clean, f"Expected clean text '{expected_clean}', got '{clean}'"

    print("PASS: Explicit @adapter tag parsing works accurately for all domains.")


def test_implicit_intent_classification():
    print("--- 2. Testing Implicit Clinical Intent Classification ---")
    test_cases = [
        ("Doctor recommended a CT scan and MRI for my shoulder pain", "radiology"),
        ("I have a red itchy skin lesion with eczema on my hand", "dermatology"),
        ("The pathology report from the biopsy tissue showed atypia", "pathology"),
        ("Experiencing sudden blurred vision and eye pain", "ophthalmology"),
        ("Chest x-ray indicates possible pneumothorax and effusion", "chest_xray"),
        ("ECG shows sinus tachycardia and arrhythmia", "cardiology"),
        ("Need a differential diagnosis for intermittent fever", "clinical_reasoning"),
        ("Hello what time should I take my vitamins?", "general"),
    ]

    for msg, expected_domain in test_cases:
        domain = classify_implicit_adapter(msg)
        assert domain == expected_domain, f"Expected domain {expected_domain}, got {domain} for '{msg}'"

    print("PASS: Implicit intent classification accurately resolves specialties.")


def test_ehr_context_aggregation():
    print("--- 3. Testing Multi-Context Patient EHR Aggregation ---")
    db = get_patient_db()
    ehr_blocks = _aggregate_patient_ehr_context(db, "pat_01")
    assert len(ehr_blocks) > 0, "Expected EHR context blocks for pat_01"

    joined = "\n\n".join(ehr_blocks)
    assert "[PATIENT BASIC DETAILS]" in joined
    assert "[CURRENT ACTIVE MEDICATIONS]" in joined
    print(f"PASS: Aggregated {len(ehr_blocks)} EHR context blocks successfully for pat_01.")


async def test_doctor_session_creation_and_messaging():
    print("--- 4. Testing Doctor Session Partitioning & Adapter Chat Messaging ---")
    user_id = "doc_test_chat_01"
    
    # 1. Create Patient-Scoped Session
    patient_session = create_session(
        ChatSessionIn(patient_id="pat_01", patient_name="John Doe", title="Patient Review: John Doe"),
        user_id=user_id,
    )
    assert patient_session["patient_id"] == "pat_01"
    assert patient_session["is_patient_scoped"] is True
    assert "John Doe" in patient_session["patient_name"]

    # 2. Create General Copilot Session
    general_session = create_session(
        ChatSessionIn(patient_id="general", title="General Clinical Research"),
        user_id=user_id,
    )
    assert general_session["patient_id"] == "general"
    assert general_session["is_patient_scoped"] is False

    # 3. List sessions and verify isolation
    sessions = list_sessions(user_id=user_id)
    pat_sessions = [s for s in sessions if s.get("is_patient_scoped")]
    gen_sessions = [s for s in sessions if not s.get("is_patient_scoped")]
    assert any(s["id"] == patient_session["id"] for s in pat_sessions)
    assert any(s["id"] == general_session["id"] for s in gen_sessions)

    # 4. Post message with explicit @radiology tag to patient session
    msg = await post_session_message(
        session_id=patient_session["id"],
        body=ChatMessageIn(content="@radiology Analyze chest radiograph findings for lung fields"),
        user_id=user_id,
    )
    assert msg["adapter_used"] == "Radiology", f"Expected adapter_used 'Radiology', got {msg.get('adapter_used')}"
    assert len(msg["content"]) > 0

    # Clean up test sessions
    db = get_patient_db()
    db.chat_sessions.delete_many({"id": {"$in": [patient_session["id"], general_session["id"]]}})
    db.chat_messages.delete_many({"sessionId": {"$in": [patient_session["id"], general_session["id"]]}})
    
    print("PASS: Doctor session partitioning and adapter message response verified.")


async def main():
    test_domain_adapter_tag_parsing()
    test_implicit_intent_classification()
    test_ehr_context_aggregation()
    await test_doctor_session_creation_and_messaging()
    print("\nALL DOMAIN ADAPTER & CHAT TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(main())
