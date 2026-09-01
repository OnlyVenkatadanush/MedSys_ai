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
    if not (settings.ollama_vision_model or settings.groq_api_key):
        raise HTTPException(
            status_code=503,
            detail="No vision model configured — set OLLAMA_VISION_MODEL or GROQ_API_KEY.",
        )
    if not (settings.ollama_model or settings.groq_api_key):
        raise HTTPException(
            status_code=503,
            detail="No text model configured — set OLLAMA_MODEL or GROQ_API_KEY.",
        )

    filename = file.filename or "Untitled document"
    raw = await file.read()

    if filename.lower().endswith(TEXT_EXTENSIONS):
        extracted_text = raw.decode("utf-8", errors="ignore")
    else:
        images = ocr.images_from_upload(filename, raw)
        extracted_text = await ocr.extract_text(images)

    report, kind = await asyncio.gather(
        model_router.generate_report(extracted_text, filename),
        model_router.classify_document(extracted_text),
    )
    # Conditions/medications are extracted once, right now, instead of live
    # on every Profile visit — Profile just reads the cached result back.
    extracted = await model_router.extract_medical_history([report])

    source = rag.ingest_report(filename, kind, report, owner_id=user_id, extracted=extracted)
    await supermemory_client.log_document(source["id"], filename, kind, report, user_id)
    return source
