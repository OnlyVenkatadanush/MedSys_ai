"""Longitudinal Symptom & Memory State Tracker for MedSysAI.

Tracks symptom states (ACTIVE, RESOLVED, HISTORICAL) in MongoDB db.patient_symptom_history.
Formats dynamic content-aware patient medical memory for prompt injection.
"""

from datetime import datetime, timezone
from app.db import get_patient_db


def _today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def update_symptom_state(
    user_id: str,
    symptom_name: str,
    status: str = "active",
    notes: str = "",
) -> None:
    """Upserts a symptom state record in db.patient_symptom_history for a user."""
    db = get_patient_db()
    clean_name = symptom_name.strip().title()
    if not clean_name:
        return

    key = clean_name.lower()
    existing = db.patient_symptom_history.find_one({"clerkUserId": user_id, "key": key})
    today = _today_iso()

    if existing:
        episodes = existing.get("episodes", [])
        episodes.append({"date": today, "status": status, "notes": notes})
        update_data = {
            "symptom": clean_name,
            "status": status.lower(),
            "lastUpdated": today,
            "episodes": episodes,
        }
        if status.lower() == "resolved" and not existing.get("resolvedOn"):
            update_data["resolvedOn"] = today
        db.patient_symptom_history.update_one(
            {"clerkUserId": user_id, "key": key},
            {"$set": update_data},
        )
    else:
        doc = {
            "clerkUserId": user_id,
            "key": key,
            "symptom": clean_name,
            "status": status.lower(),
            "firstReported": today,
            "lastUpdated": today,
            "resolvedOn": today if status.lower() == "resolved" else None,
            "episodes": [{"date": today, "status": status, "notes": notes}],
        }
        db.patient_symptom_history.insert_one(doc)


def resolve_symptom(user_id: str, symptom_name: str, notes: str = "") -> None:
    """Marks an existing active symptom as RESOLVED."""
    update_symptom_state(user_id, symptom_name, status="resolved", notes=notes)


def get_patient_symptom_summary(user_id: str) -> dict:
    """Returns grouped lists of active, resolved, and historical symptoms."""
    db = get_patient_db()
    docs = list(db.patient_symptom_history.find({"clerkUserId": user_id}, {"_id": 0}))

    active = []
    resolved = []
    historical = []

    for d in docs:
        st = d.get("status", "active")
        item = {
            "symptom": d.get("symptom"),
            "firstReported": d.get("firstReported"),
            "lastUpdated": d.get("lastUpdated"),
            "resolvedOn": d.get("resolvedOn"),
        }
        if st == "active":
            active.append(item)
        elif st == "resolved":
            resolved.append(item)
        else:
            historical.append(item)

    return {"active": active, "resolved": resolved, "historical": historical}


def format_medical_memory_block(user_id: str) -> str:
    """Formats a dynamic content-aware patient medical memory block for chat prompt context."""
    summary = get_patient_symptom_summary(user_id)
    active = summary["active"]
    resolved = summary["resolved"]
    historical = summary["historical"]

    if not (active or resolved or historical):
        return "[PATIENT SYMPTOM HISTORY: No prior symptoms logged]"

    lines = ["[PATIENT SYMPTOM LIFECYCLE MEMORY]"]
    if active:
        active_str = ", ".join(f"{s['symptom']} (since {s['firstReported']})" for s in active)
        lines.append(f"• ACTIVE Symptoms: {active_str}")
    else:
        lines.append("• ACTIVE Symptoms: None reported currently")

    if resolved:
        resolved_str = ", ".join(
            f"{s['symptom']} (resolved on {s['resolvedOn'] or s['lastUpdated']})" for s in resolved[:5]
        )
        lines.append(f"• RECENTLY RESOLVED: {resolved_str}")

    if historical:
        hist_str = ", ".join(f"{s['symptom']} ({s['firstReported']})" for s in historical[:5])
        lines.append(f"• HISTORICAL / PAST: {hist_str}")

    lines.append(
        "Instructions: Do NOT treat resolved/historical symptoms as active. "
        "If asking about a previously logged symptom, clarify: 'You previously mentioned X. Are you currently experiencing it?'"
    )

    return "\n".join(lines)
