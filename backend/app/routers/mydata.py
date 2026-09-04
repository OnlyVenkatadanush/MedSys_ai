import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.models import ChatSource
from app.services import model_router, ocr, rag, supermemory_client
from app.services.clerk_auth import require_clerk_auth

router = APIRouter(prefix="/mydata", tags=["mydata"])

TEXT_EXTENSIONS = (".txt", ".md")


@router.post("/upload", response_model=ChatSource)
async def upload_mydata(
    file: UploadFile = File(...), user_id: str = Depends(require_clerk_auth)
) -> dict:
    filename = file.filename or "Untitled document"
    raw = await file.read()

    from app.services.hybrid_db_service import ingest_unified_medical_document
    from app.db import get_patient_db

    db = get_patient_db()
    pat = db.patients.find_one({"$or": [{"id": user_id}, {"clerk_id": user_id}]}, {"_id": 0})
    patient_name = pat.get("name", "Patient") if pat else "Patient"
    patient_id = pat.get("id", user_id) if pat else user_id

    doc_result = await ingest_unified_medical_document(
        file_bytes=raw,
        original_filename=filename,
        title=filename,
        patient_id=patient_id,
        uploaded_by=patient_name,
        user_id=user_id,
    )

    from datetime import datetime, timezone
    return {
        "id": doc_result["source_id"],
        "title": filename,
        "kind": doc_result.get("kind", "report"),
        "uploadedAt": doc_result.get("uploaded_at", datetime.now(timezone.utc).isoformat()),
        "excerpt": doc_result.get("report_summary", "")[:300],
        "url": doc_result.get("file_url"),
    }
