"""SQLite Database Layer: Native relational SQLite storage for MedSys AI 2.0.

Implements all 20 normalized tables including patient_invitations, foreign keys, and indices.
Persists cleanly to backend/medsys.db.
"""

import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "medsys.db")


def get_sqlite_conn():
    """Establishes connection to medsys.db with WAL mode and foreign key enforcement enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_sqlite_db():
    """Creates all relational tables and populates initial seed data if empty."""
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    # 1. doctors
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        specialization TEXT,
        license_number TEXT,
        hospital_name TEXT,
        experience_years INTEGER,
        created_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    );
    """)

    # 2. patients
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        patient_id_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        dob TEXT,
        age INTEGER,
        gender TEXT,
        blood_group TEXT,
        height_cm REAL,
        weight_kg REAL,
        phone TEXT,
        email TEXT UNIQUE NOT NULL,
        address TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        account_state TEXT DEFAULT 'PENDING_ACTIVATION',
        created_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    );
    """)

    # 3. doctor_patient
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS doctor_patient (
        id TEXT PRIMARY KEY,
        doctor_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        FOREIGN KEY(doctor_id) REFERENCES doctors(id),
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 4. patient_invitations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patient_invitations (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        email TEXT NOT NULL,
        invitation_token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 5. patient_conditions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patient_conditions (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        condition_name TEXT NOT NULL,
        diagnosed_date TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 6. allergies
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS allergies (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        allergen TEXT NOT NULL,
        reaction TEXT,
        severity TEXT DEFAULT 'moderate',
        notes TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 7. consultations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        symptoms TEXT,
        vitals_json TEXT,
        preliminary_notes TEXT,
        ai_summary TEXT,
        ai_differential TEXT,
        final_diagnosis TEXT,
        doctor_notes TEXT,
        diet_advice TEXT,
        follow_up_date TEXT,
        status TEXT DEFAULT 'draft',
        created_at TEXT NOT NULL,
        finalized_at TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    );
    """)

    # 8. medications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        generic_name TEXT,
        description TEXT
    );
    """)

    # 9. prescriptions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        consultation_id TEXT,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        medication_name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        frequency TEXT NOT NULL,
        duration_days INTEGER DEFAULT 7,
        instructions TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    );
    """)

    # 10. medication_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medication_logs (
        id TEXT PRIMARY KEY,
        prescription_id TEXT,
        patient_id TEXT NOT NULL,
        medication_name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        scheduled_at TEXT,
        taken_at TEXT NOT NULL,
        status TEXT DEFAULT 'taken',
        notes TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 11. vitals
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vitals (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        consultation_id TEXT,
        systolic_bp INTEGER,
        diastolic_bp INTEGER,
        heart_rate INTEGER,
        temperature_c REAL,
        spo2_pct INTEGER,
        recorded_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 12. lab_reports
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lab_reports (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        title TEXT NOT NULL,
        file_path TEXT,
        ocr_text TEXT,
        report_date TEXT,
        uploaded_at TEXT NOT NULL,
        status TEXT DEFAULT 'processed',
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 13. lab_metrics
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lab_metrics (
        id TEXT PRIMARY KEY,
        lab_report_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        reference_min REAL,
        reference_max REAL,
        is_abnormal INTEGER DEFAULT 0,
        recorded_at TEXT NOT NULL,
        FOREIGN KEY(lab_report_id) REFERENCES lab_reports(id),
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 14. meal_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS meal_logs (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        food_items TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 15. appointments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        patient_name TEXT,
        doctor_name TEXT,
        appointment_date TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'requested',
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    );
    """)

    # 16. ai_chat_sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id TEXT PRIMARY KEY,
        doctor_id TEXT,
        patient_id TEXT NOT NULL,
        title TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    # 17. ai_chat_messages
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES ai_chat_sessions(id)
    );
    """)

    # 18. alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'attention',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    );
    """)

    # 19. audit_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_patient_id TEXT,
        resource TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # 20. patient_snapshots
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patient_snapshots (
        id TEXT PRIMARY KEY,
        patient_id TEXT UNIQUE NOT NULL,
        diagnosis TEXT,
        adherence_rate TEXT,
        last_visit_date TEXT,
        next_visit_date TEXT,
        attention_items_count INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    """)

    conn.commit()

    # Seed Initial Seed Data if Doctors table is empty
    cursor.execute("SELECT COUNT(*) FROM doctors;")
    if cursor.fetchone()[0] == 0:
        now = datetime.now(timezone.utc).isoformat()
        
        # Insert Doctor
        cursor.execute("""
        INSERT INTO doctors (id, name, email, phone, specialization, license_number, hospital_name, experience_years, created_at)
        VALUES ('doc_01', 'Dr. Sarah Smith', 'dr.smith@medsys.ai', '+1-555-0100', 'Cardiology & Internal Medicine', 'MD-994821', 'St. Jude Medical Center', 12, ?);
        """, (now,))

        # Insert Patients
        cursor.executemany("""
        INSERT INTO patients (id, patient_id_code, name, dob, age, gender, blood_group, height_cm, weight_kg, phone, email, emergency_contact_name, emergency_contact_phone, account_state, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?);
        """, [
            ("pat_01", "PAT-000124", "John Doe", "1984-05-12", 42, "Male", "O+", 178.0, 75.0, "+1-555-0123", "john.doe@example.com", "Jane Doe", "+1-555-0199", now),
            ("pat_02", "PAT-000125", "Emma Watson", "1997-09-24", 29, "Female", "A+", 165.0, 58.0, "+1-555-0144", "emma.watson@example.com", "David Watson", "+1-555-0188", now),
            ("pat_03", "PAT-000126", "Robert Chen", "1965-02-18", 61, "Male", "B+", 172.0, 82.0, "+1-555-0188", "robert.chen@example.com", "Lisa Chen", "+1-555-0177", now),
        ])

        # Insert Assignments
        cursor.executemany("""
        INSERT INTO doctor_patient (id, doctor_id, patient_id, assigned_at, status)
        VALUES (?, ?, ?, ?, 'active');
        """, [
            ("asgn_01", "doc_01", "pat_01", now),
            ("asgn_02", "doc_01", "pat_02", now),
            ("asgn_03", "doc_01", "pat_03", now),
        ])

        # Insert Invitations
        cursor.executemany("""
        INSERT INTO patient_invitations (id, patient_id, email, invitation_token, expires_at, status, created_at)
        VALUES (?, ?, ?, ?, '2026-12-31T23:59:59Z', 'activated', ?);
        """, [
            ("inv_01", "pat_01", "john.doe@example.com", "token_pat01_active", now),
            ("inv_02", "pat_02", "emma.watson@example.com", "token_pat02_active", now),
            ("inv_03", "pat_03", "robert.chen@example.com", "token_pat03_active", now),
        ])

        # Insert Patient Conditions & Allergies
        cursor.execute("INSERT INTO patient_conditions VALUES ('cond_01', 'pat_01', 'Mild Hypertension', '2025-01-10', 'active', 'Controlled with Lisinopril 10mg');")
        cursor.execute("INSERT INTO patient_conditions VALUES ('cond_02', 'pat_01', 'Early Pre-diabetes', '2025-06-15', 'active', 'Dietary tracking');")
        cursor.execute("INSERT INTO allergies VALUES ('alg_01', 'pat_01', 'Penicillin', 'Skin rash, anaphylaxis warning', 'severe', 'Avoid all beta-lactams');")

        # Insert Vitals
        cursor.execute("INSERT INTO vitals VALUES ('vit_01', 'pat_01', NULL, 135, 85, 78, 38.2, 98, ?);", (now,))

        # Insert Prescriptions
        cursor.executemany("""
        INSERT INTO prescriptions (id, consultation_id, patient_id, doctor_id, medication_name, dosage, frequency, duration_days, instructions, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
        """, [
            ("rx_01", None, "pat_01", "doc_01", "Lisinopril", "10 mg", "Once daily in morning", 30, "Take with water", now),
            ("rx_02", None, "pat_01", "doc_01", "Metformin", "500 mg", "Twice daily with meals", 30, "Take with meals", now),
        ])

        # Insert Lab Reports & Metrics
        cursor.execute("INSERT INTO lab_reports VALUES ('lab_01', 'pat_01', 'pat_01', 'Metabolic & Lipid Panel', NULL, 'Glucose: 142 mg/dL, HbA1c: 7.2%', '2026-08-25', ?, 'processed');", (now,))
        cursor.executemany("""
        INSERT INTO lab_metrics (id, lab_report_id, patient_id, metric_name, value, unit, reference_min, reference_max, is_abnormal, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, [
            ("lm_01", "lab_01", "pat_01", "Fasting Glucose", 142.0, "mg/dL", 70.0, 99.0, 1, "2026-08-25"),
            ("lm_02", "lab_01", "pat_01", "HbA1c", 7.2, "%", 4.0, 5.6, 1, "2026-08-25"),
            ("lm_03", "lab_01", "pat_01", "Total Cholesterol", 190.0, "mg/dL", 125.0, 200.0, 0, "2026-08-25"),
        ])

        # Insert Alerts
        cursor.executemany("""
        INSERT INTO alerts (id, patient_id, patient_name, doctor_id, type, severity, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?);
        """, [
            ("alt_01", "pat_01", "John Doe", "doc_01", "lab", "critical", "New abnormal lab result", "Fasting Blood Glucose: 142 mg/dL (High)", now),
            ("alt_02", "pat_02", "Emma Watson", "doc_01", "followup", "important", "Follow-up consultation due", "Routine 30-day medication check", now),
            ("alt_03", "pat_03", "Robert Chen", "doc_01", "adherence", "attention", "Medication adherence dropped", "Missed 3 consecutive doses of Lisinopril", now),
        ])

        # Insert Appointments
        cursor.executemany("""
        INSERT INTO appointments (id, patient_id, doctor_id, patient_name, doctor_name, appointment_date, reason, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', NULL, ?);
        """, [
            ("apt_01", "pat_01", "doc_01", "John Doe", "Dr. Sarah Smith", "2026-08-28T10:00:00Z", "Hypertension Follow-up & Lab Review", now),
            ("apt_02", "pat_02", "doc_01", "Emma Watson", "Dr. Sarah Smith", "2026-08-28T11:30:00Z", "Routine Consultation & Vitals Check", now),
        ])

        # Insert Patient Snapshot
        cursor.execute("""
        INSERT INTO patient_snapshots (id, patient_id, diagnosis, adherence_rate, last_visit_date, next_visit_date, attention_items_count, updated_at)
        VALUES ('snap_01', 'pat_01', 'Mild Hypertension & Pre-diabetes', '86%', 'Aug 12', 'Aug 30', 2, ?);
        """, (now,))

        conn.commit()

    conn.close()


# Initialize database automatically on module import
init_sqlite_db()
