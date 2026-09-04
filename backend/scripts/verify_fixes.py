import asyncio
import os
import sys
import uuid
from io import BytesIO

# Ensure app is on python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import UploadFile
from app.db import get_doctor_db, get_patient_db
from app.models_v2 import UserRole
from app.services.clerk_auth import AuthenticatedUser, verify_patient_access
from app.routers.doctor import get_doctor_command_center, get_assigned_patients
from app.routers.chat import list_sessions
from app.routers.documents import upload_lab_report, list_lab_reports, UPLOAD_DIR
from app.routers.patient import get_patient_dashboard, get_patient_medications


async def test_idor_fix():
    print("--- 1. Testing IDOR / Patient Data Isolation Fix ---")
    doc_user = AuthenticatedUser(
        user_id="doc_test_unassigned_99",
        clerk_id="clerk_doc_99",
        email="doc99@test.com",
        full_name="Dr. Tester",
        role="doctor",
    )
    # pat_01 is assigned to doc_01, NOT doc_test_unassigned_99
    has_access = verify_patient_access("pat_01", doc_user)
    assert not has_access, f"Expected False for unassigned patient, got {has_access}"

    # Verify no rogue assignment was created in doctor_patient
    db = get_patient_db()
    rogue_assignment = db.doctor_patient.find_one({
        "doctor_id": "doc_test_unassigned_99",
        "patient_id": "pat_01",
    })
    assert rogue_assignment is None, "Rogue doctor_patient assignment was created!"
    print("PASS: IDOR fix verified - unassigned patient access denied without auto-linking.")


async def test_doctor_isolation():
    print("--- 2. Testing Doctor Command Center & Patients Isolation ---")
    doc_user = AuthenticatedUser(
        user_id="doc_isolated_test",
        clerk_id="clerk_doc_iso",
        email="doc_iso@test.com",
        full_name="Dr. Isolated",
        role="doctor",
    )
    # Doctor with 0 assignments
    patients_list = await get_assigned_patients(doc_user)
    assert len(patients_list) == 0, f"Expected 0 patients for new doctor, got {len(patients_list)}"

    cmd_center = await get_doctor_command_center(doc_user)
    assert cmd_center.total_patients == 0, f"Expected 0 total patients, got {cmd_center.total_patients}"
    assert len(cmd_center.todays_appointments) == 0, f"Expected 0 appointments, got {len(cmd_center.todays_appointments)}"
    assert len(cmd_center.priority_queue) == 0, f"Expected 0 alerts, got {len(cmd_center.priority_queue)}"
    print("PASS: Doctor command center and patient list strictly isolated.")


def test_chat_isolation():
    print("--- 3. Testing Chat History Isolation ---")
    db = get_patient_db()
    # Create an orphaned session without clerkUserId or with a different user
    orphan_id = f"sess_orphan_{uuid.uuid4().hex[:8]}"
    db.chat_sessions.insert_one({
        "id": orphan_id,
        "title": "Orphan Secret Chat",
        "createdAt": "2026-09-04T00:00:00Z",
        "updatedAt": "2026-09-04T00:00:00Z",
    })

    sessions = list_sessions(user_id="user_unrelated_123")
    orphan_found = any(s["id"] == orphan_id for s in sessions)
    assert not orphan_found, "Orphaned chat session leaked to unrelated user!"
    
    # Cleanup orphan
    db.chat_sessions.delete_one({"id": orphan_id})
    print("PASS: Chat sessions strictly filtered by user_id.")


async def test_file_upload_persistence():
    print("--- 4. Testing Lab Report File Upload Persistence ---")
    patient_user = AuthenticatedUser(
        user_id="pat_file_test_01",
        clerk_id="clerk_file_pat",
        email="filepat@test.com",
        full_name="File Patient",
        role="patient",
    )
    fake_pdf_content = b"%PDF-1.4 test pdf content for medsys verification"
    upload_file = UploadFile(
        file=BytesIO(fake_pdf_content),
        filename="test_blood_work.pdf",
    )
    
    report_record = await upload_lab_report(
        title="Verification Lab Report",
        patient_id="pat_file_test_01",
        file=upload_file,
        user=patient_user,
    )

    assert report_record.file_url, "file_url was not generated!"
    assert report_record.file_url.startswith("/uploads/"), f"Unexpected file_url: {report_record.file_url}"

    # Verify physical file existence in UPLOAD_DIR
    filename_on_disk = report_record.file_url.replace("/uploads/", "")
    full_path = os.path.join(UPLOAD_DIR, filename_on_disk)
    assert os.path.exists(full_path), f"File does not exist on disk: {full_path}"
    
    with open(full_path, "rb") as f:
        read_bytes = f.read()
    assert read_bytes == fake_pdf_content, "Saved file content mismatch!"

    # Verify list_lab_reports returns the file_url
    listed_reports = await list_lab_reports(patient_id="pat_file_test_01", user=patient_user)
    assert any(r.id == report_record.id and r.file_url == report_record.file_url for r in listed_reports), "Listed reports missing persisted file_url"
    
    print("PASS: File upload binary physically persisted to disk with static URL.")


async def test_patient_dashboard_unification():
    print("--- 5. Testing Patient Dashboard & Prescriptions Unification ---")
    pat_user = AuthenticatedUser(
        user_id="pat_01",
        clerk_id="clerk_pat_01",
        email="john.doe@example.com",
        full_name="John Doe",
        role="patient",
    )
    dashboard = await get_patient_dashboard(pat_user)
    assert "recent_doctor_advice" in dashboard
    assert "active_medications" in dashboard
    assert len(dashboard["active_medications"]) > 0, "Expected active medications from db.prescriptions"
    
    meds = await get_patient_medications(pat_user)
    assert len(meds["schedules"]) > 0, "Expected medication schedules from db.prescriptions"
    print(f"PASS: Patient dashboard unified. Loaded {len(dashboard['recent_doctor_advice'])} consultations and {len(dashboard['active_medications'])} active prescriptions.")


async def main():
    await test_idor_fix()
    await test_doctor_isolation()
    test_chat_isolation()
    await test_file_upload_persistence()
    await test_patient_dashboard_unification()
    print("\nALL 5 AUDIT VERIFICATION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(main())
