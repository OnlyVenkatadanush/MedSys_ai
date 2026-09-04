import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.db import get_patient_db, get_doctor_db

def test_pdf_endpoints():
    client = TestClient(app)
    pdb = get_patient_db()
    ddb = get_doctor_db()

    demo_session = "test_pdf_export_01"
    headers_doc = {"X-Demo-Session-Id": demo_session, "X-User-Role": "doctor"}
    headers_pat = {"X-Demo-Session-Id": demo_session, "X-User-Role": "patient"}

    # Provision
    client.get("/profile/doctor", headers=headers_doc)
    doc_id = ddb.doctors.find_one({"clerk_id": f"demo_{demo_session}"})["id"]
    client.get("/profile", headers=headers_pat)
    pat_id = pdb.patients.find_one({"clerk_id": f"demo_{demo_session}"})["id"]

    pdb.doctor_patient.update_one(
        {"doctor_id": doc_id, "patient_id": pat_id},
        {
            "$set": {"doctor_id": doc_id, "patient_id": pat_id, "status": "active"},
            "$setOnInsert": {"id": "dp_pdf_test_99"},
        },
        upsert=True,
    )

    # Start and finalize consultation
    c_res = client.post(
        "/api/doctor/consultations",
        json={
            "patient_id": pat_id,
            "doctor_id": doc_id,
            "symptoms": ["Mild chest tightness", "Occasional palpitations"],
            "vitals": {
                "bp_systolic": 132,
                "bp_diastolic": 86,
                "heart_rate": 78,
                "temperature_c": 36.9,
                "spo2_pct": 98,
            },
        },
        headers=headers_doc,
    )
    assert c_res.status_code == 200, c_res.text
    cid = c_res.json()["id"]

    f_res = client.post(
        f"/api/doctor/consultations/{cid}/finalize",
        json={
            "doctor_diagnosis": "Borderline Essential Hypertension & Cardiac Strain",
            "doctor_notes": "Patient advised reduction in dietary sodium, daily aerobic activity, and stress management.",
            "prescriptions": [
                {
                    "medication_name": "Metoprolol Tartrate",
                    "dosage": "25mg",
                    "frequency": "Twice daily",
                    "duration_days": 14,
                    "instructions": "Take with meals in morning and evening.",
                }
            ],
            "diet_recommendations": [
                "Low-sodium DASH diet",
                "Hydration 2.5L water daily",
                "Limit caffeine to 1 cup/day",
            ],
            "follow_up_date": "2026-10-12",
        },
        headers=headers_doc,
    )
    assert f_res.status_code == 200, f_res.text

    # 1. Test Doctor PDF Download
    pdf_doc_res = client.get(f"/api/doctor/consultations/{cid}/pdf", headers=headers_doc)
    assert pdf_doc_res.status_code == 200, pdf_doc_res.text
    assert pdf_doc_res.headers["content-type"] == "application/pdf"
    assert len(pdf_doc_res.content) > 1000
    print(f" -> Doctor PDF Download: 200 OK ({len(pdf_doc_res.content)} bytes)")

    # 2. Test Patient PDF Download
    pdf_pat_res = client.get(f"/api/patient/consultations/{cid}/pdf", headers=headers_pat)
    assert pdf_pat_res.status_code == 200, pdf_pat_res.text
    assert pdf_pat_res.headers["content-type"] == "application/pdf"
    assert len(pdf_pat_res.content) > 1000
    print(f" -> Patient PDF Download: 200 OK ({len(pdf_pat_res.content)} bytes)")

    print("\n[SUCCESS] Both Doctor & Patient Consultation PDF Export Endpoints Verified 100%!")

if __name__ == "__main__":
    test_pdf_endpoints()
