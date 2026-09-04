"""Document Upload & Hybrid Lab Report Storage Router.

Raw OCR document -> MongoDB (raw_lab_documents)
Normalized lab metrics -> MongoDB (lab_reports & lab_metrics)
"""

import os
import re
from datetime import datetime, timezone
import uuid
from typing import List
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException

from app.db import get_patient_db
from app.models_v2 import LabMetric, LabReportRecord
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, get_current_user
from app.services.hybrid_db_service import process_and_store_lab_report
from app.services.ocr import extract_text_from_file

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/lab-reports", response_model=List[LabReportRecord])
async def list_lab_reports(
    patient_id: str = "pat_01",
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lists uploaded lab reports for target patient from MongoDB Atlas."""
    target_id = patient_id if user.role == "doctor" else user.user_id
    db = get_patient_db()

    rows = list(db.lab_reports.find({"patient_id": target_id}, {"_id": 0}).sort("uploaded_at", -1))

    reports = []
    for r in rows:
        m_rows = list(db.lab_metrics.find({"lab_report_id": r["id"]}, {"_id": 0}))
        metrics = [
            LabMetric(
                name=m["metric_name"],
                value=m["value"],
                unit=m["unit"],
                reference_range=f"{m['reference_min']}-{m['reference_max']}",
                is_abnormal=bool(m["is_abnormal"]),
            )
            for m in m_rows
        ]
        reports.append(
            LabReportRecord(
                id=r["id"],
                patient_id=r["patient_id"],
                uploaded_by=r["uploaded_by"],
                title=r["title"],
                file_url=r.get("file_path") or r.get("file_url") or "",
                extracted_text=r["ocr_text"],
                metrics=metrics,
                uploaded_at=r["uploaded_at"],
            )
        )

    return reports


@router.post("/upload", response_model=LabReportRecord)
async def upload_lab_report(
    title: str = Form(...),
    patient_id: str = Form("pat_01"),
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Uploads a lab report through the Unified Ingestion Pipeline:
    1. Saves physical binary to backend/uploads/ with static file_url.
    2. Runs OCR text extraction.
    3. Runs model_router report summary & structured lab metric extraction.
    4. Inserts normalized metrics into MongoDB (lab_reports & lab_metrics) for time-series trend graphing.
    5. Ingests document into Pinecone Vector RAG & db.sources so Chat can cite it.
    6. Logs document into Supermemory Knowledge Graph.
    """
    target_patient_id = patient_id if user.role == "doctor" else user.user_id
    file_bytes = await file.read()
    orig_name = file.filename or "lab_report.pdf"

    from app.services.hybrid_db_service import ingest_unified_medical_document

    doc_result = await ingest_unified_medical_document(
        file_bytes=file_bytes,
        original_filename=orig_name,
        title=title,
        patient_id=target_patient_id,
        uploaded_by=user.full_name,
        user_id=user.user_id,
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="UPLOAD_LAB_REPORT_UNIFIED_PIPELINE",
        target_patient_id=target_patient_id,
        resource=f"/api/documents/lab-reports/{doc_result['id']}",
        details=f"Uploaded raw document, normalized metrics & Pinecone indexed: '{title}' ({orig_name})",
    )

    return LabReportRecord(
        id=doc_result["id"],
        patient_id=doc_result["patient_id"],
        uploaded_by=doc_result["uploaded_by"],
        title=doc_result["title"],
        file_url=doc_result["file_url"],
        extracted_text=doc_result["extracted_text"],
        metrics=[
            LabMetric(
                name=m["name"],
                value=m["value"],
                unit=m.get("unit", ""),
                reference_range=m.get("reference_range", ""),
                is_abnormal=m.get("is_abnormal", False),
            )
            for m in doc_result.get("metrics", [])
        ],
        uploaded_at=doc_result["uploaded_at"],
    )

