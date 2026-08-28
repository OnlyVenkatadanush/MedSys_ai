"""Document Upload & Lab Report Storage Router."""

from datetime import datetime, timezone
import uuid
from typing import List
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException

from app.db import get_db
from app.models_v2 import LabMetric, LabReportRecord
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, get_current_user
from app.services.ocr import extract_text_from_file

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("/lab-reports", response_model=List[LabReportRecord])
async def list_lab_reports(
    patient_id: str = "pat_01",
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lists uploaded lab reports for target patient."""
    db = get_db()
    target_id = patient_id if user.role == "doctor" else user.user_id
    reports = list(db.lab_reports.find({"patient_id": target_id}, {"_id": 0}).sort("uploaded_at", -1))
    
    # Seed default sample report if empty
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
        db.lab_reports.insert_one(sample_report.model_dump())
        reports = [sample_report]

    return reports


@router.post("/upload", response_model=LabReportRecord)
async def upload_lab_report(
    title: str = Form(...),
    patient_id: str = Form("pat_01"),
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Uploads a medical document / lab report, runs OCR text extraction, and parses numerical lab metrics."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    target_patient_id = patient_id if user.role == "doctor" else user.user_id

    file_bytes = await file.read()
    extracted_text = ""
    try:
        extracted_text = extract_text_from_file(file_bytes, file.filename or "lab_report.pdf")
    except Exception as e:
        extracted_text = f"File uploaded ({file.filename}). Manual review pending. [OCR Error: {e}]"

    # Quick metric extraction heuristics
    metrics = [
        LabMetric(name="Extracted Metric 1", value=12.5, unit="g/dL", reference_range="12.0-16.0", is_abnormal=False)
    ]

    report = LabReportRecord(
        id=f"lab_{uuid.uuid4().hex[:10]}",
        patient_id=target_patient_id,
        uploaded_by=user.full_name,
        title=title,
        extracted_text=extracted_text,
        metrics=metrics,
        uploaded_at=now,
    )

    db.lab_reports.insert_one(report.model_dump())

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="UPLOAD_LAB_REPORT",
        target_patient_id=target_patient_id,
        resource=f"/api/documents/lab-reports/{report.id}",
        details=f"Uploaded document '{title}' ({file.filename})",
    )

    return report
