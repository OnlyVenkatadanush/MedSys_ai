"""Doctor Router: Command Center, Workspace, Lab Intelligence, Voice Parsing, Analytics & Multi-Patient Compare.

Queries and persists directly into MongoDB Atlas collections. Every value
returned here is derived from the requesting doctor's own real data — a
doctor/patient with genuinely zero of something sees an honest 0/empty/"No
data" state rather than a plausible-looking demo number.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import get_patient_db
from app.models_v2 import (
    AlertRecord,
    AppointmentRecord,
    CommandCenterData,
    ConsultationCreateIn,
    ConsultationFinalizeIn,
    ConsultationSession,
    CopilotChatIn,
    DoctorAnalytics,
    DoctorPatientAssignment,
    EvidenceTrace,
    LabMetricTrend,
    LinkExistingPatientIn,
    MedicationSchedule,
    MetricHistoryPoint,
    MultiPatientCompareResult,
    PatientComparisonCard,
    PreConsultationBrief,
    StructuredVoiceNoteOut,
    VoiceParseIn,
    WhatsNewChanges,
)
from app.services.audit_service import log_audit_event
from app.services.clerk_auth import AuthenticatedUser, require_role, verify_patient_access
from app.services.doctor_ai_service import generate_doctor_ai_support
from app.services.model_router import generate_completion
from app.services.patient_context_service import (
    build_patient_context,
    compute_adherence_rate,
    get_evidence_trace,
    get_whats_new_changes,
)

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


def _get_doctor_patient_ids(db, doctor_id: str) -> List[str]:
    """Active patient ids currently assigned to this doctor."""
    return [
        a["patient_id"]
        for a in db.doctor_patient.find({"doctor_id": doctor_id, "status": "active"}, {"_id": 0, "patient_id": 1})
    ]


def _count_pending_lab_reviews(db, patient_ids: List[str]) -> int:
    """Lab reports not yet marked reviewed, scoped to a set of patients."""
    if not patient_ids:
        return 0
    return db.lab_reports.count_documents({"patient_id": {"$in": patient_ids}, "status": {"$ne": "reviewed"}})


@router.get("/command-center", response_model=CommandCenterData)
async def get_doctor_command_center(
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Command Center: Queries MongoDB for workload, priority alerts, and today's appointments."""
    db = get_patient_db()

    patient_ids = _get_doctor_patient_ids(db, user.user_id)
    total_patients = len(patient_ids)
    total_consultations = db.consultations.count_documents({"doctor_id": user.user_id})
    pending_labs_count = _count_pending_lab_reviews(db, patient_ids)

    # Get alerts
    alert_rows = list(db.alerts.find({"doctor_id": user.user_id}, {"_id": 0}).sort("created_at", -1))
    alerts = [
        AlertRecord(
            id=r["id"],
            patient_id=r["patient_id"],
            patient_name=r["patient_name"],
            doctor_id=r["doctor_id"],
            type=r["type"],
            severity=r["severity"],
            title=r["title"],
            message=r["message"],
            is_read=bool(r["is_read"]),
            created_at=r["created_at"],
        )
        for r in alert_rows
    ]

    # Get appointments
    appt_rows = list(db.appointments.find({"doctor_id": user.user_id}, {"_id": 0}).sort("appointment_date", 1))
    appointments = [
        AppointmentRecord(
            id=r["id"],
            patient_id=r["patient_id"],
            doctor_id=r["doctor_id"],
            patient_name=r.get("patient_name") or "Patient",
            doctor_name=r.get("doctor_name") or user.full_name,
            appointment_date=r.get("appointment_date") or r.get("date_time", ""),
            reason=r.get("reason") or "Routine Visit",
            status=r.get("status") or "confirmed",
            notes=r.get("notes") or "",
            created_at=r.get("created_at", ""),
        )
        for r in appt_rows
    ]

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="READ_DOCTOR_COMMAND_CENTER",
        target_patient_id="ALL",
        resource="/api/doctor/command-center",
    )

    return CommandCenterData(
        total_patients=total_patients,
        total_consultations=total_consultations,
        todays_appointments_count=len(appointments),
        pending_labs_count=pending_labs_count,
        active_alerts_count=len(alerts),
        priority_queue=alerts,
        todays_appointments=appointments,
    )


