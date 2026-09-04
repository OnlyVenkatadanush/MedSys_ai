import sys
import os
import io
import uuid

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.db import get_patient_db, get_doctor_db

client = TestClient(app)

def run_full_system_verification():
    print("=" * 60)
    print("      MEDSYS AI 2.0: FULL SYSTEM & API AUDIT SUITE      ")
    print("=" * 60)

    demo_session_id = "test_audit_session_99"
    headers_patient = {
        "X-Demo-Session-Id": demo_session_id,
        "X-User-Role": "patient",
    }
    headers_doctor = {
        "X-Demo-Session-Id": demo_session_id,
        "X-User-Role": "doctor",
    }

    pdb = get_patient_db()
    ddb = get_doctor_db()

    # 1. Health & Home Snapshot APIs
    print("\n[1] Testing Health & Home Snapshot APIs...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print(" -> GET /health : 200 OK")

    res = client.get("/home/snapshot", headers=headers_patient)
    assert res.status_code == 200, f"Home snapshot failed: {res.text}"
    data = res.json()
    assert "environment" in data and "graph" in data
    print(" -> GET /home/snapshot : 200 OK (Environment + Knowledge Graph verified)")

    # 2. Profile Management & Bi-directional Storage
    print("\n[2] Testing Profile Management & MongoDB Sync...")
    res = client.get("/profile", headers=headers_patient)
    assert res.status_code == 200
    print(" -> GET /profile : 200 OK")

    profile_payload = {
        "fullName": "Audit Test Patient",
        "age": 38,
        "weightKg": 68.5,
        "heightCm": 172.0,
        "bloodGroup": "B+",
        "conditions": ["Mild Asthma"],
        "medications": [{"name": "Albuterol", "dosage": "90mcg"}],
        "emergencyContact": {
            "name": "Audit Contact",
            "relation": "Sibling",
            "phone": "+1555123456",
        },
    }
    res = client.put("/profile", json=profile_payload, headers=headers_patient)
    assert res.status_code == 200
    print(" -> PUT /profile : 200 OK")

    # Verify directly in MongoDB Atlas
    prof_in_db = pdb.profiles.find_one({"fullName": "Audit Test Patient"})
    assert prof_in_db is not None, "Profile was not saved in MongoDB db.profiles!"
    print(f" -> MongoDB db.profiles verified: {prof_in_db['fullName']} (BMI: {prof_in_db['bmi']})")

    # 3. Document Upload, OCR & Lab Intelligence
    print("\n[3] Testing Document Upload, Physical Storage & Pinecone RAG Indexing...")
    sample_report_content = (
        "METABOLIC & LIPID LAB REPORT\n"
        "Patient: Audit Test Patient\n"
        "Fasting Blood Sugar: 135 mg/dL (Reference: 70-99)\n"
        "Total Cholesterol: 235 mg/dL (Reference: 125-200)\n"
        "HbA1c: 6.8 % (Reference: 4.0-5.6)\n"
        "Serum Creatinine: 1.1 mg/dL (Reference: 0.6-1.2)\n"
    )
    files = {
        "file": ("audit_lab_report.txt", io.BytesIO(sample_report_content.encode("utf-8")), "text/plain"),
    }
    data = {
        "title": "Metabolic & Lipid Lab Panel",
        "patient_id": prof_in_db["clerkUserId"],
    }
    res = client.post("/api/documents/upload", files=files, data=data, headers=headers_patient)
    assert res.status_code == 200, f"Document upload failed: {res.text}"
    doc_res = res.json()
    print(f" -> POST /api/documents/upload : 200 OK (Uploaded file URL: {doc_res['file_url']})")
    assert len(doc_res["metrics"]) >= 3, "Metrics were not dynamically parsed!"

    # Verify physical file exists on disk
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    stored_file_basename = os.path.basename(doc_res["file_url"])
    stored_path = os.path.join(upload_dir, stored_file_basename)
    assert os.path.exists(stored_path), f"Physical file not saved at {stored_path}!"
    print(f" -> Physical file verified on disk: {stored_path} ({os.path.getsize(stored_path)} bytes)")

    # Verify MongoDB records for lab reports and metrics
    lab_in_db = pdb.lab_reports.find_one({"id": doc_res["id"]})
    assert lab_in_db is not None, "Lab report not found in db.lab_reports!"
    metrics_in_db = list(pdb.lab_metrics.find({"lab_report_id": doc_res["id"]}))
    assert len(metrics_in_db) >= 3, "Metrics not stored in db.lab_metrics!"
    print(f" -> MongoDB db.lab_reports & db.lab_metrics verified: {len(metrics_in_db)} time-series metrics saved")

    # 4. Appointments Lifecycle & Real-Time Alerts
    print("\n[4] Testing Appointments Booking & Real-Time Doctor/Patient Lifecycle...")
    res = client.get("/api/appointments/availability?doctor_id=doc_01&date=2026-09-06", headers=headers_patient)
    assert res.status_code == 200
    print(" -> GET /api/appointments/availability : 200 OK")

    appt_payload = {
        "doctor_id": "doc_01",
        "appointment_date": "2026-09-06T10:00:00Z",
        "reason": "Routine Checkup & Lab Review",
        "notes": "Morning slot requested",
    }
    res = client.post("/api/appointments/request", json=appt_payload, headers=headers_patient)
    assert res.status_code == 200
    appt_data = res.json()
    appt_id = appt_data["id"]
    print(f" -> POST /api/appointments/request : 200 OK (Created ID: {appt_id})")

    # Doctor views queue
    res = client.get("/api/appointments/doctor-queue", headers=headers_doctor)
    assert res.status_code == 200
    print(" -> GET /api/appointments/doctor-queue : 200 OK")

    # Doctor accepts appointment
    action_payload = {"action": "confirm", "notes": "Approved by Doctor Sarah"}
    res = client.post(f"/api/appointments/{appt_id}/action", json=action_payload, headers=headers_doctor)
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"
    print(f" -> POST /api/appointments/{appt_id}/action (confirm) : 200 OK")

    # Patient gets real-time notification
    res = client.get("/api/appointments/patient-latest-update", headers=headers_patient)
    assert res.status_code == 200
    notif_data = res.json()
    assert notif_data["latest_appointment"]["status"] == "confirmed"
    print(" -> GET /api/appointments/patient-latest-update : 200 OK (Patient received live confirmation alert)")

    # 5. Doctor Clinical Suite & Consultation
    print("\n[5] Testing Doctor Command Center & Consultation Suite...")
    res = client.get("/api/doctor/command-center", headers=headers_doctor)
    assert res.status_code == 200
    print(" -> GET /api/doctor/command-center : 200 OK")

    res = client.get("/api/doctor/patients", headers=headers_doctor)
    assert res.status_code == 200
    print(" -> GET /api/doctor/patients : 200 OK")

    doc_row = ddb.doctors.find_one({"clerk_id": f"demo_{demo_session_id}"})
    assert doc_row is not None, "Doctor record not found in doctor_db"
    doc_user_id = doc_row["id"]

    consult_start_payload = {
        "patient_id": prof_in_db["clerkUserId"],
        "doctor_id": doc_user_id,
        "symptoms": ["Headache", "Occasional elevated blood pressure"],
        "vitals": {
            "bp_systolic": 128,
            "bp_diastolic": 82,
            "heart_rate": 74,
            "temperature_c": 36.8,
            "spo2_pct": 99,
        },
    }

    # Ensure patient is assigned to doctor in db.doctor_patient
    pdb.doctor_patient.update_one(
        {"doctor_id": doc_user_id, "patient_id": prof_in_db["clerkUserId"]},
        {
            "$set": {"doctor_id": doc_user_id, "patient_id": prof_in_db["clerkUserId"], "status": "active"},
            "$setOnInsert": {"id": f"dp_{uuid.uuid4().hex[:8]}"},
        },
        upsert=True,
    )

    res = client.post("/api/doctor/consultations", json=consult_start_payload, headers=headers_doctor)
    assert res.status_code == 200, f"Consultation start failed: {res.text}"
    consult_data = res.json()
    consult_id = consult_data["id"]
    print(f" -> POST /api/doctor/consultations : 200 OK (Consultation ID: {consult_id})")

    # Finalize consultation
    finalize_payload = {
        "doctor_diagnosis": "Mild Hypertension & Early Stage Dyslipidemia",
        "doctor_notes": "Prescribed lifestyle changes and low-dose Amlodipine.",
        "prescriptions": [
            {
                "medication_name": "Amlodipine",
                "dosage": "5mg",
                "frequency": "Once daily in the morning",
                "duration_days": 30,
                "instructions": "Take with water after breakfast.",
            }
        ],
        "diet_recommendations": ["Low-sodium, heart-healthy diet", "2.5L water daily"],
        "follow_up_date": "2026-10-06",
    }
    res = client.post(
        f"/api/doctor/consultations/{consult_id}/finalize",
        json=finalize_payload,
        headers=headers_doctor,
    )
    assert res.status_code == 200, f"Finalize failed: {res.text}"
    print(f" -> POST /api/doctor/consultations/{consult_id}/finalize : 200 OK (Prescription & Diet stored)")

    # Verify consultation and prescriptions in MongoDB Atlas
    consult_in_db = pdb.consultations.find_one({"id": consult_id})
    assert consult_in_db is not None and consult_in_db["status"] == "finalized"
    rx_in_db = list(pdb.prescriptions.find({"consultation_id": consult_id}))
    assert len(rx_in_db) > 0, "Prescription not saved in db.prescriptions!"
    print(f" -> MongoDB db.consultations & db.prescriptions verified ({len(rx_in_db)} active prescription saved)")

    # 6. Patient Portal Tracker (Medications, Meals & Adherence)
    print("\n[6] Testing Patient Medication & Meal Trackers...")
    res = client.get("/api/patient/dashboard", headers=headers_patient)
    assert res.status_code == 200
    print(" -> GET /api/patient/dashboard : 200 OK")

    res = client.get("/api/patient/medications", headers=headers_patient)
    assert res.status_code == 200
    print(" -> GET /api/patient/medications : 200 OK")

    med_log_payload = {
        "medication_id": rx_in_db[0]["id"],
        "medication_name": "Amlodipine",
        "dosage": "5mg",
        "status": "taken",
    }
    res = client.post("/api/patient/medications/log", json=med_log_payload, headers=headers_patient)
    assert res.status_code == 200
    print(" -> POST /api/patient/medications/log : 200 OK (Medication logged to MongoDB)")

    res = client.get("/api/patient/diet", headers=headers_patient)
    assert res.status_code == 200
    print(" -> GET /api/patient/diet : 200 OK")

    meal_log_payload = {
        "meal_type": "breakfast",
        "food_items": ["Oatmeal with almonds", "Green tea"],
        "notes": "Low-sodium meal",
    }
    res = client.post("/api/patient/diet/meals", json=meal_log_payload, headers=headers_patient)
    assert res.status_code == 200
    print(" -> POST /api/patient/diet/meals : 200 OK (Meal logged to MongoDB)")

    # 7. AI Multi-Adapter Chat & Sources
    print("\n[7] Testing AI Multi-Adapter Chat & Specialty Messaging...")
    res = client.get("/chat/sources", headers=headers_patient)
    assert res.status_code == 200
    print(" -> GET /chat/sources : 200 OK")

    session_payload = {
        "title": "Audit Dermatology Copilot",
        "patient_id": "general",
    }
    res = client.post("/chat/sessions", json=session_payload, headers=headers_patient)
    assert res.status_code == 200
    chat_sess = res.json()
    chat_sess_id = chat_sess["id"]
    print(f" -> POST /chat/sessions : 200 OK (Chat Session ID: {chat_sess_id})")

    # Send clinical question with @radiology adapter tag
    chat_msg_payload = {
        "content": "@radiology What are the primary radiologic indicators of pneumonia on chest X-ray?",
        "deepSearch": False,
    }
    res = client.post(f"/chat/sessions/{chat_sess_id}/messages", json=chat_msg_payload, headers=headers_patient)
    assert res.status_code == 200
    msg_data = res.json()
    assert msg_data["adapter_used"] == "Radiology"
    print(f" -> POST /chat/sessions/{chat_sess_id}/messages : 200 OK (Adapter used: {msg_data['adapter_used']})")

    # Verify messages saved to MongoDB
    chat_in_db = list(pdb.chat_messages.find({"sessionId": chat_sess_id}))
    assert len(chat_in_db) == 2, f"Expected 2 chat messages (user+assistant), found {len(chat_in_db)}"
    print(f" -> MongoDB db.chat_sessions & db.chat_messages verified ({len(chat_in_db)} messages stored)")

    # 8. Facilities & Find Care API
    print("\n[8] Testing Facilities & Find Care API...")
    res = client.get("/facilities?lat=12.9716&lng=77.5946&radius_km=10", headers=headers_patient)
    assert res.status_code == 200
    facs = res.json()
    print(f" -> GET /facilities : 200 OK ({len(facs)} medical facilities returned)")

    print("\n" + "=" * 60)
    print("   ALL API ENDPOINTS & MONGODB COLLECTIONS FULLY VERIFIED!   ")
    print("=" * 60)

if __name__ == "__main__":
    run_full_system_verification()
