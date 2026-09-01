"""Chunking and retrieval for chat grounding, backed by Pinecone.

Content — uploaded/OCR'd reports, scraped web pages, past chat turns — is
chunked and stored in Pinecone under a namespace per user (their Clerk id).
Pinecone embeds each chunk server-side via its hosted embedding model and
handles the similarity search itself — no local embedding model, no
brute-force scan.
"""

from datetime import datetime, timezone

from app.db import get_patient_db
from app.services import pinecone_client


def _chunk_text(text: str, size: int = 800, overlap: int = 150) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + size])
        start += size - overlap
    return [c.strip() for c in chunks if c.strip()]


def _store_source(
    source_id: str,
    title: str,
    kind: str,
    content: str,
    owner_id: str,
    url: str | None = None,
    extracted: dict | None = None,
) -> dict:
    """Chunks and stores any piece of content as a retrievable source — the
    shared path for uploaded reports, OCR'd documents, and scraped web
    pages. `owner_id` (the Clerk id) becomes the Pinecone namespace, so
    every user's vectors are fully isolated from every other user's."""
    chunks = _chunk_text(content) or [content[:200] or "(empty document)"]

    db = get_patient_db()
    uploaded_at = datetime.now(timezone.utc).date().isoformat()

    pinecone_client.delete_by_source(owner_id, source_id)
    pinecone_client.upsert_records(
        owner_id,
        [
            {
                "_id": f"{source_id}::{i}",
                "chunk_text": chunk,
                "sourceId": source_id,
                "type": kind,
                **({"url": url} if url else {}),
            }
            for i, chunk in enumerate(chunks)
        ],
    )

    source = {
        "id": source_id,
        "title": title,
        "kind": kind,
        "uploadedAt": uploaded_at,
        "excerpt": chunks[0][:220],
        # Full text, kept separately from the retrieval chunks so the
        # reader view doesn't show duplicated text at chunk boundaries.
        "content": content,
        **({"url": url} if url else {}),
        # Who this belongs to — lets Profile derive History/Medications
        # only from this same user's own documents, and lets each user's
        # sources panel only ever show their own uploads/searches.
        "clerkUserId": owner_id,
        # Conditions/medications extracted from this one document, computed
        # once (at upload time) rather than live on every Profile visit —
        # Profile just reads and merges these across all your documents.
        **(
            {
                "extractedConditions": extracted["conditions"],
                "extractedMedications": extracted["medications"],
            }
            if extracted is not None
            else {}
        ),
    }
    db.sources.update_one({"id": source_id}, {"$set": source}, upsert=True)
    return source


def ingest_report(
    filename: str, kind: str, report: str, owner_id: str, extracted: dict | None = None
) -> dict:
    """Stores a My Data report (already OCR'd + LLM-authored) for retrieval."""
    source_id = f"src-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    return _store_source(source_id, filename, kind, report, owner_id, extracted=extracted)


def store_web_content(url: str, title: str, content: str, owner_id: str) -> dict:
    """Chunks and stores a scraped web page, same as an uploaded document, so
    deep-search results are retrievable through the normal RAG pipeline."""
    return _store_source(f"web:{url}", title, "web", content, owner_id, url=url)


def store_chat_message(session_id: str, role: str, content: str, owner_id: str) -> None:
    """Stores a chat turn in the same vector store used for RAG retrieval,
    so later questions can recall earlier parts of this conversation."""
    if not content.strip():
        return
    pinecone_client.upsert_records(
        owner_id,
        [
            {
                "_id": f"chat:{session_id}::{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                "chunk_text": content,
                "sourceId": f"chat:{session_id}",
                "type": "chat",
                "sessionId": session_id,
                "role": role,
            }
        ],
    )


def retrieve(
    query: str, namespace: str, top_k: int = 4, allowed_source_ids: list[str] | None = None
) -> list[dict]:
    """Searches this user's own Pinecone namespace by semantic similarity.
    When allowed_source_ids is given, only searches within those sources —
    e.g. the My Data cards the user selected for this chat session, plus
    its own conversation history."""
    search_filter = {"sourceId": {"$in": allowed_source_ids}} if allowed_source_ids is not None else None
    hits = pinecone_client.search(namespace, query, top_k=top_k, filter=search_filter)
    return [
        {"text": fields.get("chunk_text", ""), **{k: v for k, v in fields.items() if k != "chunk_text"}}
        for fields in (hit.get("fields", {}) for hit in hits)
    ]