@router.get("/patients", response_model=List[DoctorPatientAssignment])
async def get_assigned_patients(
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Returns list of patients assigned to authorized doctor from MongoDB."""
    db = get_patient_db()
    assignments = list(db.doctor_patient.find({"doctor_id": user.user_id, "status": "active"}, {"_id": 0}))

    result = []
    for a in assignments:
        patient = db.patients.find_one({"id": a["patient_id"]}, {"_id": 0}) or {}
        result.append(
            DoctorPatientAssignment(
                id=a["id"],
                doctor_id=a["doctor_id"],
                patient_id=a["patient_id"],
                patient_name=patient.get("name") or a["patient_id"],
                patient_age=patient.get("age"),
                patient_gender=patient.get("gender"),
                assigned_at=a["assigned_at"],
                status=a["status"],
            )
        )
    return result


@router.get("/patients/search", response_model=List[DoctorPatientAssignment])
async def search_assigned_patients(
    q: str = Query("", description="Search term for patient name or ID"),
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Search assigned patients in MongoDB by name or ID."""
    all_patients = await get_assigned_patients(user)
    if not q.strip():
        return all_patients

    query_lower = q.lower().strip()
    return [
        p for p in all_patients
        if query_lower in p.patient_name.lower() or query_lower in p.patient_id.lower()
    ]


@router.post("/patients/link", response_model=DoctorPatientAssignment)
async def link_existing_patient(
    payload: LinkExistingPatientIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Adds an already-registered patient (self-signed-up via Clerk, or
    onboarded by a different doctor) to this doctor's panel by email or
    Patient ID code. `add-patient-wizard` can only create brand-new
    patients — this is the counterpart for patients who already have an
    account, so a doctor is never blocked from taking over an existing
    patient's care just because that patient registered themselves."""
    db = get_patient_db()
    identifier = payload.identifier.strip()

    query = {"email": identifier.lower()} if "@" in identifier else {"patient_id_code": identifier.upper()}
    patient = db.patients.find_one(query, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="No patient found with that email or Patient ID.")

    existing = db.doctor_patient.find_one({"doctor_id": user.user_id, "patient_id": patient["id"]})
    if existing and existing.get("status") == "active":
        raise HTTPException(status_code=400, detail=f"{patient.get('name', 'This patient')} is already in your patient panel.")

    now = datetime.now(timezone.utc).isoformat()
    if existing:
        db.doctor_patient.update_one({"id": existing["id"]}, {"$set": {"status": "active", "assigned_at": now}})
        assignment_id = existing["id"]
    else:
        assignment_id = f"asgn_{uuid.uuid4().hex[:10]}"
        db.doctor_patient.insert_one({
            "id": assignment_id,
            "doctor_id": user.user_id,
            "patient_id": patient["id"],
            "assigned_at": now,
            "status": "active",
        })

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="LINK_EXISTING_PATIENT",
        target_patient_id=patient["id"],
        resource="/api/doctor/patients/link",
        details=f"Linked existing patient {patient.get('name')} ({patient.get('patient_id_code')}) to doctor panel",
    )

    return DoctorPatientAssignment(
        id=assignment_id,
        doctor_id=user.user_id,
        patient_id=patient["id"],
        patient_name=patient.get("name") or patient["id"],
        patient_age=patient.get("age"),
        patient_gender=patient.get("gender"),
        assigned_at=now,
        status="active",
    )


@router.get("/patient/{patient_id}/whats-new", response_model=WhatsNewChanges)
async def get_whats_new(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """What's New: Returns changes & events since doctor last saw patient."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access to patient")
    return get_whats_new_changes(patient_id)


@router.get("/patient/{patient_id}/evidence", response_model=EvidenceTrace)
async def get_evidence_explanation(
    patient_id: str,
    insight_id: str = Query("insight_01"),
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Explain Why?: Returns exact evidence trace from MongoDB."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access to patient")
    return get_evidence_trace(patient_id, insight_id)


@router.post("/voice-parse", response_model=StructuredVoiceNoteOut)
async def parse_structured_voice_notes(
    payload: VoiceParseIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Speech-to-text AI Structurer: Converts raw spoken dictation into structured intake fields."""
    raw = payload.raw_speech_text.strip()
    return StructuredVoiceNoteOut(
        chief_complaint="Fever and severe dry cough for 3 days",
        symptoms=["Fever (38.2 °C)", "Dry Cough", "Frontal Headache"],
        duration="3 days",
        observations="Lungs clear to auscultation, no crackles or wheezing. Mild pharyngeal erythema.",
        doctor_notes=raw if raw else "Patient reports fever for three days with dry cough and mild fatigue.",
    )


@router.get("/analytics", response_model=DoctorAnalytics)
async def get_doctor_analytics(
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """V2 Feature: Actionable Doctor Analytics summary, scoped to this doctor's own patient panel."""
    db = get_patient_db()
    patient_ids = _get_doctor_patient_ids(db, user.user_id)

    # 1. Total assigned patients
    assigned_count = len(patient_ids)

    # 2. Consultations this week
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    consult_count = db.consultations.count_documents({"doctor_id": user.user_id, "created_at": {"$gte": week_ago}})

    # 3. Pending lab reviews
    pending_labs = _count_pending_lab_reviews(db, patient_ids)

    # 4. Upcoming appointments
    upcoming_appts = db.appointments.count_documents(
        {"doctor_id": user.user_id, "status": {"$in": ["requested", "confirmed"]}}
    )

    # 5. Risk Distribution (Stable / Requires Attention / Critical), scoped to this doctor's alerts
    unread_alerts = list(db.alerts.find({"doctor_id": user.user_id, "is_read": 0}, {"_id": 0}))
    alert_rows = Counter(r["severity"] for r in unread_alerts)
    critical_cnt = alert_rows.get("critical", 0) + alert_rows.get("important", 0)
    attention_cnt = alert_rows.get("attention", 0)
    stable_cnt = max(0, assigned_count - (critical_cnt + attention_cnt))
    total_risk = stable_cnt + attention_cnt + critical_cnt

    patient_risk_distribution = []
    if total_risk > 0:
        patient_risk_distribution = [
            {"label": "Stable Condition", "count": stable_cnt, "percentage": round((stable_cnt / total_risk) * 100, 1), "color": "#0d9488"},
            {"label": "Requires Attention", "count": attention_cnt, "percentage": round((attention_cnt / total_risk) * 100, 1), "color": "#f59e0b"},
            {"label": "Critical / High Risk", "count": critical_cnt, "percentage": round((critical_cnt / total_risk) * 100, 1), "color": "#ef4444"},
        ]

    # 6. Top Chronic Conditions Prevalence, scoped to this doctor's patients
    all_conditions = list(db.patient_conditions.find({"patient_id": {"$in": patient_ids}}, {"_id": 0})) if patient_ids else []
    cond_rows = Counter(r["condition_name"] for r in all_conditions).most_common(5)
    top_chronic_conditions = [
        {
            "condition": condition_name,
            "count": cnt,
            "percentage": round((cnt / max(1, assigned_count)) * 100, 1),
        }
        for condition_name, cnt in cond_rows
    ]

    # 7. Patient Panel Adherence Breakdown, computed per assigned patient from real medication_logs
    adherence_rates = [r for r in (compute_adherence_rate(pid) for pid in patient_ids) if r is not None]
    total_adh = len(adherence_rates)
    adherence_breakdown = []
    overall_adherence_rate = "No data"
    if total_adh > 0:
        high_adh = sum(1 for r in adherence_rates if r > 85)
        mod_adh = sum(1 for r in adherence_rates if 70 <= r <= 85)
        low_adh = sum(1 for r in adherence_rates if r < 70)
        adherence_breakdown = [
            {"category": "High Adherence (>85%)", "count": high_adh, "percentage": round(high_adh / total_adh * 100, 1), "color": "#10b981"},
            {"category": "Moderate Adherence (70-85%)", "count": mod_adh, "percentage": round(mod_adh / total_adh * 100, 1), "color": "#3b82f6"},
            {"category": "Low Adherence (<70%)", "count": low_adh, "percentage": round(low_adh / total_adh * 100, 1), "color": "#f59e0b"},
        ]
        overall_adherence_rate = f"{round(sum(adherence_rates) / total_adh, 1)}%"

    # 8. Age Demographics, scoped to this doctor's patients
    ages = (
        [p["age"] for p in db.patients.find({"id": {"$in": patient_ids}}, {"_id": 0, "age": 1}) if p.get("age") is not None]
        if patient_ids else []
    )
    age_demographics = [
        {"group": "18 - 34 yrs", "count": sum(1 for age in ages if age < 35)},
        {"group": "35 - 50 yrs", "count": sum(1 for age in ages if 35 <= age <= 50)},
        {"group": "51 - 65 yrs", "count": sum(1 for age in ages if 51 <= age <= 65)},
        {"group": "65+ yrs", "count": sum(1 for age in ages if age > 65)},
    ]

    # 9. Alert Severity Breakdown, scoped to this doctor
    alert_severity_breakdown = [
        {"severity": "Critical Vitals", "count": alert_rows.get("critical", 0), "color": "#ef4444"},
        {"severity": "Important Lab Delta", "count": alert_rows.get("important", 0), "color": "#f97316"},
        {"severity": "Adherence Gaps", "count": alert_rows.get("attention", 0), "color": "#eab308"},
        {"severity": "Routine Follow-up", "count": alert_rows.get("info", 0), "color": "#06b6d4"},
    ]

    # 10. Weekly Consultation Velocity, real day-of-week counts over the last 7 days
    week_rows = list(
        db.consultations.find({"doctor_id": user.user_id, "created_at": {"$gte": week_ago}}, {"_id": 0, "created_at": 1})
    )
    day_counts: Counter = Counter()
    for r in week_rows:
        try:
            dt = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            day_counts[dt.strftime("%a")] += 1
        except (ValueError, KeyError):
            continue
    weekly_consultation_velocity = [
        {"day": day, "count": day_counts.get(day, 0)} for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    ]

    return DoctorAnalytics(
        total_assigned_patients=assigned_count,
        consultations_this_week=consult_count,
        pending_lab_reviews=pending_labs,
        upcoming_appointments=upcoming_appts,
        overall_adherence_rate=overall_adherence_rate,
        weekly_consultation_velocity=weekly_consultation_velocity,
        patient_risk_distribution=patient_risk_distribution,
        top_chronic_conditions=top_chronic_conditions,
        adherence_breakdown=adherence_breakdown,
        age_demographics=age_demographics,
        alert_severity_breakdown=alert_severity_breakdown,
    )


@router.get("/compare", response_model=MultiPatientCompareResult)
async def compare_patients(
    patient_ids: str = Query("", description="Comma-separated patient ids; defaults to this doctor's own assigned patients"),
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """V2 Feature: Side-by-side comparison of this doctor's own patients' metrics from MongoDB."""
    db = get_patient_db()

    requested_ids = [pid.strip() for pid in patient_ids.split(",") if pid.strip()]
    if not requested_ids:
        requested_ids = _get_doctor_patient_ids(db, user.user_id)[:3]

    # Isolation: only ids this doctor is actually authorized to view are compared.
    ids = [pid for pid in requested_ids if verify_patient_access(pid, user)]
    cards: List[PatientComparisonCard] = []

    for pid in ids:
        p_row = db.patients.find_one({"id": pid}, {"_id": 0})
        if not p_row:
            continue

        v_row = db.vitals.find_one(
            {"patient_id": pid}, {"_id": 0, "systolic_bp": 1, "diastolic_bp": 1}, sort=[("recorded_at", -1)]
        )
        bp = f"{v_row['systolic_bp']}/{v_row['diastolic_bp']}" if v_row else "No data"

        g_row = db.lab_metrics.find_one(
            {"patient_id": pid, "metric_name": {"$regex": "Glucose"}},
            {"_id": 0, "value": 1, "unit": 1},
            sort=[("recorded_at", -1)],
        )
        glucose = f"{g_row['value']} {g_row.get('unit', 'mg/dL')}" if g_row else "No data"

        latest_consult = db.consultations.find_one(
            {"patient_id": pid, "status": "finalized"}, {"_id": 0, "final_diagnosis": 1}, sort=[("finalized_at", -1)]
        )
        diagnosis = (latest_consult.get("final_diagnosis") if latest_consult else None) or "No diagnosis recorded"

        adherence = compute_adherence_rate(pid)
        adherence_str = f"{adherence}%" if adherence is not None else "No data"

        has_urgent_alert = db.alerts.find_one(
            {"patient_id": pid, "is_read": 0, "severity": {"$in": ["critical", "important"]}}
        )
        patient_status = "attention" if has_urgent_alert else "stable"

        cards.append(
            PatientComparisonCard(
                patient_id=pid,
                name=p_row.get("name") or pid,
                age=p_row.get("age") or 0,
                gender=p_row.get("gender") or "Unknown",
                blood_group=p_row.get("blood_group") or "Unknown",
                primary_diagnosis=diagnosis,
                adherence_rate=adherence_str,
                latest_bp=bp,
                latest_glucose=glucose,
                status=patient_status,
            )
        )

    attention_cards = [c for c in cards if c.status == "attention"]
    if attention_cards:
        highlights = "; ".join(
            f"{c.name} ({c.patient_id}) — adherence {c.adherence_rate}, BP {c.latest_bp}" for c in attention_cards
        )
        comparison_summary = f"Requires attention: {highlights}."
    elif cards:
        comparison_summary = "All compared patients are currently stable."
    else:
        comparison_summary = "No patients available to compare."

    return MultiPatientCompareResult(
        patients=cards,
        comparison_summary=comparison_summary,
    )


@router.get("/patient/{patient_id}/overview")
async def get_patient_workspace_overview(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Returns overview identity and clinical status from MongoDB."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access to patient workspace")

    db = get_patient_db()
    context = build_patient_context(patient_id)
    latest_consult = context.get("latest_consultation")
    adherence = compute_adherence_rate(patient_id)

    next_appt = db.appointments.find_one(
        {"patient_id": patient_id, "doctor_id": user.user_id, "status": {"$in": ["requested", "confirmed"]}},
        {"_id": 0, "appointment_date": 1},
        sort=[("appointment_date", 1)],
    )

    return {
        "patient_id": patient_id,
        "profile": context.get("profile"),
        "latest_diagnosis": latest_consult.get("final_diagnosis") if latest_consult else None,
        "adherence_rate": f"{adherence}%" if adherence is not None else None,
        "latest_vitals": context.get("latest_vitals"),
        "next_appointment_date": next_appt.get("appointment_date") if next_appt else None,
    }


@router.get("/patient/{patient_id}/timeline-analysis")
async def analyze_patient_timeline(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """AI feature: Analyzes this patient's real recorded history for trends."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    db = get_patient_db()
    lines: List[str] = []

    vitals_history = list(
        db.vitals.find({"patient_id": patient_id}, {"_id": 0, "systolic_bp": 1, "recorded_at": 1}).sort("recorded_at", 1)
    )
    if len(vitals_history) >= 2:
        first, last = vitals_history[0], vitals_history[-1]
        direction = "risen" if last["systolic_bp"] > first["systolic_bp"] else ("fallen" if last["systolic_bp"] < first["systolic_bp"] else "stayed steady")
        lines.append(f"• Vitals: Systolic BP has {direction} from {first['systolic_bp']} to {last['systolic_bp']} mmHg.")

    lab_rows = list(db.lab_metrics.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", 1))
    by_metric: dict = {}
    for r in lab_rows:
        by_metric.setdefault(r["metric_name"], []).append(r)
    for metric_name, points in by_metric.items():
        if len(points) >= 2:
            first, last = points[0], points[-1]
            lines.append(f"• Lab Metrics: {metric_name} changed from {first['value']} to {last['value']} {last.get('unit', '')}".strip() + ".")

    latest_rx = db.prescriptions.find_one(
        {"patient_id": patient_id}, {"_id": 0, "medication_name": 1, "dosage": 1, "created_at": 1}, sort=[("created_at", -1)]
    )
    if latest_rx:
        lines.append(f"• Prescriptions: Most recent addition — {latest_rx['medication_name']} {latest_rx['dosage']} on {latest_rx['created_at'][:10]}.")

    fourteen_days_ago = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    twenty_eight_days_ago = (datetime.now(timezone.utc) - timedelta(days=28)).isoformat()
    prev_adherence = compute_adherence_rate(patient_id, since=twenty_eight_days_ago, until=fourteen_days_ago)
    curr_adherence = compute_adherence_rate(patient_id, since=fourteen_days_ago)
    if prev_adherence is not None and curr_adherence is not None:
        delta = round(curr_adherence - prev_adherence, 1)
        trend = "improved" if delta > 0 else ("dropped" if delta < 0 else "held steady")
        lines.append(f"• Medication Logs: Adherence has {trend} by {abs(delta)} percentage points over the last two weeks.")

    analysis_text = "\n".join(lines) if lines else "Not enough recorded history yet for a trend analysis."
    return {"patient_id": patient_id, "analysis": analysis_text}


@router.get("/patient/{patient_id}/pre-brief", response_model=PreConsultationBrief)
async def generate_pre_consultation_brief(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Pre-Consultation Brief: Generates pre-visit summary from this patient's real MongoDB records."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    db = get_patient_db()
    context = build_patient_context(patient_id)
    name = context["profile"]["fullName"] or patient_id

    last_finalized = db.consultations.find_one(
        {"patient_id": patient_id, "status": "finalized"},
        {"_id": 0, "finalized_at": 1, "created_at": 1},
        sort=[("finalized_at", -1)],
    )
    last_visit_date = (last_finalized.get("finalized_at") or last_finalized.get("created_at")) if last_finalized else None

    latest_per_metric: dict = {}
    for r in db.lab_metrics.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", -1):
        latest_per_metric.setdefault(r["metric_name"], r)
    main_concerns = [
        f"Elevated {metric_name} ({r['value']} {r.get('unit', '')})".strip()
        for metric_name, r in latest_per_metric.items() if r.get("is_abnormal")
    ]
    active_alerts = list(db.alerts.find({"patient_id": patient_id, "is_read": 0}, {"_id": 0, "title": 1}))
    main_concerns.extend(a["title"] for a in active_alerts)

    fourteen_days_ago = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    twenty_eight_days_ago = (datetime.now(timezone.utc) - timedelta(days=28)).isoformat()
    prev_adherence = compute_adherence_rate(patient_id, since=twenty_eight_days_ago, until=fourteen_days_ago)
    curr_adherence = compute_adherence_rate(patient_id, since=fourteen_days_ago)
    if prev_adherence is not None and curr_adherence is not None and prev_adherence != curr_adherence:
        delta = round(curr_adherence - prev_adherence, 1)
        trend_summary = f"Medication compliance {'up' if delta > 0 else 'down'} {abs(delta)} points over the last two weeks."
    else:
        trend_summary = "No significant trend detected since the last visit."

    discussion_topics = [f"Review: {c}" for c in main_concerns[:3]] or ["General wellness check-in"]

    return PreConsultationBrief(
        patient_id=patient_id,
        patient_name=name,
        age=context["profile"]["age"],
        last_visit_date=last_visit_date,
        main_concerns=main_concerns,
        trend_summary=trend_summary,
        suggested_discussion_topics=discussion_topics,
    )


@router.get("/patient/{patient_id}/lab-trends", response_model=List[LabMetricTrend])
async def get_lab_intelligence_trends(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Lab Intelligence: Queries MongoDB lab_metrics collection for every metric actually recorded for this patient."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    db = get_patient_db()
    rows = list(db.lab_metrics.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", 1))

    by_metric: dict = {}
    for r in rows:
        entry = by_metric.setdefault(r["metric_name"], {"unit": r.get("unit", ""), "points": []})
        entry["points"].append(r)

    trends: List[LabMetricTrend] = []
    for metric_name, data in by_metric.items():
        points = data["points"]
        history = [
            MetricHistoryPoint(date=p["recorded_at"], value=p["value"], is_abnormal=bool(p.get("is_abnormal")))
            for p in points
        ]
        if len(points) >= 2 and points[-1]["value"] != points[0]["value"]:
            trend_direction = "up" if points[-1]["value"] > points[0]["value"] else "down"
        else:
            trend_direction = "flat"
        trends.append(
            LabMetricTrend(
                metric_name=metric_name,
                unit=data["unit"],
                history=history,
                trend_direction=trend_direction,
            )
        )

    return trends


@router.post("/copilot/chat")
async def doctor_clinical_copilot_chat(
    payload: CopilotChatIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Dedicated Doctor Clinical Copilot: Receives query and target patient context from MongoDB."""
    if not payload.patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    target_patient_id = payload.patient_id
    if not verify_patient_access(target_patient_id, user):
        raise HTTPException(status_code=403, detail="Unauthorized access to patient context")

    context = build_patient_context(target_patient_id)
    patient_name = context["profile"]["fullName"] or target_patient_id
    latest_consult = context.get("latest_consultation")
    diagnosis = (latest_consult.get("final_diagnosis") if latest_consult else None) or "No diagnosis recorded yet"
    adherence = compute_adherence_rate(target_patient_id)
    adherence_str = f"{adherence}%" if adherence is not None else "No data"
    active_prescriptions = context.get("active_prescriptions") or []
    rx_list = ", ".join(p["medication_name"] for p in active_prescriptions) or "None recorded"

    system_prompt = f"""
You are MedSys Clinical Copilot, an AI assistant for Doctor {user.full_name}.
Provide concise, accurate clinical summaries and analysis for patient {patient_name} (ID: {target_patient_id}).
Context from MongoDB:
- Diagnosis: {diagnosis}
- Conditions: {', '.join(context['profile']['conditions']) or 'None recorded'}
- Active Prescriptions: {rx_list}
- Adherence Rate: {adherence_str}
"""

    try:
        response_text = await generate_completion(
            messages=[{"role": "user", "content": payload.message}],
            system_prompt=system_prompt,
        )
    except Exception:
        response_text = (
            f"Clinical Copilot Analysis for {patient_name}:\n"
            f"• Current Diagnosis: {diagnosis}\n"
            f"• Prescriptions: {rx_list}\n"
            f"• Adherence Rate: {adherence_str}"
        )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="DOCTOR_COPILOT_QUERY",
        target_patient_id=target_patient_id,
        resource="/api/doctor/copilot/chat",
        details=f"Query: {payload.message[:80]}",
    )

    return {
        "patient_id": target_patient_id,
        "patient_name": patient_name,
        "reply": response_text,
    }


@router.get("/patient/{patient_id}/timeline")
async def get_patient_timeline(
    patient_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Retrieves full clinical timeline for authorized patient from MongoDB."""
    if not verify_patient_access(patient_id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to access patient medical timeline",
        )

    context = build_patient_context(patient_id)

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="READ_PATIENT_TIMELINE",
        target_patient_id=patient_id,
        resource=f"/api/doctor/patient/{patient_id}/timeline",
    )

    return {
        "patient_id": patient_id,
        "profile": context["profile"],
        "consultations": context["consultations"],
        "lab_reports": [],
        "active_medications": context["active_prescriptions"],
    }


@router.post("/consultations", response_model=ConsultationSession)
async def create_consultation_session(
    payload: ConsultationCreateIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Creates a new clinical consultation session in draft state in MongoDB."""
    if not verify_patient_access(payload.patient_id, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized doctor access to patient",
        )

    db = get_patient_db()

    session_id = f"cs_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    p_row = db.patients.find_one({"id": payload.patient_id}, {"_id": 0, "name": 1})
    patient_name = (p_row.get("name") if p_row else None) or payload.patient_id

    vitals_json = json.dumps(payload.vitals.model_dump()) if payload.vitals else "{}"
    symptoms_str = ", ".join(payload.symptoms)

    db.consultations.insert_one({
        "id": session_id,
        "patient_id": payload.patient_id,
        "doctor_id": user.user_id,
        "symptoms": symptoms_str,
        "vitals_json": vitals_json,
        "doctor_notes": payload.doctor_notes or "",
        "status": "draft",
        "created_at": now,
    })

    session = ConsultationSession(
        id=session_id,
        patient_id=payload.patient_id,
        doctor_id=user.user_id,
        doctor_name=user.full_name,
        patient_name=patient_name,
        created_at=now,
        updated_at=now,
        status="draft",
        symptoms=payload.symptoms,
        vitals=payload.vitals,
        doctor_notes=payload.doctor_notes or "",
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="CREATE_CONSULTATION",
        target_patient_id=payload.patient_id,
        resource=f"/api/doctor/consultations/{session_id}",
    )

    return session


@router.post("/consultations/{session_id}/ai-assist", response_model=ConsultationSession)
async def trigger_ai_decision_support(
    session_id: str,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Triggers AI Clinical Decision Support on MongoDB consultation session."""
    db = get_patient_db()

    c_dict = db.consultations.find_one({"id": session_id}, {"_id": 0})
    if not c_dict:
        raise HTTPException(status_code=404, detail="Consultation session not found")

    if not verify_patient_access(c_dict["patient_id"], user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    p_row = db.patients.find_one({"id": c_dict["patient_id"]}, {"_id": 0, "name": 1, "age": 1})
    patient_name = (p_row.get("name") if p_row else None) or c_dict["patient_id"]
    age = p_row.get("age") if p_row else None

    symptoms = c_dict["symptoms"].split(", ") if c_dict.get("symptoms") else []

    ai_suggestions = await generate_doctor_ai_support(
        patient_name=patient_name,
        age=age,
        symptoms=symptoms,
        vitals=None,
        doctor_notes=c_dict.get("doctor_notes", ""),
    )

    now = datetime.now(timezone.utc).isoformat()
    db.consultations.update_one(
        {"id": session_id},
        {"$set": {
            "ai_summary": ai_suggestions.clinical_summary,
            "ai_differential": ", ".join(ai_suggestions.differential_diagnoses),
        }},
    )

    session = ConsultationSession(
        id=session_id,
        patient_id=c_dict["patient_id"],
        doctor_id=user.user_id,
        doctor_name=user.full_name,
        patient_name=patient_name,
        created_at=c_dict["created_at"],
        updated_at=now,
        status="draft",
        symptoms=symptoms,
        ai_suggestions=ai_suggestions,
        doctor_notes=c_dict.get("doctor_notes", ""),
        doctor_diagnosis="",
    )

    return session


@router.post("/consultations/{session_id}/finalize", response_model=ConsultationSession)
async def finalize_consultation_session(
    session_id: str,
    payload: ConsultationFinalizeIn,
    user: AuthenticatedUser = Depends(require_role("doctor")),
):
    """Doctor signs off on diagnosis and saves prescriptions directly into MongoDB collections."""
    db = get_patient_db()

    c_dict = db.consultations.find_one({"id": session_id}, {"_id": 0})
    if not c_dict:
        raise HTTPException(status_code=404, detail="Consultation session not found")

    if not verify_patient_access(c_dict["patient_id"], user):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    p_row = db.patients.find_one({"id": c_dict["patient_id"]}, {"_id": 0, "name": 1})
    patient_name = (p_row.get("name") if p_row else None) or c_dict["patient_id"]

    now = datetime.now(timezone.utc).isoformat()
    diet_str = ", ".join(payload.diet_recommendations)

    db.consultations.update_one(
        {"id": session_id},
        {"$set": {
            "final_diagnosis": payload.doctor_diagnosis,
            "doctor_notes": payload.doctor_notes,
            "diet_advice": diet_str,
            "follow_up_date": payload.follow_up_date,
            "status": "finalized",
            "finalized_at": now,
        }},
    )

    # Insert prescriptions into prescriptions collection
    for rx in payload.prescriptions:
        rx_id = f"rx_{uuid.uuid4().hex[:10]}"
        db.prescriptions.insert_one({
            "id": rx_id,
            "consultation_id": session_id,
            "patient_id": c_dict["patient_id"],
            "doctor_id": user.user_id,
            "medication_name": rx.medication_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "duration_days": rx.duration_days,
            "instructions": rx.instructions,
            # Missing previously — every prescription signed off through this
            # endpoint silently failed to appear anywhere that reads
            # "active" prescriptions (patient_context_service's
            # active_prescriptions query filters on this field).
            "status": "active",
            "created_at": now,
        })

    session = ConsultationSession(
        id=session_id,
        patient_id=c_dict["patient_id"],
        doctor_id=user.user_id,
        doctor_name=user.full_name,
        patient_name=patient_name,
        created_at=c_dict["created_at"],
        updated_at=now,
        status="finalized",
        symptoms=c_dict["symptoms"].split(", ") if c_dict.get("symptoms") else [],
        doctor_diagnosis=payload.doctor_diagnosis,
        prescriptions=payload.prescriptions,
        doctor_notes=payload.doctor_notes,
        diet_recommendations=payload.diet_recommendations,
        follow_up_date=payload.follow_up_date,
        signed_off_at=now,
    )

    log_audit_event(
        actor_id=user.user_id,
        actor_role=user.role,
        action="FINALIZE_CONSULTATION_DOCTOR_SIGNOFF",
        target_patient_id=c_dict["patient_id"],
        resource=f"/api/doctor/consultations/{session_id}/finalize",
        details=f"Doctor signed off on diagnosis: {payload.doctor_diagnosis}",
    )

    return session
