import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db import get_patient_db
from app.services.model_router import extract_lab_metrics
from app.services.hybrid_db_service import ingest_unified_medical_document
from app.routers.appointments import (
    process_appointment_action,
    get_patient_latest_appointment_update,
    AppointmentActionIn,
)
from app.services.clerk_auth import AuthenticatedUser
import asyncio

async def test_phase2_fixes():
    db = get_patient_db()
    test_uid = "pat_phase2_test"

    print("--- 1. Testing Dynamic Lab Metric Extraction ---")
    sample_ocr = """
    COMPREHENSIVE METABOLIC PANEL (CMP)
    Patient: Test Subject
    Fasting Blood Sugar: 145 mg/dL (Reference: 70-99)
    HbA1c: 7.4 % (Reference: 4.0-5.6)
    Serum Creatinine: 1.6 mg/dL (Reference: 0.6-1.2)
    Total Cholesterol: 240 mg/dL (Reference: 125-200)
    Hemoglobin: 14.2 g/dL (Reference: 12.0-16.0)
    """
    metrics = await extract_lab_metrics(sample_ocr)
    print(f"Extracted {len(metrics)} lab metrics dynamically:")
    for m in metrics:
        print(f" - {m['name']}: {m['value']} {m['unit']} (Abnormal: {m['is_abnormal']})")
    assert len(metrics) >= 4, f"Expected at least 4 metrics, got {len(metrics)}"
    glucose_m = next((m for m in metrics if "glucose" in m["name"].lower() or "sugar" in m["name"].lower()), None)
    assert glucose_m is not None
    assert glucose_m["is_abnormal"] is True
    print("PASS: Dynamic lab metric extraction works accurately.")

    print("\n--- 2. Testing Unified Medical Document Ingestion ---")
    sample_bytes = sample_ocr.encode("utf-8")
    doc_res = await ingest_unified_medical_document(
        file_bytes=sample_bytes,
        original_filename="lab_sample_panel.txt",
        title="Comprehensive Metabolic Panel",
        patient_id=test_uid,
        uploaded_by="Dr. Sarah Smith",
        user_id=test_uid,
    )
    assert doc_res["id"].startswith("lab_")
    assert doc_res["file_url"].startswith("/uploads/")
    assert len(doc_res["metrics"]) >= 4

    # Verify presence in db.lab_reports & db.lab_metrics
    lab_doc = db.lab_reports.find_one({"id": doc_res["id"]})
    assert lab_doc is not None
    m_docs = list(db.lab_metrics.find({"lab_report_id": doc_res["id"]}))
    assert len(m_docs) >= 4

    # Verify presence in db.sources for Pinecone RAG
    src_doc = db.sources.find_one({"id": doc_res["source_id"]})
    assert src_doc is not None
    assert src_doc["url"] == doc_res["file_url"]
    print("PASS: Unified document ingestion stores physical file, plots metrics, and indexes RAG.")

    print("\n--- 3. Testing Appointment Notification & Real-Time Alert ---")
    appt_id = "apt_test_notif_01"
    db.appointments.delete_many({"id": appt_id})
    db.alerts.delete_many({"patient_id": test_uid})

    db.appointments.insert_one({
        "id": appt_id,
        "patient_id": test_uid,
        "doctor_id": "doc_01",
        "patient_name": "Test Patient",
        "doctor_name": "Dr. Sarah Smith",
        "appointment_date": "2026-09-06T10:00:00Z",
        "reason": "Follow-up",
        "status": "requested",
        "created_at": "2026-09-04T10:00:00Z",
    })

    doc_user = AuthenticatedUser(
        user_id="doc_01",
        clerk_id="clerk_doc_01",
        email="doctor@medsys.demo",
        full_name="Dr. Sarah Smith",
        role="doctor",
    )

    action_res = await process_appointment_action(
        appointment_id=appt_id,
        payload=AppointmentActionIn(action="confirm", notes="Slot confirmed, see you at 10 AM."),
        user=doc_user,
    )
    assert action_res.status == "confirmed"

    pat_user = AuthenticatedUser(
        user_id=test_uid,
        clerk_id="clerk_pat_test",
        email="patient@medsys.demo",
        full_name="Test Patient",
        role="patient",
    )
    latest_update = await get_patient_latest_appointment_update(user=pat_user)
    assert latest_update["latest_appointment"]["status"] == "confirmed"
    assert latest_update["recent_alert"] is not None
    assert "confirmed" in latest_update["recent_alert"]["message"].lower()
    print("PASS: Doctor confirmation triggers live patient alert and notification update.")

    # Cleanup
    db.appointments.delete_many({"id": appt_id})
    db.alerts.delete_many({"patient_id": test_uid})
    db.lab_reports.delete_many({"patient_id": test_uid})
    db.lab_metrics.delete_many({"patient_id": test_uid})
    db.sources.delete_many({"clerkUserId": test_uid})
    print("\nALL PHASE 2 COMPONENT TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    asyncio.run(test_phase2_fixes())
