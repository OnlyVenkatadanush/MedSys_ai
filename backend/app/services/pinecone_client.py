"""Pinecone integrated-embedding vector store — one namespace per user.

Text goes in; Pinecone embeds it server-side via the index's bound hosted
model (llama-text-embed-v2) — no local embedding model, no manual vector
math. The index is created once, lazily, on first use. Every namespace is
one user's Clerk id, so one user's vectors are never visible to a search
run in another user's namespace.
"""

from app.config import settings

# Pinecone index names must be lowercase letters/digits/hyphens only.
INDEX_NAME = (settings.pinecone_index or "default").lower()
EMBED_MODEL = "llama-text-embed-v2"
TEXT_FIELD = "chunk_text"

_pc = None
_index = None


def _client():
    global _pc
    if _pc is None:
        from pinecone import Pinecone
        _pc = Pinecone(api_key=settings.pinecone_api_key)
    return _pc


def get_index():
    """Lazily creates the index (bound to the hosted embedding model) on
    first use, then returns a cached handle to it."""
    global _index
    if _index is not None:
        return _index

    pc = _client()
    if not pc.has_index(INDEX_NAME):
        pc.create_index_for_model(
            name=INDEX_NAME,
            cloud="aws",
            region="us-east-1",
            embed={
                "model": EMBED_MODEL,
                "field_map": {"text": TEXT_FIELD},
                "metric": "cosine",
            },
        )
    _index = pc.Index(INDEX_NAME)
    return _index


def upsert_records(namespace: str, records: list[dict]) -> None:
    """Each record needs a unique `_id` and a `chunk_text` field (embedded
    automatically by Pinecone) plus whatever metadata fields should come
    back from `search`."""
    if not records or not settings.pinecone_api_key:
        return
    try:
        get_index().upsert_records(namespace=namespace, records=records)
    except Exception:
        pass


def delete_by_source(namespace: str, source_id: str) -> None:
    if not settings.pinecone_api_key:
        return
    try:
        get_index().delete(namespace=namespace, filter={"sourceId": {"$eq": source_id}})
    except Exception:
        pass


def search(namespace: str, query_text: str, top_k: int = 8, filter: dict | None = None) -> list[dict]:
    """Returns a list of `{"fields": {...}}`-shaped dicts, one per hit."""
    if not settings.pinecone_api_key:
        return []
    try:
        response = get_index().search(
            namespace=namespace,
            top_k=top_k,
            inputs={"text": query_text},
            **({"filter": filter} if filter else {}),
        )
        return [{"fields": hit.fields} for hit in response.result.hits]
    except Exception:
        return []
