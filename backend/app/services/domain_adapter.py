"""Domain Adapter Service: Explicit @tag parsing, implicit intent classification,
and 512-token constrained MedGemma multi-adapter connector with seamless fallback.
"""

import logging
import re
from typing import Optional, Tuple
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Canonical domain adapters
CANONICAL_ADAPTERS: dict[str, dict] = {
    "radiology": {
        "display_name": "Radiology",
        "description": "Medical imaging, X-rays, CT scans, MRI, ultrasound, and radiological findings",
        "aliases": ["radiology", "rad", "imaging", "mri", "ct"],
        "keywords": ["x-ray", "xray", "ct scan", "mri", "ultrasound", "radiograph", "radiology", "imaging", "opacity", "nodule", "fracture"],
    },
    "dermatology": {
        "display_name": "Dermatology",
        "description": "Skin, hair, and nail conditions, rashes, lesions, moles, eczema, psoriasis, dermoscopy",
        "aliases": ["dermatology", "derma", "skin"],
        "keywords": ["rash", "mole", "skin lesion", "eczema", "psoriasis", "melanoma", "dermoscopy", "dermatitis", "erythema", "itching", "skin"],
    },
    "pathology": {
        "display_name": "Pathology",
        "description": "Tissue histology, biopsy interpretation, cell pathology, and laboratory specimens",
        "aliases": ["pathology", "path", "biopsy", "histology"],
        "keywords": ["biopsy", "histology", "tissue specimen", "pathology", "malignancy", "cellular morphology", "carcinoma", "cytology"],
    },
    "ophthalmology": {
        "display_name": "Ophthalmology",
        "description": "Eye and vision conditions, retinal health, fundus imaging, OCT scans, ocular disease",
        "aliases": ["ophthalmology", "opht", "eye", "vision"],
        "keywords": ["retina", "vision", "fundus", "cataract", "glaucoma", "macular", "cornea", "eye pain", "visual acuity", "oct scan"],
    },
    "chest_xray": {
        "display_name": "Chest X-Ray",
        "description": "Chest radiographs and thoracic imaging, lung fields, pneumothorax, pulmonary opacities",
        "aliases": ["chest_xray", "chestxray", "cxr", "chest_rad"],
        "keywords": ["chest x-ray", "chest xray", "cxr", "pneumothorax", "pleural effusion", "consolidation", "lung field", "cardiomegaly", "pulmonary opacity"],
    },
    "cardiology": {
        "display_name": "Cardiology",
        "description": "Cardiovascular medicine, ECG interpretation, arrhythmias, heart failure, and coronary disease",
        "aliases": ["cardiology", "cardio", "heart", "ecg"],
        "keywords": ["ecg", "ekg", "arrhythmia", "troponin", "ejection fraction", "myocardial", "heart failure", "angina", "st-elevation", "cardiac"],
    },
    "clinical_reasoning": {
        "display_name": "Clinical Reasoning",
        "description": "Structured differential diagnosis, symptom synthesis, and step-by-step diagnostic reasoning",
        "aliases": ["clinical_reasoning", "reasoning", "differential", "diagnosis"],
        "keywords": ["differential diagnosis", "step-by-step reasoning", "rule out", "clinical reasoning", "diagnostic workup", "etiology"],
    },
    "general": {
        "display_name": "General Medicine",
        "description": "Standard multimodal medical LLM for general clinical queries and primary care",
        "aliases": ["general", "base", "primary_care"],
        "keywords": [],
    },
}

# Regex to detect explicit @adapter tag (e.g. @radiology, @derma, @pathology)
TAG_REGEX = re.compile(r"(?:^|\s)@([a-zA-Z0-9_]+)(?:\s|$)", re.IGNORECASE)


def parse_explicit_adapter_tag(message: str) -> Tuple[Optional[str], str]:
    """Extracts explicit @adapter tag and returns (adapter_key, clean_message).
    If no valid tag is found, returns (None, original_message).
    """
    match = TAG_REGEX.search(message)
    if not match:
        return None, message

    raw_tag = match.group(1).lower().strip()
    # Find matching canonical adapter by alias
    for key, meta in CANONICAL_ADAPTERS.items():
        if raw_tag in meta["aliases"] or raw_tag == key:
            # Strip the tag from the message
            clean_message = TAG_REGEX.sub(" ", message).strip()
            # Clean up extra spaces
            clean_message = re.sub(r"\s+", " ", clean_message)
            return key, clean_message

    return None, message


