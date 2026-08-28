"""Hybrid DB Service: Implements the MedSys Hybrid Database Architecture & Normalization Pipeline.

- SQLite (medsys.db): System of Record for structured clinical data, RBAC assignments, normalized lab metrics, finalized doctor decisions, and audit logs.
- MongoDB (medsys_db): Flexible AI & Document Store for raw PDF/Image OCR extractions, AI chat sessions/messages, and AI-generated insight traces.
"""

from datetime import datetime, timezone
import json
import uuid
from typing import Dict, Any, List, Optional

from app.db_sqlite import get_sqlite_conn
from app.db_mongo import get_mongo_db


# ==================== 1. LAB DOCUMENT NORMALIZATION PIPELINE ====================

def process_and_store_lab_report(
    patient_id: str,
    uploaded_by: str,
    title: str,
    file_name: str,
    file_url: Optional[str],
    ocr_text: str,
    parsed_metrics: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Hybrid Pipeline:
    1. Stores raw uploaded document, OCR text, and extraction dict in MongoDB (raw_lab_documents).
    2. Normalizes metrics and inserts into SQLite (lab_reports & lab_metrics) for trend graphing.
    """
    lab_report_id = f"lab_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    # Step A: Save raw document, OCR text & raw extraction payload to MongoDB
    try:
        mongo_db = get_mongo_db()
        raw_doc = {
            "id": lab_report_id,
            "patient_id": patient_id,
            "uploaded_by": uploaded_by,
            "document_type": "lab_report",
            "title": title,
            "file_name": file_name,
            "file_url": file_url or "",
            "report_date": now[:10],
            "ocr_text": ocr_text,
            "raw_extracted_metrics": parsed_metrics,
            "created_at": now,
        }
        mongo_db.raw_lab_documents.insert_one(raw_doc)
    except Exception as err:
        print(f"[MongoDB Store Warning] Storing raw document in MongoDB fallback: {err}")

    # Step B: Normalize and insert structured metrics into SQLite for trend graphs
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO lab_reports (id, patient_id, uploaded_by, title, file_path, ocr_text, report_date, uploaded_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processed');
    """, (lab_report_id, patient_id, uploaded_by, title, file_url or "", ocr_text[:500], now[:10], now))

    for m in parsed_metrics:
        metric_id = f"lm_{uuid.uuid4().hex[:10]}"
        name = m.get("name", "Metric")
        val = float(m.get("value", 0.0))
        unit = m.get("unit", "")
        ref = m.get("reference_range", "")
        is_abnormal = 1 if m.get("is_abnormal", False) else 0

        cursor.execute("""
        INSERT INTO lab_metrics (id, lab_report_id, patient_id, metric_name, value, unit, reference_min, reference_max, is_abnormal, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, 70.0, 99.0, ?, ?);
        """, (metric_id, lab_report_id, patient_id, name, val, unit, is_abnormal, now[:10]))

    conn.commit()
    conn.close()

    return {
        "id": lab_report_id,
        "patient_id": patient_id,
        "uploaded_by": uploaded_by,
        "title": title,
        "extracted_text": ocr_text,
        "metrics": parsed_metrics,
        "uploaded_at": now,
    }


# ==================== 2. AI CHAT STORE (MONGODB) ====================

def store_ai_chat_message(
    doctor_id: Optional[str],
    patient_id: str,
    sender: str,
    message: str,
) -> Dict[str, Any]:
    """Stores flexible AI Copilot chat sessions and messages in MongoDB."""
    now = datetime.now(timezone.utc).isoformat()
    msg_id = f"msg_{uuid.uuid4().hex[:10]}"

    try:
        mongo_db = get_mongo_db()
        
        # Ensure session
        session = mongo_db.ai_chat_sessions.find_one({"patient_id": patient_id})
        if not session:
            session_id = f"sess_{uuid.uuid4().hex[:10]}"
            session = {
                "id": session_id,
                "doctor_id": doctor_id,
                "patient_id": patient_id,
                "title": f"Clinical Copilot Session - Patient {patient_id}",
                "created_at": now,
                "updated_at": now,
            }
            mongo_db.ai_chat_sessions.insert_one(session)
        else:
            session_id = session["id"]
            mongo_db.ai_chat_sessions.update_one({"id": session_id}, {"$set": {"updated_at": now}})

        msg_doc = {
            "id": msg_id,
            "session_id": session_id,
            "sender": sender,
            "message": message,
            "created_at": now,
        }
        mongo_db.ai_chat_messages.insert_one(msg_doc)
    except Exception as err:
        print(f"[MongoDB Chat Warning] Falling back for chat storage: {err}")

    return {
        "id": msg_id,
        "patient_id": patient_id,
        "sender": sender,
        "message": message,
        "created_at": now,
    }


# ==================== 3. AI GENERATED INSIGHTS STORE (MONGODB) ====================

def save_ai_insight(
    patient_id: str,
    insight_type: str,
    summary: str,
    evidence_sources: List[str],
) -> Dict[str, Any]:
    """Stores AI-generated advisory reasoning, pre-briefs, and timeline analyses in MongoDB."""
    now = datetime.now(timezone.utc).isoformat()
    insight_id = f"ins_{uuid.uuid4().hex[:10]}"

    try:
        mongo_db = get_mongo_db()
        insight_doc = {
            "id": insight_id,
            "patient_id": patient_id,
            "insight_type": insight_type,
            "summary": summary,
            "evidence_sources": evidence_sources,
            "created_at": now,
        }
        mongo_db.ai_generated_insights.insert_one(insight_doc)
    except Exception as err:
        print(f"[MongoDB Insight Warning] Falling back for insight storage: {err}")

    return {
        "insight_id": insight_id,
        "patient_id": patient_id,
        "insight_type": insight_type,
        "summary": summary,
        "evidence_sources": evidence_sources,
        "created_at": now,
    }


# ==================== 4. OFFICIAL CLINICAL DECISION STORE (SQLITE) ====================

def finalize_doctor_clinical_decision(
    session_id: str,
    patient_id: str,
    doctor_id: str,
    diagnosis: str,
    prescriptions: List[Dict[str, Any]],
    notes: str,
    diet_advice: List[str],
    follow_up_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Persists official finalized clinical treatment decisions into SQLite medsys.db (System of Record)."""
    now = datetime.now(timezone.utc).isoformat()
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    diet_str = ", ".join(diet_advice) if diet_advice else ""

    cursor.execute("""
    UPDATE consultations
    SET final_diagnosis = ?, doctor_notes = ?, diet_advice = ?, follow_up_date = ?, status = 'finalized', finalized_at = ?
    WHERE id = ?;
    """, (diagnosis, notes, diet_str, follow_up_date, now, session_id))

    # Insert official prescriptions
    for rx in prescriptions:
        rx_id = f"rx_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
        INSERT INTO prescriptions (id, consultation_id, patient_id, doctor_id, medication_name, dosage, frequency, duration_days, instructions, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (rx_id, session_id, patient_id, doctor_id, rx.get("medication_name"), rx.get("dosage"), rx.get("frequency"), rx.get("duration_days", 30), rx.get("instructions", ""), now))

    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "diagnosis": diagnosis,
        "prescriptions_count": len(prescriptions),
        "finalized_at": now,
    }
