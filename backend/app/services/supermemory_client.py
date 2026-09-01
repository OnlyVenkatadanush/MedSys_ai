"""Symptom knowledge graph, backed by the Supermemory API — namespaced per user.

Every symptom/condition — whether logged by hand on Home or extracted from
a chat message as you write it — is written here as a memory with
structured metadata, under a container tag derived from the signed-in
user's Clerk id, so one account's memories are never visible to another's
search/list calls. `build_graph()` reads every distinct symptom back (for
this one user) and connects them as a complete graph, each edge labeled
with the number of days between the two symptoms' occurrences.
"""

import asyncio
import json
import re
from datetime import datetime

import httpx

from app.config import settings
from app.db import get_patient_db
from app.services import model_router

SUPERMEMORY_BASE = "https://api.supermemory.ai"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.supermemory_api_key}",
        "Content-Type": "application/json",
    }


def _symptom_tag(clerk_user_id: str) -> str:
    return f"{settings.supermemory_container_tag}-{clerk_user_id}"


def _chat_tag(clerk_user_id: str) -> str:
    return f"{settings.supermemory_chat_container_tag}-{clerk_user_id}"


def _format_date(iso_date: str) -> str:
    d = datetime.fromisoformat(iso_date).date()
    return f"{d.strftime('%a, %b')} {d.day}"


async def log_symptom(name: str, occurred_on: str, clerk_user_id: str) -> dict:
    db = get_patient_db()
    cleaned_name = name.strip()

    existing = db.symptoms.find_one(
        {"name": {"$regex": f"^{re.escape(cleaned_name)}$", "$options": "i"}, "clerkUserId": clerk_user_id}
    )
    current_freq = (existing.get("frequency", 1) + 1) if existing else 1
    occurrences = list(existing.get("occurrences", [])) if existing else []
    if occurred_on not in occurrences:
        occurrences.append(occurred_on)

    db.symptoms.update_one(
        {"name": {"$regex": f"^{re.escape(cleaned_name)}$", "$options": "i"}, "clerkUserId": clerk_user_id},
        {
            "$set": {
                "name": cleaned_name,
                "clerkUserId": clerk_user_id,
                "date": occurred_on,
                "loggedAt": datetime.now().isoformat(),
                "frequency": current_freq,
                "occurrences": occurrences,
            }
        },
        upsert=True,
    )
    if settings.supermemory_api_key:
        async def _sync_supermemory():
            try:
                payload = {
                    "memories": [
                        {
                            "content": f"Patient reported symptom '{cleaned_name}' on {occurred_on}. Frequency: {current_freq}.",
                            "metadata": {"type": "symptom", "symptom": cleaned_name, "date": occurred_on, "frequency": current_freq},
                            "temporalContext": {"eventDate": [occurred_on]},
                        }
                    ],
                    "containerTag": _symptom_tag(clerk_user_id),
                }
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{SUPERMEMORY_BASE}/v4/memories", headers=_headers(), json=payload
                    )
            except Exception:
                pass
        asyncio.create_task(_sync_supermemory())

    return {"name": cleaned_name, "date": occurred_on, "frequency": current_freq, "occurrences": occurrences}


async def delete_symptom(name: str, clerk_user_id: str) -> None:
    db = get_patient_db()
    db.symptoms.delete_many(
        {"name": {"$regex": f"^{name.strip()}$", "$options": "i"}, "clerkUserId": clerk_user_id}
    )