def classify_implicit_adapter(message: str) -> str:
    """Classifies message domain based on clinical keywords when no explicit @tag is given."""
    lower_msg = message.lower()
    scores: dict[str, int] = {}

    for key, meta in CANONICAL_ADAPTERS.items():
        if key == "general":
            continue
        score = 0
        for kw in meta["keywords"]:
            if kw in lower_msg:
                score += 2 if len(kw) > 6 else 1
        if score > 0:
            scores[key] = score

    if scores:
        best_adapter = max(scores, key=scores.get)
        return best_adapter

    return "general"


def resolve_adapter(message: str, explicit_specialty: Optional[str] = None) -> Tuple[str, str, bool]:
    """Resolves adapter through:
    1. Explicit @tag in message text (e.g. "@radiology Check this CT")
    2. Explicit UI specialty dropdown selection
    3. Implicit clinical intent keyword classification

    Returns: (adapter_key, clean_message, is_explicit)
    """
    # 1. Explicit @tag in message
    explicit_tag, clean_msg = parse_explicit_adapter_tag(message)
    if explicit_tag:
        return explicit_tag, clean_msg, True

    # 2. Explicit UI selection
    if explicit_specialty:
        clean_spec = explicit_specialty.lower().replace(" ", "_").replace("-", "_")
        for key, meta in CANONICAL_ADAPTERS.items():
            if clean_spec in meta["aliases"] or clean_spec == key or explicit_specialty.lower() == meta["display_name"].lower():
                return key, message, True

    # 3. Implicit intent classification
    implicit_tag = classify_implicit_adapter(message)
    return implicit_tag, message, False


async def call_remote_medgemma_adapter(
    adapter: str,
    question: str,
    timeout_seconds: float = 25.0,
) -> Optional[str]:
    """Sends payload to remote MedGemma multi-adapter ngrok service.
    Payload: {"adapter": adapter, "question": question}
    Returns response text or None on failure/unconfigured.
    """
    if not settings.medgemma_adapter_url:
        return None

    url = f"{settings.medgemma_adapter_url.rstrip('/')}/chat"
    payload = {
        "adapter": adapter,
        "question": question,
    }
    headers = {
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "MedSysAI/1.0",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, headers=headers) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, dict):
                    return data.get("response") or data.get("answer") or data.get("content") or str(data)
                elif isinstance(data, str):
                    return data
            else:
                logger.warning(f"MedGemma adapter responded with status {res.status_code}: {res.text[:200]}")
    except Exception as e:
        logger.info(f"MedGemma remote adapter unreachable ({e}), falling back to local model routing.")

    return None


def get_adapter_display_name(adapter_key: str) -> str:
    """Returns friendly display name for UI badge."""
    meta = CANONICAL_ADAPTERS.get(adapter_key)
    return meta["display_name"] if meta else "General Medicine"


def build_specialty_prompt_preamble(adapter_key: str) -> str:
    """Generates a compact, 512-token constrained domain specialty prompt."""
    if adapter_key == "general" or adapter_key not in CANONICAL_ADAPTERS:
        return (
            "DOMAIN: GENERAL MEDICINE & CLINICAL TRIAGE\n"
            "Provide high-density, actionable clinical guidance with clear explanations and safety cautions.\n"
            "Keep response concise and strictly within 512 tokens.\n\n"
        )

    meta = CANONICAL_ADAPTERS[adapter_key]
    name = meta["display_name"]
    desc = meta["description"]

    return (
        f"SPECIALTY ADAPTER: {name.upper()}\n"
        f"Domain Scope: {desc}.\n"
        f"Clinical Instructions:\n"
        f"1. Focus specifically through the lens of {name}.\n"
        f"2. Structure with: Key Findings/Differentials, Clinical Interpretation, and Recommended Next Steps.\n"
        f"3. Strict token budget: Deliver dense, high-yield answers fitting completely within 512 tokens without cut-off.\n\n"
    )
