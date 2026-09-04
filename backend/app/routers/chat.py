import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.config import settings
from app.db import get_patient_db
from app.models import (
    ChatMessage,
    ChatMessageIn,
    ChatSession,
    ChatSessionIn,
    ChatSessionSourcesIn,
    ChatSource,
)
from app.services import (
    ai_graph_builder,
    med_safety,
    model_router,
    pinecone_client,
    quick_options,
    rag,
    supermemory_client,
    symptom_tracker,
    triage,
    weather,
    web_search,
)
from app.services.clerk_auth import require_clerk_auth
from app.services.domain_adapter import (
    build_specialty_prompt_preamble,
    call_remote_medgemma_adapter,
    get_adapter_display_name,
    resolve_adapter,
)
from app.services.mock_data import CHAT_SOURCES

router = APIRouter(prefix="/chat", tags=["chat"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


async def _remember_message(session_id: str, role: str, content: str, user_id: str) -> None:
    rag.store_chat_message(session_id, role, content, user_id)
    await supermemory_client.log_chat_message(session_id, role, content, user_id)


async def _refine_chat_title(db, session_id: str, user_message: str, assistant_reply: str) -> None:
    """Runs in the background after the reply has already been sent —
    swaps the session's quick raw-text title for a proper AI-generated
    heading once it's ready, instead of making the user wait on it."""
    try:
        title = await model_router.generate_chat_title(user_message, assistant_reply)
    except Exception:
        return
    db.chat_sessions.update_one({"id": session_id}, {"$set": {"title": title}})


def _aggregate_patient_ehr_context(db, patient_id: str) -> list[str]:
    """Pulls all clinical details for the target patient from MongoDB collections:
    - Basic demographics & biometrics (Age, Gender, Blood Group, Height, Weight, BMI) & vitals
    - Active medications / prescriptions
    - Diagnosed conditions
    - Diet plan
    - Attending doctor remarks & past consultation diagnoses
    - Abnormal lab metrics
    """
    parts = []

    # 1. Basic Demographics & Biometrics
    pat = db.patients.find_one({"id": patient_id}, {"_id": 0})
    user_prof = db.profiles.find_one({"clerkUserId": patient_id}, {"_id": 0})

    if pat or user_prof:
        name = (pat and pat.get("name")) or (user_prof and user_prof.get("fullName")) or patient_id
        age = (pat and pat.get("age")) or (user_prof and user_prof.get("age")) or "N/A"
        gender = (pat and pat.get("gender")) or "N/A"
        blood_group = (pat and pat.get("blood_group")) or (user_prof and user_prof.get("bloodGroup")) or "N/A"
        height_cm = (pat and pat.get("height_cm")) or (user_prof and user_prof.get("heightCm")) or 170.0
        weight_kg = (pat and pat.get("weight_kg")) or (user_prof and user_prof.get("weightKg")) or 70.0

        try:
            h_val = float(height_cm)
            w_val = float(weight_kg)
            h_m = h_val / 100
            bmi_val = round(w_val / (h_m * h_m), 1) if h_m > 0 else "N/A"
        except (ValueError, TypeError):
            bmi_val = "N/A"

        parts.append(
            f"[PATIENT DEMOGRAPHICS & BIOMETRICS]\n"
            f"ID: {pat.get('patient_id_code') if pat else patient_id}\n"
            f"Name: {name}\n"
            f"Age: {age} y/o, Gender: {gender}, Blood Group: {blood_group}\n"
            f"Height: {height_cm} cm, Weight: {weight_kg} kg, BMI: {bmi_val}"
        )

    # 2. Latest Vitals
    vitals = list(db.vitals.find({"patient_id": patient_id}, {"_id": 0}).sort("recorded_at", -1).limit(1))
    if vitals:
        v = vitals[0]
        parts.append(
            f"[LATEST VITALS]\n"
            f"Blood Pressure: {v.get('systolic') or v.get('systolic_bp', 120)}/{v.get('diastolic') or v.get('diastolic_bp', 80)} mmHg\n"
            f"Heart Rate: {v.get('heart_rate', 72)} bpm, SpO2: {v.get('spo2_pct', 98)}%, Temp: {v.get('temperature_c', 37.0)}°C"
        )

    # 3. Active Prescriptions
    prescriptions = list(db.prescriptions.find({"patient_id": patient_id, "status": "active"}, {"_id": 0}))
    if prescriptions:
        rx_lines = [
            f"- {p.get('medication_name')}: {p.get('dosage')} ({p.get('frequency')}) — Instructions: {p.get('instructions', 'N/A')}"
            for p in prescriptions
        ]
        parts.append(f"[CURRENT ACTIVE MEDICATIONS]\n" + "\n".join(rx_lines))

    # 4. Diagnosed Conditions
    conditions = list(db.patient_conditions.find({"patient_id": patient_id, "status": "active"}, {"_id": 0}))
    if conditions:
        cond_lines = [
            f"- {c.get('condition_name')} (Diagnosed: {c.get('diagnosed_date', 'N/A')}) — Notes: {c.get('notes', '')}"
            for c in conditions
        ]
        parts.append(f"[ACTIVE MEDICAL CONDITIONS]\n" + "\n".join(cond_lines))

    # 5. Diet Plan
    diet_doc = db.patient_diet.find_one({"patient_id": patient_id}, {"_id": 0})
    if diet_doc and "diet_plan" in diet_doc:
        dp = diet_doc["diet_plan"]
        recs = dp.get("recommendations", [])
        if recs:
            parts.append(f"[DIET GUIDELINES & PLAN]\n" + "\n".join(f"- {r}" for r in recs))

    # 6. Past Consultations & Doctor Remarks
    consultations = list(db.consultations.find({"patient_id": patient_id, "status": "finalized"}, {"_id": 0}).sort("finalized_at", -1).limit(3))
    if consultations:
        consult_lines = []
        for cs in consultations:
            date_str = (cs.get("finalized_at") or cs.get("created_at") or "")[:10]
            diag = cs.get("final_diagnosis") or cs.get("doctor_diagnosis") or "General Consultation"
            notes = cs.get("doctor_notes") or "None"
            consult_lines.append(f"- [{date_str}] Diagnosis: {diag} | Attending Doctor Notes: {notes}")
        parts.append(f"[PAST CONSULTATIONS & DOCTOR REMARKS]\n" + "\n".join(consult_lines))

    # 7. Recent Abnormal Lab Metrics
    lab_metrics = list(db.lab_metrics.find({"patient_id": patient_id, "is_abnormal": 1}, {"_id": 0}).sort("recorded_at", -1).limit(5))
    if lab_metrics:
        lab_lines = [
            f"- {lm.get('metric_name')}: {lm.get('value')} {lm.get('unit')} (Ref: {lm.get('reference_min')}-{lm.get('reference_max')})"
            for lm in lab_metrics
        ]
        parts.append(f"[FLAGGED ABNORMAL LAB RESULTS]\n" + "\n".join(lab_lines))

    return parts


@router.get("/sessions", response_model=list[ChatSession])
def list_sessions(
    patient_id: Optional[str] = Query(None),
    user_id: str = Depends(require_clerk_auth),
) -> list[dict]:
    db = get_patient_db()
    query: dict = {"$or": [{"clerkUserId": user_id}, {"doctor_id": user_id}]}
    if patient_id and isinstance(patient_id, str):
        query["patient_id"] = patient_id
    sessions = list(
        db.chat_sessions.find(query, {"_id": 0, "clerkUserId": 0}).sort("updatedAt", -1)
    )
    # Ensure patient_name and is_patient_scoped are populated
    for s in sessions:
        p_id = s.get("patient_id")
        if p_id and p_id != "general":
            s["is_patient_scoped"] = True
            if not s.get("patient_name"):
                pat = db.patients.find_one({"id": p_id}, {"_id": 0, "name": 1})
                s["patient_name"] = pat.get("name") if pat else p_id
        else:
            s["is_patient_scoped"] = False
            s["patient_name"] = None

    return sessions


@router.post("/sessions", response_model=ChatSession)
def create_session(body: ChatSessionIn, user_id: str = Depends(require_clerk_auth)) -> dict:
    db = get_patient_db()
    target_patient_id = getattr(body, "patient_id", None) or "general"
    patient_name = getattr(body, "patient_name", None)
    is_scoped = bool(target_patient_id and target_patient_id != "general")

    if is_scoped and not patient_name:
        pat = db.patients.find_one({"id": target_patient_id}, {"_id": 0, "name": 1})
        patient_name = pat.get("name") if pat else target_patient_id

    default_title = f"Patient Copilot: {patient_name}" if is_scoped else "General Clinical Copilot"
    title = body.title or default_title

    session = {
        "id": _new_id("sess"),
        "clerkUserId": user_id,
        "doctor_id": user_id,
        "patient_id": target_patient_id,
        "patient_name": patient_name if is_scoped else None,
        "is_patient_scoped": is_scoped,
        "title": title,
        "createdAt": _now(),
        "updatedAt": _now(),
        "sourceIds": [],
    }
    db.chat_sessions.insert_one({**session})
    res = {**session}
    res.pop("clerkUserId", None)
    return res


@router.put("/sessions/{session_id}/sources", response_model=ChatSession)
def set_session_sources(session_id: str, body: ChatSessionSourcesIn, user_id: str = Depends(require_clerk_auth)) -> dict:
    db = get_patient_db()
    session = db.chat_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.chat_sessions.update_one(
        {"id": session_id}, {"$set": {"sourceIds": body.sourceIds, "updatedAt": _now()}}
    )
    return {**session, "sourceIds": body.sourceIds}


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessage])
def get_session_messages(session_id: str, user_id: str = Depends(require_clerk_auth)) -> list[dict]:
    db = get_patient_db()
    return list(
        db.chat_messages.find({"sessionId": session_id}, {"_id": 0}).sort("createdAt", 1)
    )