async def log_medication(name: str, dosage: str, occurred_on: str, clerk_user_id: str) -> None:
    payload = {
        "memories": [
            {
                "content": f"Patient reported taking medication '{name}' on {occurred_on}.",
                "metadata": {
                    "type": "medication",
                    "medication": name,
                    "dosage": dosage,
                    "date": occurred_on,
                },
                "temporalContext": {"eventDate": [occurred_on]},
            }
        ],
        "containerTag": _symptom_tag(clerk_user_id),
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(
            f"{SUPERMEMORY_BASE}/v4/memories", headers=_headers(), json=payload
        )
        res.raise_for_status()


async def log_web_content(query: str, url: str, title: str, content: str, clerk_user_id: str) -> None:
    """Best-effort — a failed write here should never break a deep search."""
    if not settings.supermemory_api_key or not content.strip():
        return
    payload = {
        "memories": [
            {
                "content": content[:8000],
                "metadata": {"type": "web", "url": url, "title": title, "query": query},
            }
        ],
        "containerTag": _chat_tag(clerk_user_id),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{SUPERMEMORY_BASE}/v4/memories", headers=_headers(), json=payload
            )
            res.raise_for_status()
    except httpx.HTTPError:
        pass


async def log_document(source_id: str, title: str, kind: str, content: str, clerk_user_id: str) -> None:
    """Best-effort — a failed write here should never break a My Data upload."""
    if not settings.supermemory_api_key or not content.strip():
        return
    payload = {
        "memories": [
            {
                "content": content[:8000],
                "metadata": {"type": "document", "sourceId": source_id, "title": title, "kind": kind},
            }
        ],
        "containerTag": _chat_tag(clerk_user_id),
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{SUPERMEMORY_BASE}/v4/memories", headers=_headers(), json=payload
            )
            res.raise_for_status()
    except httpx.HTTPError:
        pass


async def log_chat_message(session_id: str, role: str, content: str, clerk_user_id: str) -> None:
    """Best-effort — a failed write here should never break the chat turn."""
    if not settings.supermemory_api_key or not content.strip():
        return
    payload = {
        "memories": [
            {
                "content": content,
                "metadata": {"type": "chat", "sessionId": session_id, "role": role},
            }
        ],
        "containerTag": _chat_tag(clerk_user_id),
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{SUPERMEMORY_BASE}/v4/memories", headers=_headers(), json=payload
            )
            res.raise_for_status()
    except httpx.HTTPError:
        pass


async def list_all_symptoms(clerk_user_id: str) -> list[dict]:
    """Returns every active symptom this user has logged, from MongoDB db.symptoms."""
    db = get_patient_db()
    return list(db.symptoms.find({"clerkUserId": clerk_user_id}, {"_id": 0}))


async def list_all_medications(clerk_user_id: str) -> list[dict]:
    """Returns every distinct medication this user has ever logged via chat,
    one entry per distinct name with its most recent occurrence's date/dosage."""
    if not settings.supermemory_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                f"{SUPERMEMORY_BASE}/v4/search",
                headers=_headers(),
                json={
                    "q": "medication",
                    "containerTag": _symptom_tag(clerk_user_id),
                    # Supermemory caps this at 100 — a higher value 400s.
                    "limit": 100,
                },
            )
            res.raise_for_status()
            results = res.json().get("results", [])
    except httpx.HTTPError:
        return []

    latest_by_name: dict[str, dict] = {}
    for r in results:
        meta = r.get("metadata")
        if not isinstance(meta, dict) or meta.get("type") != "medication":
            continue
        name = meta.get("medication")
        date = meta.get("date")
        if not name or not date:
            continue
        if name not in latest_by_name or date > latest_by_name[name]["date"]:
            latest_by_name[name] = {"date": date, "dosage": meta.get("dosage", "")}
    return [
        {"name": name, "dosage": info["dosage"], "date": info["date"]}
        for name, info in latest_by_name.items()
    ]


SEVERITY_SYSTEM_PROMPT = """You are a senior clinical triage physician AI. You are given a patient's currently logged symptoms/conditions, each with how many times it has recurred.

Assess the CLINICAL SEVERITY of the patient's overall condition based on the actual medical seriousness of what has been reported — NOT on how many symptoms are listed. A single symptom that is medically severe (e.g. chest pain, severe shortness of breath, sudden one-sided weakness, high fever with stiff neck, uncontrolled bleeding, seizure, coughing blood) must be rated "serious" even if it's the only thing logged. Several mild, common symptoms (e.g. runny nose, mild fatigue, occasional headache) should stay "stable" even if there are many of them, unless their combination or recurrence pattern itself suggests a worsening or systemic illness.

Rate the overall condition as exactly one of "stable", "moderate", or "serious":
- stable: mild/self-limiting symptoms, no red-flag signs, unlikely to indicate a serious underlying disease.
- moderate: symptoms that are uncomfortable, persistent, or recurring in a way that could indicate a developing condition worth monitoring — not immediately dangerous.
- serious: symptoms that, individually or combined, are indicative of a potentially serious underlying disease or a red-flag/emergency pattern warranting prompt medical attention.

Reply ONLY with a raw JSON object of this exact shape, no preamble, no markdown fences:
{
  "severity": "moderate",
  "note": "One short sentence, written directly to the patient, naming the relevant symptoms and explaining why that severity level fits."
}"""

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)

