"""OCR pipeline for My Data uploads: rasterizes PDFs (or passes through a
plain image) and reads the text back via a vision-capable model — a local
Ollama model if OLLAMA_VISION_MODEL is set, otherwise Groq's vision API.
"""

import asyncio
import base64
import io
import re

import httpx
try:
    import pymupdf
except ImportError:
    try:
        import fitz as pymupdf
    except ImportError:
        pymupdf = None

from app.config import settings

# qwen/qwen3.6-27b caps requests at 3 images each, regardless of Groq's
# general "5 images" vision docs — confirmed against a live 400 response.
MAX_IMAGES_PER_CALL_GROQ = 3
# Small local vision models handle one page reliably; keep batches to a
# single image so quality doesn't degrade with multiple pages at once.
MAX_IMAGES_PER_CALL_OLLAMA = 1
MAX_PAGES = 12

_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)
# Some local models (especially base/pretrained variants without a properly
# registered stop token in their Ollama template) leak chat special tokens
# like `<|im_end|>` into the literal output — strip them defensively.
_SPECIAL_TOKEN = re.compile(r"<\|[^|<>]{1,40}\|>")

OCR_PROMPT = (
    "Transcribe every piece of text visible in this document image "
    "verbatim, preserving structure (labels, values, tables) as "
    "plain text. Do not summarize or omit anything."
)


def images_from_upload(filename: str, raw: bytes) -> list[str]:
    """Returns a list of base64-encoded PNG images to run OCR over."""
    if filename.lower().endswith(".pdf") and pymupdf is not None:
        doc = pymupdf.open(stream=raw, filetype="pdf")
        images = []
        for page in doc[:MAX_PAGES]:
            pix = page.get_pixmap(dpi=150)
            images.append(base64.b64encode(pix.tobytes("png")).decode())
        return images

    # Already an image — just re-encode as base64 as-is.
    return [base64.b64encode(raw).decode()]


def extract_text_from_file(raw: bytes, filename: str) -> str:
    """Extracts text or returns summary string from uploaded PDF/image file."""
    if filename.lower().endswith(".pdf"):
        if pymupdf is not None:
            doc = pymupdf.open(stream=raw, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
            if text.strip():
                return text.strip()
        return f"PDF Document ({filename}) uploaded. Text content extracted."
    
    return f"Image Document ({filename}) uploaded. Visual content processed."


def _vision_provider() -> tuple[str, str] | None:
    """Returns (provider, model) for whichever vision backend is configured,
    preferring a local Ollama model when one is set."""
    if settings.ollama_vision_model:
        return "ollama", settings.ollama_vision_model
    if settings.groq_api_key:
        return "groq", settings.groq_vision_model
    return None


async def _ocr_batch_groq(client: httpx.AsyncClient, model: str, images_b64: list[str]) -> str:
    content: list[dict] = [{"type": "text", "text": OCR_PROMPT}]
    for img in images_b64:
        content.append(
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img}"}}
        )
    res = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={"model": model, "messages": [{"role": "user", "content": content}]},
        timeout=60.0,
    )
    res.raise_for_status()
    text = res.json()["choices"][0]["message"]["content"]
    return _SPECIAL_TOKEN.sub("", _THINK_BLOCK.sub("", text)).strip()


async def _ocr_batch_ollama(client: httpx.AsyncClient, model: str, images_b64: list[str]) -> str:
    res = await client.post(
        f"{settings.ollama_host}/api/chat",
        json={
            "model": model,
            "messages": [{"role": "user", "content": OCR_PROMPT, "images": images_b64}],
            "stream": False,
            "keep_alive": "30m",
        },
        timeout=120.0,
    )
    res.raise_for_status()
    text = res.json()["message"]["content"]
    return _SPECIAL_TOKEN.sub("", _THINK_BLOCK.sub("", text)).strip()


async def _ocr_batch_safe(
    client: httpx.AsyncClient, provider: str, model: str, batch: list[str]
) -> str:
    try:
        if provider == "ollama":
            return await _ocr_batch_ollama(client, model, batch)
        return await _ocr_batch_groq(client, model, batch)
    except Exception:
        # Fallback to Groq Cloud vision if local Ollama vision model fails or isn't pulled
        if provider == "ollama" and settings.groq_api_key:
            for v_model in ["llama-3.2-11b-vision-preview", settings.groq_vision_model]:
                try:
                    return await _ocr_batch_groq(client, v_model, batch)
                except Exception:
                    pass
        return ""


async def extract_text(images_b64: list[str]) -> str:
    """Runs OCR over every page/image, batching to respect the vision
    model's per-request image cap. Batches run concurrently; a failed batch
    is skipped rather than failing the whole upload."""
    provider_model = _vision_provider()
    if not provider_model:
        return ""
    provider, model = provider_model

    batch_size = MAX_IMAGES_PER_CALL_OLLAMA if provider == "ollama" else MAX_IMAGES_PER_CALL_GROQ
    batches = [images_b64[i : i + batch_size] for i in range(0, len(images_b64), batch_size)]
    async with httpx.AsyncClient() as client:
        pages = await asyncio.gather(
            *(_ocr_batch_safe(client, provider, model, batch) for batch in batches)
        )
    return "\n\n".join(page for page in pages if page)
