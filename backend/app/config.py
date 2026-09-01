import base64
import os

from dotenv import load_dotenv

load_dotenv()


def _clerk_issuer_from_publishable_key(publishable_key: str) -> str:
    """Clerk publishable keys are `pk_{test|live}_` + base64("{frontend-api-domain}$").

    The frontend API domain is also the JWT issuer / JWKS host, so we derive it
    here instead of requiring a separate env var.
    """
    if not publishable_key or "_" not in publishable_key:
        return ""
    encoded = publishable_key.split("_", 2)[-1]
    try:
        domain = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode("utf-8")
    except Exception:
        return ""
    return f"https://{domain.rstrip('$')}"


class Settings:
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    # Two isolated databases on the same Atlas cluster: one holds doctor
    # accounts only, the other holds every patient-owned/patient-attributable
    # collection. See app/db.py for which collections live where.
    mongodb_doctor_db: str = os.getenv("MONGODB_DOCTOR_DB", "medsys_doctor")
    mongodb_patient_db: str = os.getenv("MONGODB_PATIENT_DB", "medsys_patient")

    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "")
    ollama_vision_model: str = os.getenv("OLLAMA_VISION_MODEL", "")

    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    groq_whisper_model: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
    groq_vision_model: str = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")

    firecrawl_api_key: str = os.getenv("FIRECRAWL_API_KEY", "")

    openweather_api_key: str = os.getenv("OPENWEATHER_API_KEY", "")
    location_name: str = os.getenv("LOCATION_NAME", "Bengaluru, IN")
    location_lat: float = float(os.getenv("LOCATION_LAT", "12.9716"))
    location_lng: float = float(os.getenv("LOCATION_LNG", "77.5946"))

    supermemory_api_key: str = os.getenv("SUPERMEMORY_API_KEY", "")
    supermemory_container_tag: str = os.getenv("SUPERMEMORY_CONTAINER_TAG", "medsys-symptoms")
    supermemory_chat_container_tag: str = os.getenv(
        "SUPERMEMORY_CHAT_CONTAINER_TAG", "medsys-chat"
    )

    pinecone_api_key: str = os.getenv("PINECONE_API_KEY", "")
    pinecone_index: str = os.getenv("PINECONE_INDEX", "Default")

    clerk_secret_key: str = os.getenv("CLERK_SECRET_KEY", "")
    clerk_publishable_key: str = os.getenv("CLERK_PUBLISHABLE_KEY", "")
    clerk_issuer: str = _clerk_issuer_from_publishable_key(
        os.getenv("CLERK_PUBLISHABLE_KEY", "")
    )

    tomtom_api_key: str = os.getenv("TOMTOM_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # When on, unauthenticated requests get an isolated per-browser demo
    # identity (see services/clerk_auth.py) instead of being rejected.
    # Never a shared identity — each demo browser session is auto-provisioned
    # its own doctor/patient row, keyed by the client-generated
    # X-Demo-Session-Id header.
    medsys_demo_mode: bool = os.getenv("MEDSYS_DEMO_MODE", "true").strip().lower() in ("1", "true", "yes")


    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]


settings = Settings()
