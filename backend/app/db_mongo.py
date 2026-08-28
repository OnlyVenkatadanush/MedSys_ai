"""MongoDB Connection Module: Flexible AI & Document Store for MedSys AI 2.0.

Handles:
- raw_lab_documents (PDF metadata, OCR text, raw extraction JSON)
- ai_chat_sessions & ai_chat_messages (Flexible conversation logs)
- ai_generated_insights (Reasoning traces, pre-briefs, advisory outputs)
"""

from pymongo import MongoClient
from pymongo.database import Database
from app.config import settings

_mongo_client: MongoClient | None = None


def get_mongo_db() -> Database:
    """Returns MongoDB database connection for flexible document and AI store."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=2000)
    return _mongo_client[settings.mongodb_db]


def init_mongo_collections():
    """Initializes MongoDB collections and indexes for fast AI & document retrieval."""
    try:
        db = get_mongo_db()
        db.raw_lab_documents.create_index("patient_id")
        db.ai_chat_sessions.create_index([("doctor_id", 1), ("patient_id", 1)])
        db.ai_chat_messages.create_index("session_id")
        db.ai_generated_insights.create_index("patient_id")
    except Exception as e:
        print(f"[MongoDB] Note: Local MongoDB index initialization info: {e}")


# Run collection initialization on import
init_mongo_collections()
