import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services import ai_graph_builder, supermemory_client
from app.services.clerk_auth import require_clerk_auth

router = APIRouter(prefix="/symptoms", tags=["symptoms"])


class SymptomIn(BaseModel):
    name: str
    date: str


@router.get("")
async def list_symptoms(user_id: str = Depends(require_clerk_auth)) -> list[dict]:
    return await supermemory_client.list_all_symptoms(user_id)


@router.post("")
async def log_symptom(body: SymptomIn, user_id: str = Depends(require_clerk_auth)) -> dict:
    # STEP 1: Pass raw user input to LLM for clinical normalization
    normalized_name = await ai_graph_builder.normalize_symptom_name(body.name)

    # STEP 2: Store ONLY the LLM-normalized clinical term in MongoDB db.symptoms
    log_res = await supermemory_client.log_symptom(normalized_name, body.date, user_id)

    # STEP 3: Send normalized clinical term to LLM in background for Knowledge Graph enrichment (0ms HTTP delay)
    asyncio.create_task(ai_graph_builder.compute_and_store_symptom_knowledge(normalized_name))

    return {
        "status": "logged",
        "rawInput": body.name,
        "normalizedName": normalized_name,
        "frequency": log_res.get("frequency", 1),
    }


@router.delete("/{name}")
async def delete_symptom(name: str, user_id: str = Depends(require_clerk_auth)) -> dict:
    await supermemory_client.delete_symptom(name, user_id)
    await ai_graph_builder.delete_symptom_knowledge(name)
    return {"status": "deleted"}
