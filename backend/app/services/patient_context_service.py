"""Patient Context Service: Unified context builder querying MongoDB Atlas.

Powers Patient Overview, What's New, Pre-Brief, AI Copilot, and Evidence Inspector.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from app.db import get_patient_db


def build_patient_context(patient_id: str) -> Dict[str, Any]:
    """Aggregates demographics, consultations, vitals, prescriptions, lab metrics, and alerts from MongoDB Atlas."""
    db = get_patient_db()

    # 1. Patient Profile
    patient_row = db.patients.find_one({"id": patient_id}, {"_id": 0})
    patient_data = patient_row or {"id": patient_id}

    # 2. Conditions
    conditions = [
        r["condition_name"]
        for r in db.patient_conditions.find({"patient_id": patient_id, "status": "active"}, {"_id": 0, "condition_name": 1})
    ]

    # 3. Allergies
    allergies = [
        f"{r['allergen']} ({r['severity']})"
        for r in db.allergies.find({"patient_id": patient_id}, {"_id": 0, "allergen": 1, "reaction": 1, "severity": 1})
    ]

    # 4. Consultations
    consultations = list(db.consultations.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", 1))
    latest_consult = consultations[-1] if consultations else None

    # 5. Active Prescriptions
    prescriptions = list(db.prescriptions.find({"patient_id": patient_id, "status": "active"}, {"_id": 0}))

    # 6. Latest Vitals — None when nothing has been recorded yet; a fabricated
    # "normal" reading here would be actively misleading in a clinical UI.
    vitals_data = next(iter(db.vitals.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", -1).limit(1)), None)

    # 7. Lab Metrics
    lab_metrics = list(db.lab_metrics.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", -1))

    # 8. Active Alerts
    alerts = list(db.alerts.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1))

    return {
        "patient_id": patient_id,
        "profile": {
            "fullName": patient_data.get("name"),
            "age": patient_data.get("age"),
            "gender": patient_data.get("gender"),
            "bloodGroup": patient_data.get("blood_group"),
            "weightKg": patient_data.get("weight_kg"),
            "conditions": conditions,
            "allergies": allergies,
        },
        "latest_consultation": latest_consult,
        "consultations": consultations,
        "active_prescriptions": prescriptions,
        "latest_vitals": vitals_data,
        "lab_metrics": lab_metrics,
        "active_alerts": alerts,
    }


def compute_adherence_rate(patient_id: str, since: Optional[str] = None, until: Optional[str] = None) -> Optional[float]:
    """Percentage of logged medication doses marked 'taken' for a patient,
    optionally restricted to a [since, until) ISO-8601 timestamp window.
    Returns None when there are no logs in range — a patient with zero
    logged doses has no adherence rate, not a 0% or fabricated rate."""
    db = get_patient_db()
    query: Dict[str, Any] = {"patient_id": patient_id}
    if since or until:
        ts_filter: Dict[str, Any] = {}
        if since:
            ts_filter["$gte"] = since
        if until:
            ts_filter["$lt"] = until
        query["timestamp"] = ts_filter

    logs = list(db.medication_logs.find(query, {"_id": 0, "status": 1}))
    if not logs:
        return None
    taken = sum(1 for log in logs if log.get("status") == "taken")
    return round(taken / len(logs) * 100, 1)


def get_whats_new_changes(patient_id: str) -> Dict[str, Any]:
    """Generates 'What's Changed Since Last Visit' delta breakdown from real MongoDB Atlas records."""
    db = get_patient_db()

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    fourteen_days_ago = (now - timedelta(days=14)).isoformat()
    twenty_eight_days_ago = (now - timedelta(days=28)).isoformat()

    recent_visits = list(
        db.consultations.find({"patient_id": patient_id, "status": "finalized"}, {"_id": 0, "finalized_at": 1, "created_at": 1})
        .sort("finalized_at", -1)
        .limit(2)
    )
    visit_dates = [v.get("finalized_at") or v.get("created_at") for v in recent_visits]
    last_visit_date = visit_dates[1] if len(visit_dates) > 1 else (visit_dates[0] if visit_dates else None)
    current_date = visit_dates[0] if visit_dates else now_iso

    rows = list(db.lab_metrics.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", 1))
    by_metric: Dict[str, List[dict]] = {}
    for r in rows:
        by_metric.setdefault(r["metric_name"], []).append(r)

    metrics_changes: List[Dict[str, Any]] = []
    for name, points in by_metric.items():
        if len(points) < 2:
            continue
        prev, curr = points[-2], points[-1]
        direction = "up" if curr["value"] > prev["value"] else ("down" if curr["value"] < prev["value"] else "flat")
        metrics_changes.append({
            "metric": name,
            "previous": f"{prev['value']} {prev.get('unit', '')}".strip(),
            "current": f"{curr['value']} {curr.get('unit', '')}".strip(),
            "direction": direction,
            "is_abnormal": bool(curr.get("is_abnormal")),
        })

    prev_adherence = compute_adherence_rate(patient_id, since=twenty_eight_days_ago, until=fourteen_days_ago)
    curr_adherence = compute_adherence_rate(patient_id, since=fourteen_days_ago)
    if prev_adherence is not None and curr_adherence is not None:
        direction = "up" if curr_adherence > prev_adherence else ("down" if curr_adherence < prev_adherence else "flat")
        metrics_changes.append({
            "metric": "Medication Adherence",
            "previous": f"{prev_adherence}%",
            "current": f"{curr_adherence}%",
            "direction": direction,
            "is_abnormal": curr_adherence < prev_adherence,
        })

    since_bound = last_visit_date or fourteen_days_ago
    events: List[str] = []

    new_labs = db.lab_reports.count_documents({"patient_id": patient_id, "uploaded_at": {"$gt": since_bound}})
    if new_labs:
        events.append(f"🧪 {new_labs} new lab report(s) uploaded since last visit")

    missed_doses = db.medication_logs.count_documents({"patient_id": patient_id, "status": "skipped", "timestamp": {"$gt": since_bound}})
    if missed_doses:
        events.append(f"💊 {missed_doses} missed medication dose(s) recorded since last visit")

    upcoming = db.appointments.find_one(
        {"patient_id": patient_id, "status": {"$in": ["requested", "confirmed"]}, "appointment_date": {"$gt": now_iso}},
        sort=[("appointment_date", 1)],
    )
    if upcoming:
        events.append(f"📅 Follow-up appointment scheduled for {upcoming['appointment_date']}")

    attention_items_count = sum(1 for m in metrics_changes if m["is_abnormal"]) + (1 if missed_doses else 0)

    return {
        "patient_id": patient_id,
        "last_visit_date": last_visit_date,
        "current_date": current_date,
        "metrics_changes": metrics_changes,
        "events_since_last_visit": events,
        "attention_items_count": attention_items_count,
    }


def get_evidence_trace(patient_id: str, insight_id: str) -> Dict[str, Any]:
    """Returns 'Explain Why?' evidence trace built from this patient's real recent records."""
    db = get_patient_db()

    recent_labs = list(db.lab_metrics.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", -1).limit(5))
    latest_consult = db.consultations.find_one(
        {"patient_id": patient_id, "status": "finalized"}, {"_id": 0}, sort=[("finalized_at", -1)]
    )
    missed_logs = list(
        db.medication_logs.find({"patient_id": patient_id, "status": "skipped"}, {"_id": 0}).sort("timestamp", -1).limit(5)
    )

    evidence_sources: List[str] = []
    for lm in recent_labs:
        evidence_sources.append(
            f"MongoDB lab_metrics: {lm.get('recorded_at')} {lm.get('metric_name')}: {lm.get('value')} {lm.get('unit', '')}".strip()
        )
    if latest_consult:
        evidence_sources.append(
            f"MongoDB consultations: {latest_consult.get('finalized_at') or latest_consult.get('created_at')} "
            f"notes by {latest_consult.get('doctor_name', 'attending doctor')}"
        )
    if missed_logs:
        evidence_sources.append(f"MongoDB medication_logs: {len(missed_logs)} missed dose(s) recorded")

    relevant_changes: List[str] = []
    abnormal_labs = [lm for lm in recent_labs if lm.get("is_abnormal")]
    for lm in abnormal_labs:
        relevant_changes.append(
            f"Abnormal {lm.get('metric_name')}: {lm.get('value')} {lm.get('unit', '')} recorded {lm.get('recorded_at')}".strip()
        )
    if missed_logs:
        relevant_changes.append(f"Missed {len(missed_logs)} prescribed dose(s) in recent medication logs")

    return {
        "insight_id": insight_id,
        "patient_id": patient_id,
        "title": "Evidence Breakdown for Recent Clinical Changes" if (abnormal_labs or missed_logs) else "Evidence Breakdown",
        "evidence_sources": evidence_sources,
        "relevant_changes": relevant_changes,
    }
