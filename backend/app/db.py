"""MongoDB Atlas connection: two isolated databases for MedSys AI 2.0.

Doctor identity/credentials and every patient-owned or patient-attributable
collection are kept in two entirely separate MongoDB databases on the same
Atlas cluster:

- `get_doctor_db()` — doctor accounts only (`doctors`, `doctor_profiles`).
- `get_patient_db()` — everything else: patients, consultations,
  prescriptions, appointments, alerts, chat/RAG history, documents,
  symptoms, the doctor_patient assignment link, etc. A document here may
  still carry a `doctor_id` field as a plain reference (e.g. which doctor
  wrote a prescription), but the doctor's own account data never lives here.

Nothing writes doctor collections into the patient database or vice versa,
so a bug in one side's queries can't leak across the isolation boundary.
"""

from datetime import datetime, timezone

from pymongo import MongoClient
from pymongo.database import Database

from app.config import settings

_client: MongoClient | None = None


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    return _client


def get_doctor_db() -> Database:
    """The doctor-only database: doctor accounts/credentials/profile."""
    return _get_client()[settings.mongodb_doctor_db]


def get_patient_db() -> Database:
    """The patient-only database: every patient-owned or
    patient-attributable collection."""
    return _get_client()[settings.mongodb_patient_db]


# Former SQLite tables, migrated 1:1 to collections of the same name. Every
# document keeps the same app-generated string `id` field the SQLite rows
# had (e.g. "doc_01", "pat_01") rather than relying on Mongo's ObjectId —
# this matches the convention this codebase's own Mongo collections
# (sources, profiles, chat_sessions) already use.
_DOCTOR_ID_INDEXED_COLLECTIONS = [
    "doctors",
]

_PATIENT_ID_INDEXED_COLLECTIONS = [
    "patients",
    "doctor_patient",
    "patient_invitations",
    "patient_conditions",
    "allergies",
    "consultations",
    "medications",
    "prescriptions",
    "medication_logs",
    "vitals",
    "lab_reports",
    "lab_metrics",
    "meal_logs",
    "appointments",
    "ai_chat_sessions",
    "ai_chat_messages",
    "alerts",
    "patient_snapshots",
]


def init_collections() -> None:
    """Creates indexes in both databases and seeds sample doctor/patient
    data once. Safe to call on every startup — index creation is idempotent
    and the seed only runs while `doctors` is empty."""
    doctor_db = get_doctor_db()
    patient_db = get_patient_db()

    for name in _DOCTOR_ID_INDEXED_COLLECTIONS:
        doctor_db[name].create_index("id", unique=True)
    for name in _PATIENT_ID_INDEXED_COLLECTIONS:
        patient_db[name].create_index("id", unique=True)

    doctor_db.doctors.create_index(
        "clerk_id", unique=True, partialFilterExpression={"clerk_id": {"$exists": True}}
    )
    doctor_db.doctors.create_index("email", unique=True)

    patient_db.patients.create_index(
        "clerk_id", unique=True, partialFilterExpression={"clerk_id": {"$exists": True}}
    )
    patient_db.patients.create_index("email", unique=True)
    patient_db.patients.create_index("patient_id_code", unique=True)
    patient_db.patient_invitations.create_index("invitation_token", unique=True)
    patient_db.doctor_patient.create_index([("doctor_id", 1), ("patient_id", 1)])

    # Flexible AI/document store indexes (moved from the old db_mongo.py).
    patient_db.raw_lab_documents.create_index("patient_id")
    patient_db.ai_chat_sessions.create_index([("doctor_id", 1), ("patient_id", 1)])
    patient_db.ai_chat_messages.create_index("session_id")
    patient_db.ai_generated_insights.create_index("patient_id")

    _seed_sample_data(doctor_db, patient_db)


