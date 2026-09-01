"""AI/document store + clinical decision persistence — all MongoDB Atlas.

- raw_lab_documents: raw uploaded document, OCR text, raw extraction JSON.
- lab_reports / lab_metrics: normalized metrics for trend graphing.
- ai_chat_sessions / ai_chat_messages: flexible AI Copilot conversation logs.
- ai_generated_insights: reasoning traces, pre-briefs, advisory outputs.
- consultations / prescriptions: finalized clinical treatment decisions.
"""

from datetime import datetime, timezone
import uuid
from typing import Dict, Any, List, Optional

from app.db import get_patient_db


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
    """Stores the raw uploaded document, OCR text, and extraction payload in
    `raw_lab_documents`, then normalizes metrics into `lab_reports` &
    `lab_metrics` for trend graphing."""
    lab_report_id = f"lab_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    db = get_patient_db()

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
    db.raw_lab_documents.insert_one(raw_doc)

    db.lab_reports.insert_one({
        "id": lab_report_id,
        "patient_id": patient_id,
        "uploaded_by": uploaded_by,
        "title": title,
        "file_path": file_url or "",
        "ocr_text": ocr_text[:500],
        "report_date": now[:10],
        "uploaded_at": now,
        "status": "processed",
    })

    metrics_docs = []
    for m in parsed_metrics:
        metrics_docs.append({
            "id": f"lm_{uuid.uuid4().hex[:10]}",
            "lab_report_id": lab_report_id,
            "patient_id": patient_id,
            "metric_name": m.get("name", "Metric"),
            "value": float(m.get("value", 0.0)),
            "unit": m.get("unit", ""),
            "reference_min": 70.0,
            "reference_max": 99.0,
            "is_abnormal": 1 if m.get("is_abnormal", False) else 0,
            "recorded_at": now[:10],
        })
    if metrics_docs:
        db.lab_metrics.insert_many(metrics_docs)

    return {
        "id": lab_report_id,
        "patient_id": patient_id,
        "uploaded_by": uploaded_by,
        "title": title,
        "extracted_text": ocr_text,
        "metrics": parsed_metrics,
        "uploaded_at": now,
    }


# ==================== 2. AI CHAT STORE ====================

def store_ai_chat_message(
    doctor_id: Optional[str],
    patient_id: str,
    sender: str,
    message: str,
) -> Dict[str, Any]:
    """Stores flexible AI Copilot chat sessions and messages."""
    now = datetime.now(timezone.utc).isoformat()
    msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    db = get_patient_db()

    session = db.ai_chat_sessions.find_one({"patient_id": patient_id})
    if not session:
        session_id = f"sess_{uuid.uuid4().hex[:10]}"
        db.ai_chat_sessions.insert_one({
            "id": session_id,
            "doctor_id": doctor_id,
            "patient_id": patient_id,
            "title": f"Clinical Copilot Session - Patient {patient_id}",
            "created_at": now,
            "updated_at": now,
        })
    else:
        session_id = session["id"]
        db.ai_chat_sessions.update_one({"id": session_id}, {"$set": {"updated_at": now}})

    db.ai_chat_messages.insert_one({
        "id": msg_id,
        "session_id": session_id,
        "sender": sender,
        "message": message,
        "created_at": now,
    })

    return {
        "id": msg_id,
        "patient_id": patient_id,
        "sender": sender,
        "message": message,
        "created_at": now,
    }


# ==================== 3. AI GENERATED INSIGHTS STORE ====================

def save_ai_insight(
    patient_id: str,
    insight_type: str,
    summary: str,
    evidence_sources: List[str],
) -> Dict[str, Any]:
    """Stores AI-generated advisory reasoning, pre-briefs, and timeline analyses."""
    now = datetime.now(timezone.utc).isoformat()
    insight_id = f"ins_{uuid.uuid4().hex[:10]}"

    get_patient_db().ai_generated_insights.insert_one({
        "id": insight_id,
        "patient_id": patient_id,
        "insight_type": insight_type,
        "summary": summary,
        "evidence_sources": evidence_sources,
        "created_at": now,
    })

    return {
        "insight_id": insight_id,
        "patient_id": patient_id,
        "insight_type": insight_type,
        "summary": summary,
        "evidence_sources": evidence_sources,
        "created_at": now,
    }


# ==================== 4. OFFICIAL CLINICAL DECISION STORE ====================

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
    """Persists official finalized clinical treatment decisions."""
    now = datetime.now(timezone.utc).isoformat()
    db = get_patient_db()

    diet_str = ", ".join(diet_advice) if diet_advice else ""

    db.consultations.update_one(
        {"id": session_id},
        {"$set": {
            "final_diagnosis": diagnosis,
            "doctor_notes": notes,
            "diet_advice": diet_str,
            "follow_up_date": follow_up_date,
            "status": "finalized",
            "finalized_at": now,
        }},
    )

    if prescriptions:
        db.prescriptions.insert_many([
            {
                "id": f"rx_{uuid.uuid4().hex[:10]}",
                "consultation_id": session_id,
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "medication_name": rx.get("medication_name"),
                "dosage": rx.get("dosage"),
                "frequency": rx.get("frequency"),
                "duration_days": rx.get("duration_days", 30),
                "instructions": rx.get("instructions", ""),
                "status": "active",
                "created_at": now,
            }
            for rx in prescriptions
        ])

    return {
        "session_id": session_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "diagnosis": diagnosis,
        "prescriptions_count": len(prescriptions),
        "finalized_at": now,
    }