# Deterministic fallback only — used when the LLM call itself fails/times
# out, so Home never shows a broken status. Keyed by clinical severity, not
# symptom count, same as the LLM assessment above.
_SERIOUS_SYMPTOM_KEYWORDS = [
    "chest pain", "shortness of breath", "difficulty breathing", "seizure",
    "stroke", "slurred speech", "numbness", "one-sided weakness", "unconscious",
    "syncope", "fainted", "anaphylaxis", "severe allergic", "coughing blood",
    "hemoptysis", "severe bleeding", "uncontrolled bleeding", "suicidal",
    "stiff neck", "blue lips", "cyanosis",
]
_MODERATE_SYMPTOM_KEYWORDS = [
    "high fever", "fever", "persistent vomiting", "vomiting", "dehydration",
    "severe headache", "migraine", "dizziness", "chest tightness",
    "wheezing", "rash", "abdominal pain", "diarrhea", "palpitations",
]


def _join_labels(labels: list[str], limit: int = 4) -> str:
    if len(labels) <= limit:
        return ", ".join(labels)
    shown = ", ".join(labels[:limit])
    return f"{shown} and {len(labels) - limit} more"


def _fallback_severity(labels: list[str]) -> tuple[str, str]:
    lowered = [l.lower() for l in labels]
    joined = _join_labels(labels)

    if any(any(kw in name for kw in _SERIOUS_SYMPTOM_KEYWORDS) for name in lowered):
        return (
            "serious",
            f"{joined} logged — this can signal a serious underlying condition, worth prompt medical attention.",
        )
    if any(any(kw in name for kw in _MODERATE_SYMPTOM_KEYWORDS) for name in lowered):
        return "moderate", f"{joined} logged — worth keeping an eye on."
    return "stable", f"{joined} logged — nothing here points to a serious condition right now."


async def describe_status(graph: dict) -> tuple[str, str]:
    """Status + note reflecting the clinical severity of the patient's
    currently logged symptoms/disease pattern — driven by how medically
    serious what's reported actually is, not by how many symptoms there
    are. An LLM makes the clinical judgment call; a deterministic
    keyword-based check is the fallback if that call fails."""
    nodes = graph.get("nodes", [])
    labels = [n["label"] for n in nodes if n.get("label")]

    if not labels:
        return "stable", "No symptoms logged yet — nothing to flag."

    freq_by_label = {n["label"]: n.get("frequency", 1) for n in nodes if n.get("label")}
    lines = [f"- {label} (reported {freq_by_label.get(label, 1)}x)" for label in labels]

    try:
        raw = await model_router.complete_gemini(
            "Patient's currently logged symptoms:\n" + "\n".join(lines),
            system=SEVERITY_SYSTEM_PROMPT,
            max_tokens=300,
            timeout=8.0,
            temperature=0,
        )
        cleaned = re.sub(r"<think>.*?</think>", "", raw.strip(), flags=re.DOTALL).strip()
        cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^```\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        match = _JSON_OBJECT.search(cleaned)
        data = json.loads(match.group(0)) if match else json.loads(cleaned)

        severity = str(data.get("severity", "")).strip().lower()
        note = str(data.get("note", "")).strip()
        if severity in ("stable", "moderate", "serious") and note:
            return severity, note
    except Exception:
        pass

    return _fallback_severity(labels)


async def build_graph(clerk_user_id: str) -> dict:
    """Every distinct symptom/condition this user has logged, as a node,
    connected to every other as a complete graph — each edge labeled with
    the number of days between the two symptoms' occurrences."""
    symptoms = await list_all_symptoms(clerk_user_id)

    nodes = [
        {
            "id": f"n{i}",
            "label": s["name"].capitalize(),
            "date": _format_date(s["date"]),
            "frequency": s.get("frequency", 1),
            "occurrences": s.get("occurrences", [s.get("date", "")]),
        }
        for i, s in enumerate(symptoms)
    ]

    edges = []
    for i in range(len(symptoms)):
        day_i = datetime.fromisoformat(symptoms[i]["date"]).date()
        for j in range(i + 1, len(symptoms)):
            day_j = datetime.fromisoformat(symptoms[j]["date"]).date()
            edges.append(
                {
                    "source": nodes[i]["id"],
                    "target": nodes[j]["id"],
                    "durationDays": abs((day_j - day_i).days),
                }
            )

    return {"nodes": nodes, "edges": edges}


async def reachable() -> bool:
    if not settings.supermemory_api_key:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                f"{SUPERMEMORY_BASE}/v4/search",
                headers=_headers(),
                json={"q": "ping", "containerTag": "medsys-health-check", "limit": 1},
            )
            return res.status_code == 200
    except httpx.HTTPError:
        return False