@router.post("/sessions/{session_id}/messages", response_model=ChatMessage)
async def post_session_message(
    session_id: str, body: ChatMessageIn, user_id: str = Depends(require_clerk_auth)
) -> dict:
    db = get_patient_db()
    session = db.chat_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    is_first_message = db.chat_messages.count_documents({"sessionId": session_id}) == 0

    # 1. Resolve domain adapter (@tag explicit or implicit classification)
    adapter_key, clean_content, is_explicit_adapter = resolve_adapter(
        body.content, explicit_specialty=body.adapter or body.specialty
    )
    adapter_label = get_adapter_display_name(adapter_key)

    user_message = {
        "id": _new_id("m"),
        "sessionId": session_id,
        "role": "user",
        "content": body.content,
        "createdAt": _now(),
    }
    db.chat_messages.insert_one({**user_message})
    await _remember_message(session_id, "user", clean_content, user_id)

    # 2. Semantic Clinical Triage & Red-Flag Guardrail
    triage_result = await triage.eval_triage(clean_content)
    if triage_result.get("is_red_flag"):
        reason = triage_result.get("red_flag_reason") or "Potential clinical emergency indicator detected."
        guidance = triage_result.get("escalation_guidance") or "Please seek immediate emergency medical care (call 911 or go to the nearest Emergency Department immediately)."
        escalation_text = (
            f"⚠️ **EMERGENCY MEDICAL WARNING**\n\n"
            f"**Clinical Observation**: {reason}\n\n"
            f"**Recommended Action**: {guidance}\n\n"
            f"*Safety Protocol Note: Standard self-care and medication suggestions are suppressed due to high-priority emergency indicators. Please consult an emergency physician without delay.*"
        )
        assistant_message = {
            "id": _new_id("m"),
            "sessionId": session_id,
            "role": "assistant",
            "content": escalation_text,
            "createdAt": _now(),
            "isRedFlag": True,
            "adapter_used": adapter_label,
        }
        db.chat_messages.insert_one({**assistant_message})
        await _remember_message(session_id, "assistant", escalation_text, user_id)

        update = {"updatedAt": _now()}
        if is_first_message:
            update["title"] = clean_content[:60]
        db.chat_sessions.update_one({"id": session_id}, {"$set": update})
        if is_first_message:
            asyncio.create_task(_refine_chat_title(db, session_id, clean_content, escalation_text))
        return assistant_message

    # 3. Optional deep search
    search_query = (
        clean_content
        if body.deepSearch
        else await model_router.decide_web_search(clean_content)
    )

    web_sources: list[dict] = []
    if search_query:
        web_sources = await web_search.deep_search(search_query, user_id)

    web_source_ids = [f"web:{w['url']}" for w in web_sources]
    allowed_source_ids = [
        f"chat:{session_id}",
        *session.get("sourceIds", []),
        *web_source_ids,
    ]
    if web_source_ids:
        db.chat_sessions.update_one(
            {"id": session_id}, {"$addToSet": {"sourceIds": {"$each": web_source_ids}}}
        )

    # 4. Multi-Context Assembly
    context_chunks = rag.retrieve(clean_content, user_id, top_k=6, allowed_source_ids=allowed_source_ids)
    weather_task = weather.get_environment_snapshot()
    env_snapshot = await weather_task

    context_parts: list[str] = []

    # Inject Patient EHR Records if session is patient-scoped or if user is patient
    session_patient_id = session.get("patient_id")
    if session_patient_id and session_patient_id != "general":
        ehr_blocks = _aggregate_patient_ehr_context(db, session_patient_id)
        context_parts.extend(ehr_blocks)
    else:
        # Patient's own biometric and clinical profile context
        user_profile = db.profiles.find_one({"clerkUserId": user_id}, {"_id": 0})
        pat_record = db.patients.find_one({"$or": [{"id": user_id}, {"clerk_id": user_id}]}, {"_id": 0})

        full_name = (user_profile and user_profile.get("fullName")) or (pat_record and pat_record.get("name")) or "Patient"
        age = (user_profile and user_profile.get("age")) or (pat_record and pat_record.get("age")) or "N/A"
        gender = (pat_record and pat_record.get("gender")) or "N/A"
        blood_group = (user_profile and user_profile.get("bloodGroup")) or (pat_record and pat_record.get("blood_group")) or "N/A"
        height_cm = (user_profile and user_profile.get("heightCm")) or (pat_record and pat_record.get("height_cm")) or 170.0
        weight_kg = (user_profile and user_profile.get("weightKg")) or (pat_record and pat_record.get("weight_kg")) or 70.0

        try:
            h_val = float(height_cm)
            w_val = float(weight_kg)
            h_m = h_val / 100
            bmi_val = round(w_val / (h_m * h_m), 1) if h_m > 0 else "N/A"
        except (ValueError, TypeError):
            bmi_val = "N/A"

        conditions_list = (user_profile and user_profile.get("conditions")) or []
        if not conditions_list and pat_record:
            cond_docs = list(db.patient_conditions.find({"patient_id": pat_record.get("id", user_id)}, {"_id": 0, "condition_name": 1}))
            conditions_list = [c["condition_name"] for c in cond_docs if c.get("condition_name")]
        conditions_str = ", ".join(conditions_list) or "None listed"

        meds = (user_profile and user_profile.get("medications")) or []
        if not meds and pat_record:
            presc_docs = list(db.prescriptions.find({"patient_id": pat_record.get("id", user_id), "status": "active"}, {"_id": 0}))
            meds = [{"name": p.get("medication_name"), "dosage": p.get("dosage", "")} for p in presc_docs if p.get("medication_name")]

        meds_str = (
            ", ".join(
                f"{m['name']} ({m['dosage']})" if m.get("dosage") else m["name"]
                for m in meds
                if isinstance(m, dict) and m.get("name")
            )
            or "None listed"
        )

        context_parts.append(
            f"[PATIENT DEMOGRAPHICS & BIOMETRIC PROFILE]\n"
            f"Name: {full_name}\n"
            f"Age: {age} y/o, Gender: {gender}, Blood Group: {blood_group}\n"
            f"Height: {height_cm} cm, Weight: {weight_kg} kg, BMI: {bmi_val}\n"
            f"Active Diagnosed Conditions: {conditions_str}\n"
            f"Current Active Medications: {meds_str}"
        )

    # Inject longitudinal patient medical memory (Knowledge Graph)
    memory_block = symptom_tracker.format_medical_memory_block(user_id)
    if memory_block:
        context_parts.append(memory_block)

    # Inject live environment snapshot
    if env_snapshot:
        pollutants_str = ", ".join(
            f"{p['label']}: {p['value']} {p['unit']}"
            for p in env_snapshot.get("pollutants", [])
        )
        context_parts.append(
            f"[LIVE LOCAL ENVIRONMENT & AQI]\n"
            f"Location: {env_snapshot.get('locationName', 'Unknown')}\n"
            f"Temperature: {env_snapshot.get('tempC')}°C, Weather: {env_snapshot.get('condition')}\n"
            f"AQI: {env_snapshot.get('aqi')} ({env_snapshot.get('aqiCategory')})\n"
            f"Pollutants: {pollutants_str}"
        )

    # Inject RAG excerpts
    if context_chunks:
        context_text = "\n\n".join(chunk["text"] for chunk in context_chunks)
        context_parts.append(f"[MEDICAL RECORDS & RETRIEVAL EXCERPTS]\n{context_text}")

    context_block = "\n\n".join(context_parts) if context_parts else ""
    user_prompt = f"{context_block}\n\nClinical Query / Statement: {clean_content}" if context_block else clean_content

    # 5. Remote MedGemma Adapter Call with Fallback
    remote_reply = await call_remote_medgemma_adapter(adapter_key, user_prompt)
    if remote_reply:
        reply_text = remote_reply
        entities = {"symptoms": [], "medications": []}
    else:
        # Local / Cloud LLM with domain specialty preamble & 512-token budget guidance
        specialty_preamble = build_specialty_prompt_preamble(adapter_key)
        base_instructions = (
            "You are MedSys AI Clinical Platform, an advanced diagnostic copilot.\n"
            "Provide a clear, highly structured, evidence-grounded response in Markdown.\n"
            "Structure with Key Findings, Differentials/Interpretation, and Next Steps.\n"
            "Keep the response dense, high-yield, and strictly within 512 tokens."
        )
        system_instructions = specialty_preamble + base_instructions

        reply_text, entities = await asyncio.gather(
            model_router.generate_reply(user_prompt, system=system_instructions, images=body.images),
            model_router.extract_chat_entities(clean_content),
        )

    # 6. Interactive quick options and symptom tracking
    opts = await quick_options.generate_quick_options(clean_content, reply_text)

    today = _now()[:10]
    for symptom in entities.get("symptoms", []):
        try:
            normalized_symptom = await ai_graph_builder.normalize_symptom_name(symptom)
            await supermemory_client.log_symptom(normalized_symptom, today, user_id)
            symptom_tracker.update_symptom_state(user_id, normalized_symptom, status="active")
            asyncio.create_task(ai_graph_builder.compute_and_store_symptom_knowledge(normalized_symptom))
        except Exception:
            pass
    for medication in entities.get("medications", []):
        try:
            await supermemory_client.log_medication(medication["name"], medication["dosage"], today, user_id)
        except httpx.HTTPError:
            pass

    assistant_message = {
        "id": _new_id("m"),
        "sessionId": session_id,
        "role": "assistant",
        "content": reply_text,
        "createdAt": _now(),
        "adapter_used": adapter_label,
        **({"quickOptions": opts} if opts else {}),
    }
    db.chat_messages.insert_one({**assistant_message})

    await _remember_message(session_id, "assistant", reply_text, user_id)

    update = {"updatedAt": _now()}
    if is_first_message:
        update["title"] = clean_content[:60]
    db.chat_sessions.update_one({"id": session_id}, {"$set": update})
    if is_first_message:
        asyncio.create_task(_refine_chat_title(db, session_id, clean_content, reply_text))

    return assistant_message


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, user_id: str = Depends(require_clerk_auth)) -> None:
    db = get_patient_db()
    result = db.chat_sessions.delete_one({"id": session_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.chat_messages.delete_many({"sessionId": session_id})


@router.get("/sources", response_model=list[ChatSource])
def get_sources(user_id: str = Depends(require_clerk_auth)) -> list[dict]:
    db = get_patient_db()
    docs = list(db.sources.find({"$or": [{"clerkUserId": user_id}, {"clerkUserId": {"$exists": False}}]}, {"_id": 0}).sort("uploadedAt", -1))
    return docs if docs else CHAT_SOURCES


@router.get("/sources/{source_id:path}/content")
def get_source_content(source_id: str) -> dict:
    db = get_patient_db()
    source = db.sources.find_one({"id": source_id}, {"_id": 0})
    if not source:
        mock = next((s for s in CHAT_SOURCES if s["id"] == source_id), None)
        if not mock:
            raise HTTPException(status_code=404, detail="Source not found")
        return {**mock, "content": mock["excerpt"]}

    if "content" in source:
        return source

    # Legacy sources stored before full content was kept separately — fall
    # back to stitching chunks together (may duplicate text at overlaps).
    chunks = db.chunks.find({"sourceId": source_id}, {"_id": 0}).sort("index", 1)
    content = "\n\n".join(chunk["text"] for chunk in chunks) or source["excerpt"]
    return {**source, "content": content}


@router.delete("/sources/{source_id:path}", status_code=204)
def delete_source(source_id: str, user_id: str = Depends(require_clerk_auth)) -> None:
    db = get_patient_db()
    source = db.sources.find_one({"id": source_id})
    if not source or source.get("clerkUserId") not in (user_id, None):
        raise HTTPException(status_code=404, detail="Source not found")
    db.sources.delete_one({"id": source_id})
    pinecone_client.delete_by_source(user_id, source_id)
    # Drop it from any chat session that had it selected for grounding, so
    # nothing references a source that no longer exists.
    db.chat_sessions.update_many({}, {"$pull": {"sourceIds": source_id}})


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)) -> dict:
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured — speech-to-text is offline.",
        )
    raw = await file.read()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (file.filename or "audio.webm", raw, file.content_type or "audio/webm")},
                data={"model": settings.groq_whisper_model},
            )
            res.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Transcription failed") from exc
    return {"text": res.json().get("text", "")}