def _seed_sample_data(doctor_db: Database, patient_db: Database) -> None:
    if doctor_db.doctors.count_documents({}) > 0:
        return

    now = datetime.now(timezone.utc).isoformat()

    doctor_db.doctors.insert_one({
        "id": "doc_01",
        "name": "Dr. Sarah Smith",
        "email": "dr.smith@medsys.ai",
        "phone": "+1-555-0100",
        "specialization": "Cardiology & Internal Medicine",
        "license_number": "MD-994821",
        "hospital_name": "St. Jude Medical Center",
        "experience_years": 12,
        "created_at": now,
        "is_active": 1,
    })

    patient_db.patients.insert_many([
        {
            "id": "pat_01", "patient_id_code": "PAT-000124", "name": "John Doe",
            "dob": "1984-05-12", "age": 42, "gender": "Male", "blood_group": "O+",
            "height_cm": 178.0, "weight_kg": 75.0, "phone": "+1-555-0123",
            "email": "john.doe@example.com", "emergency_contact_name": "Jane Doe",
            "emergency_contact_phone": "+1-555-0199", "account_state": "ACTIVE",
            "created_at": now, "is_active": 1,
        },
        {
            "id": "pat_02", "patient_id_code": "PAT-000125", "name": "Emma Watson",
            "dob": "1997-09-24", "age": 29, "gender": "Female", "blood_group": "A+",
            "height_cm": 165.0, "weight_kg": 58.0, "phone": "+1-555-0144",
            "email": "emma.watson@example.com", "emergency_contact_name": "David Watson",
            "emergency_contact_phone": "+1-555-0188", "account_state": "ACTIVE",
            "created_at": now, "is_active": 1,
        },
        {
            "id": "pat_03", "patient_id_code": "PAT-000126", "name": "Robert Chen",
            "dob": "1965-02-18", "age": 61, "gender": "Male", "blood_group": "B+",
            "height_cm": 172.0, "weight_kg": 82.0, "phone": "+1-555-0188",
            "email": "robert.chen@example.com", "emergency_contact_name": "Lisa Chen",
            "emergency_contact_phone": "+1-555-0177", "account_state": "ACTIVE",
            "created_at": now, "is_active": 1,
        },
    ])

    patient_db.doctor_patient.insert_many([
        {"id": "asgn_01", "doctor_id": "doc_01", "patient_id": "pat_01", "assigned_at": now, "status": "active"},
        {"id": "asgn_02", "doctor_id": "doc_01", "patient_id": "pat_02", "assigned_at": now, "status": "active"},
        {"id": "asgn_03", "doctor_id": "doc_01", "patient_id": "pat_03", "assigned_at": now, "status": "active"},
    ])

    patient_db.patient_invitations.insert_many([
        {"id": "inv_01", "patient_id": "pat_01", "email": "john.doe@example.com", "invitation_token": "token_pat01_active", "expires_at": "2026-12-31T23:59:59Z", "status": "activated", "created_at": now},
        {"id": "inv_02", "patient_id": "pat_02", "email": "emma.watson@example.com", "invitation_token": "token_pat02_active", "expires_at": "2026-12-31T23:59:59Z", "status": "activated", "created_at": now},
        {"id": "inv_03", "patient_id": "pat_03", "email": "robert.chen@example.com", "invitation_token": "token_pat03_active", "expires_at": "2026-12-31T23:59:59Z", "status": "activated", "created_at": now},
    ])

    patient_db.patient_conditions.insert_many([
        {"id": "cond_01", "patient_id": "pat_01", "condition_name": "Mild Hypertension", "diagnosed_date": "2025-01-10", "status": "active", "notes": "Controlled with Lisinopril 10mg"},
        {"id": "cond_02", "patient_id": "pat_01", "condition_name": "Early Pre-diabetes", "diagnosed_date": "2025-06-15", "status": "active", "notes": "Dietary tracking"},
    ])

    patient_db.allergies.insert_one(
        {"id": "alg_01", "patient_id": "pat_01", "allergen": "Penicillin", "reaction": "Skin rash, anaphylaxis warning", "severity": "severe", "notes": "Avoid all beta-lactams"}
    )

    patient_db.vitals.insert_one({
        "id": "vit_01", "patient_id": "pat_01", "consultation_id": None,
        "systolic_bp": 135, "diastolic_bp": 85, "heart_rate": 78,
        "temperature_c": 38.2, "spo2_pct": 98, "recorded_at": now,
    })

    patient_db.prescriptions.insert_many([
        {"id": "rx_01", "consultation_id": None, "patient_id": "pat_01", "doctor_id": "doc_01", "medication_name": "Lisinopril", "dosage": "10 mg", "frequency": "Once daily in morning", "duration_days": 30, "instructions": "Take with water", "status": "active", "created_at": now},
        {"id": "rx_02", "consultation_id": None, "patient_id": "pat_01", "doctor_id": "doc_01", "medication_name": "Metformin", "dosage": "500 mg", "frequency": "Twice daily with meals", "duration_days": 30, "instructions": "Take with meals", "status": "active", "created_at": now},
    ])

    patient_db.lab_reports.insert_one({
        "id": "lab_01", "patient_id": "pat_01", "uploaded_by": "pat_01",
        "title": "Metabolic & Lipid Panel", "file_path": None,
        "ocr_text": "Glucose: 142 mg/dL, HbA1c: 7.2%", "report_date": "2026-08-25",
        "uploaded_at": now, "status": "processed",
    })
    patient_db.lab_metrics.insert_many([
        {"id": "lm_01", "lab_report_id": "lab_01", "patient_id": "pat_01", "metric_name": "Fasting Glucose", "value": 142.0, "unit": "mg/dL", "reference_min": 70.0, "reference_max": 99.0, "is_abnormal": 1, "recorded_at": "2026-08-25"},
        {"id": "lm_02", "lab_report_id": "lab_01", "patient_id": "pat_01", "metric_name": "HbA1c", "value": 7.2, "unit": "%", "reference_min": 4.0, "reference_max": 5.6, "is_abnormal": 1, "recorded_at": "2026-08-25"},
        {"id": "lm_03", "lab_report_id": "lab_01", "patient_id": "pat_01", "metric_name": "Total Cholesterol", "value": 190.0, "unit": "mg/dL", "reference_min": 125.0, "reference_max": 200.0, "is_abnormal": 0, "recorded_at": "2026-08-25"},
    ])

    patient_db.alerts.insert_many([
        {"id": "alt_01", "patient_id": "pat_01", "patient_name": "John Doe", "doctor_id": "doc_01", "type": "lab", "severity": "critical", "title": "New abnormal lab result", "message": "Fasting Blood Glucose: 142 mg/dL (High)", "is_read": 0, "created_at": now},
        {"id": "alt_02", "patient_id": "pat_02", "patient_name": "Emma Watson", "doctor_id": "doc_01", "type": "followup", "severity": "important", "title": "Follow-up consultation due", "message": "Routine 30-day medication check", "is_read": 0, "created_at": now},
        {"id": "alt_03", "patient_id": "pat_03", "patient_name": "Robert Chen", "doctor_id": "doc_01", "type": "adherence", "severity": "attention", "title": "Medication adherence dropped", "message": "Missed 3 consecutive doses of Lisinopril", "is_read": 0, "created_at": now},
    ])

    patient_db.appointments.insert_many([
        {"id": "apt_01", "patient_id": "pat_01", "doctor_id": "doc_01", "patient_name": "John Doe", "doctor_name": "Dr. Sarah Smith", "appointment_date": "2026-08-28T10:00:00Z", "reason": "Hypertension Follow-up & Lab Review", "status": "confirmed", "notes": None, "created_at": now},
        {"id": "apt_02", "patient_id": "pat_02", "doctor_id": "doc_01", "patient_name": "Emma Watson", "doctor_name": "Dr. Sarah Smith", "appointment_date": "2026-08-28T11:30:00Z", "reason": "Routine Consultation & Vitals Check", "status": "confirmed", "notes": None, "created_at": now},
    ])

    patient_db.patient_snapshots.insert_one({
        "id": "snap_01", "patient_id": "pat_01", "diagnosis": "Mild Hypertension & Pre-diabetes",
        "adherence_rate": "86%", "last_visit_date": "Aug 12", "next_visit_date": "Aug 30",
        "attention_items_count": 2, "updated_at": now,
    })
