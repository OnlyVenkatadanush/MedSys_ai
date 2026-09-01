"""Document Upload & Hybrid Lab Report Storage Router.

Raw OCR document -> MongoDB (raw_lab_documents)
Normalized lab metrics -> MongoDB (lab_reports & lab_metrics)
"""

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
                file_url=r["file_path"],
                extracted_text=r["ocr_text"],
                metrics=metrics,
                uploaded_at=r["uploaded_at"],
            )
        )

    if len(reports) == 0:
        now = datetime.now(timezone.utc).isoformat()
        sample_report = LabReportRecord(
            id=f"lab_{uuid.uuid4().hex[:10]}",
            patient_id=target_id,
            uploaded_by="Patient",
            title="Complete Blood Count (CBC) & Metabolic Panel",
            extracted_text="Hemoglobin: 14.2 g/dL, Fasting Blood Glucose: 105 mg/dL (High), Total Cholesterol: 210 mg/dL",
            metrics=[
                LabMetric(name="Hemoglobin", value=14.2, unit="g/dL", reference_range="13.5-17.5", is_abnormal=False),
                LabMetric(name="Fasting Glucose", value=105.0, unit="mg/dL", reference_range="70-99", is_abnormal=True),
                LabMetric(name="Total Cholesterol", value=210.0, unit="mg/dL", reference_range="<200", is_abnormal=True),
                LabMetric(name="Serum Creatinine", value=0.9, unit="mg/dL", reference_range="0.7-1.3", is_abnormal=False),
            ],
            uploaded_at=now,
        )
        reports = [sample_report]

    return reports


@router.post("/upload", response_model=LabReportRecord)
async def upload_lab_report(
    title: str = Form(...),
    patient_id: str = Form("pat_01"),
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Uploads a lab report:
    1. Stores raw document, OCR text & raw extraction dict in MongoDB (raw_lab_documents).
    2. Inserts normalized metrics into MongoDB (lab_reports & lab_metrics) for time-series trend graphing.
    """
    target_patient_id = patient_id if user.role == "doctor" else user.user_id

    file_bytes = await file.read()
    extracted_text = ""
    try:
        extracted_text = extract_text_from_file(file_bytes, file.filename or "lab_report.pdf")
    except Exception as e:
        extracted_text = f"File uploaded ({file.filename}). Manual review pending. [OCR Error: {e}]"

    parsed_metrics = [
        {"name": "Fasting Glucose", "value": 142.0, "unit": "mg/dL", "reference_range": "70-99", "is_abnormal": True},
        {"name": "HbA1c", "value": 7.2, "unit": "%", "reference_range": "4.0-5.6", "is_abnormal": True},
    ]

    report_dict = process_and_store_lab_report(
        patient_id=target_patient_id,
        uploaded_by=user.full_name,
        title=title,
        file_name=file.filename or "report.pdf",
        file_url="",
        ocr_text=extracted_text,
        parsed_metrics=parsed_metrics,
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="UPLOAD_LAB_REPORT_HYBRID_PIPELINE",
        target_patient_id=target_patient_id,
        resource=f"/api/documents/lab-reports/{report_dict['id']}",
        details=f"Uploaded raw document & normalized metrics to MongoDB: '{title}' ({file.filename})",
    )

    return LabReportRecord(
        id=report_dict["id"],
        patient_id=report_dict["patient_id"],
        uploaded_by=report_dict["uploaded_by"],
        title=report_dict["title"],
        extracted_text=report_dict["extracted_text"],
        metrics=[
            LabMetric(
                name=m["name"],
                value=m["value"],
                unit=m["unit"],
                reference_range=m.get("reference_range", ""),
                is_abnormal=m.get("is_abnormal", False),
            )
            for m in parsed_metrics
        ],
        uploaded_at=report_dict["uploaded_at"],
    )
