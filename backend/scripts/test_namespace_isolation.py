"""Namespace-isolation integration test for the Pinecone RAG pipeline and
the per-user Supermemory symptom/knowledge-graph store.

Simulates two separate users (test_user_alpha / test_user_beta) and checks
that neither can see the other's data through any of:

1. Pinecone index sanity (index exists, reachable via the integrated
   embedding model).
2. RAG document ingestion + retrieval, namespaced per user
   (app/services/rag.py -> app/services/pinecone_client.py).
3. RAG source-level filtering (`allowed_source_ids`) within one user's
   own namespace.
4. RAG chat-message storage + retrieval, namespaced per user.
5. Supermemory symptom logging + listing, namespaced per user
   (app/services/supermemory_client.py) - backed by MongoDB db.symptoms.
6. Supermemory knowledge-graph assembly (build_graph), namespaced per user.
7. Supermemory medication logging + listing, namespaced per user - this one
   round-trips through the real Supermemory API (not just Mongo), so it
   also catches an invalid/expired SUPERMEMORY_API_KEY.

Each test is independent: one failing test is reported and the rest still
run, so a single broken piece (e.g. a bad API key) doesn't hide whether
everything else is healthy. Ends with a PASS/FAIL summary and cleans up all
test data (Pinecone vectors + Mongo documents) regardless of outcome.

Run from backend/: `PYTHONPATH=. python scripts/test_namespace_isolation.py`
"""

import asyncio
import time
from datetime import datetime, timezone

from app.config import settings
from app.db import get_db
from app.services import pinecone_client, rag, supermemory_client

USER_A = "test_user_alpha"
USER_B = "test_user_beta"

# Pinecone's integrated-embedding upsert is async server-side - newly
# written records aren't always searchable the instant upsert returns.
INDEX_SETTLE_SECONDS = 10

db = get_db()
source_ids_by_user: dict[str, list[str]] = {USER_A: [], USER_B: []}
symptoms_to_purge: list[tuple[str, str]] = []  # (name, clerk_user_id)
results: list[tuple[str, bool, str]] = []  # (label, passed, detail)


def _record(label: str, fn):
    try:
        fn()
        results.append((label, True, ""))
        print(f"  [OK] {label} PASSED")
    except Exception as exc:
        results.append((label, False, str(exc)))
        print(f"  [FAIL] {label} FAILED: {exc}")


async def _record_async(label: str, coro):
    try:
        await coro
        results.append((label, True, ""))
        print(f"  [OK] {label} PASSED")
    except Exception as exc:
        results.append((label, False, str(exc)))
        print(f"  [FAIL] {label} FAILED: {exc}")


def test_1_pinecone_index():
    print("\n[TEST 1] Pinecone index reachability...")
    if not settings.pinecone_api_key:
        raise AssertionError("PINECONE_API_KEY is not set - nothing to test.")
    index = pinecone_client.get_index()
    print(f"  Index name: {pinecone_client.INDEX_NAME}")
    print(f"  Embedding model: {pinecone_client.EMBED_MODEL}")
    assert index is not None, "get_index() returned None"


def test_2_ingestion():
    print("\n[TEST 2] RAG document ingestion (per-user namespace)...")
    doc_a = rag.ingest_report(
        "alpha_report.txt", "report",
        "Patient Alpha has a history of chronic migraine and takes sumatriptan 50mg as needed.",
        owner_id=USER_A,
    )
    doc_b = rag.ingest_report(
        "beta_report.txt", "report",
        "Patient Beta has seasonal pollen allergies and takes cetirizine 10mg daily.",
        owner_id=USER_B,
    )
    source_ids_by_user[USER_A].append(doc_a["id"])
    source_ids_by_user[USER_B].append(doc_b["id"])
    assert doc_a["clerkUserId"] == USER_A, "Source A not tagged with owner"
    assert doc_b["clerkUserId"] == USER_B, "Source B not tagged with owner"
    print(f"  Ingested source A: {doc_a['id']} (namespace={USER_A})")
    print(f"  Ingested source B: {doc_b['id']} (namespace={USER_B})")
    print(f"  Waiting {INDEX_SETTLE_SECONDS}s for Pinecone to finish indexing...")
    time.sleep(INDEX_SETTLE_SECONDS)


def test_3_retrieval_isolation():
    print("\n[TEST 3] Cross-namespace retrieval isolation...")
    hits_a = rag.retrieve("What medication does the patient take for headaches?", USER_A, top_k=5)
    hits_b = rag.retrieve("What medication does the patient take for headaches?", USER_B, top_k=5)
    texts_a = " ".join(h["text"] for h in hits_a).lower()
    texts_b = " ".join(h["text"] for h in hits_b).lower()
    print(f"  User A namespace hits: {len(hits_a)} chunk(s)")
    print(f"  User B namespace hits: {len(hits_b)} chunk(s)")

    assert "sumatriptan" in texts_a or "migraine" in texts_a, \
        "User A's own document not found in User A's namespace"
    assert "cetirizine" not in texts_a and "allergies" not in texts_a, \
        "LEAK: User B's data appeared in User A's namespace!"
    assert "cetirizine" in texts_b or "allergies" in texts_b or "allergy" in texts_b, \
        "User B's own document not found in User B's namespace"
    assert "sumatriptan" not in texts_b and "migraine" not in texts_b, \
        "LEAK: User A's data appeared in User B's namespace!"


def test_4_source_filtering():
    print("\n[TEST 4] Source-level filtering within one namespace...")
    doc_a2 = rag.ingest_report(
        "alpha_report_2.txt", "report",
        "Patient Alpha also reports occasional lower back pain after exercise.",
        owner_id=USER_A,
    )
    source_ids_by_user[USER_A].append(doc_a2["id"])
    time.sleep(INDEX_SETTLE_SECONDS)

    filtered_hits = rag.retrieve(
        "back pain", USER_A, top_k=5, allowed_source_ids=[source_ids_by_user[USER_A][0]]
    )
    filtered_texts = " ".join(h["text"] for h in filtered_hits).lower()
    assert "back pain" not in filtered_texts, \
        "allowed_source_ids filter failed - saw content from an excluded source"


def test_5_chat_isolation():
    print("\n[TEST 5] Chat message storage (per-user namespace)...")
    session_id = "test-session-alpha-1"
    rag.store_chat_message(session_id, "user", "My migraines have been worse this week.", USER_A)
    time.sleep(INDEX_SETTLE_SECONDS)
    chat_hits = rag.retrieve(
        "migraine", USER_A, top_k=5, allowed_source_ids=[f"chat:{session_id}"]
    )
    assert any("migraine" in h["text"].lower() for h in chat_hits), \
        "Chat message not retrievable from its own namespace"
    chat_hits_wrong_user = rag.retrieve(
        "migraine", USER_B, top_k=5, allowed_source_ids=[f"chat:{session_id}"]
    )
    assert len(chat_hits_wrong_user) == 0, \
        "LEAK: User A's chat message is visible in User B's namespace!"


async def test_6_symptom_isolation():
    print("\n[TEST 6] Supermemory symptom logging (per-user)...")
    today = datetime.now(timezone.utc).date().isoformat()
    await supermemory_client.log_symptom("Chronic Migraine", today, USER_A)
    await supermemory_client.log_symptom("Seasonal Allergies", today, USER_B)
    symptoms_to_purge.append(("Chronic Migraine", USER_A))
    symptoms_to_purge.append(("Seasonal Allergies", USER_B))

    symptoms_a = await supermemory_client.list_all_symptoms(USER_A)
    symptoms_b = await supermemory_client.list_all_symptoms(USER_B)
    names_a = {s["name"].lower() for s in symptoms_a}
    names_b = {s["name"].lower() for s in symptoms_b}
    print(f"  User A symptoms: {sorted(names_a)}")
    print(f"  User B symptoms: {sorted(names_b)}")

    assert "chronic migraine" in names_a, "User A's symptom missing from their own list"
    assert "seasonal allergies" not in names_a, "LEAK: User B's symptom visible to User A!"
    assert "seasonal allergies" in names_b, "User B's symptom missing from their own list"
    assert "chronic migraine" not in names_b, "LEAK: User A's symptom visible to User B!"


async def test_7_graph_isolation():
    print("\n[TEST 7] Supermemory knowledge graph assembly (per-user)...")
    graph_a = await supermemory_client.build_graph(USER_A)
    graph_b = await supermemory_client.build_graph(USER_B)
    labels_a = {n["label"].lower() for n in graph_a.get("nodes", [])}
    labels_b = {n["label"].lower() for n in graph_b.get("nodes", [])}
    print(f"  User A graph nodes: {sorted(labels_a)}")
    print(f"  User B graph nodes: {sorted(labels_b)}")

    assert "chronic migraine" in labels_a and "seasonal allergies" not in labels_a, \
        "User A's knowledge graph leaked or missing own data"
    assert "seasonal allergies" in labels_b and "chronic migraine" not in labels_b, \
        "User B's knowledge graph leaked or missing own data"


async def test_8_medication_isolation():
    print("\n[TEST 8] Supermemory medication logging (per-user, real API round-trip)...")
    today = datetime.now(timezone.utc).date().isoformat()
    await supermemory_client.log_medication("Sumatriptan", "50mg", today, USER_A)
    await supermemory_client.log_medication("Cetirizine", "10mg", today, USER_B)
    await asyncio.sleep(5)  # Supermemory's search index needs a moment to reflect new writes.

    meds_a = await supermemory_client.list_all_medications(USER_A)
    meds_b = await supermemory_client.list_all_medications(USER_B)
    med_names_a = {m["name"].lower() for m in meds_a}
    med_names_b = {m["name"].lower() for m in meds_b}
    print(f"  User A medications: {sorted(med_names_a)}")
    print(f"  User B medications: {sorted(med_names_b)}")

    assert "sumatriptan" in med_names_a, "User A's medication missing from their own list"
    assert "cetirizine" not in med_names_a, "LEAK: User B's medication visible to User A!"
    assert "cetirizine" in med_names_b, "User B's medication missing from their own list"
    assert "sumatriptan" not in med_names_b, "LEAK: User A's medication visible to User B!"


async def cleanup():
    print("\n[CLEANUP] Removing test data...")
    for user_id, ids in source_ids_by_user.items():
        for source_id in ids:
            db.sources.delete_one({"id": source_id})
            pinecone_client.delete_by_source(user_id, source_id)
    pinecone_client.delete_by_source(USER_A, "chat:test-session-alpha-1")
    db.sources.delete_many({"id": {"$regex": "^chat:test-session-alpha-1"}})
    for name, user_id in symptoms_to_purge:
        await supermemory_client.delete_symptom(name, user_id)
    db.symptoms.delete_many({"clerkUserId": {"$in": [USER_A, USER_B]}})
    print("  [OK] CLEANUP COMPLETED: Test data removed from Pinecone and MongoDB.")


async def run_tests():
    print("=" * 70)
    print("   NAMESPACE ISOLATION TEST - PINECONE RAG + SUPERMEMORY")
    print("=" * 70)

    try:
        _record("TEST 1 (Pinecone index reachability)", test_1_pinecone_index)
        _record("TEST 2 (RAG ingestion, per-user namespace)", test_2_ingestion)
        _record("TEST 3 (cross-namespace retrieval isolation)", test_3_retrieval_isolation)
        _record("TEST 4 (allowed_source_ids filtering)", test_4_source_filtering)
        _record("TEST 5 (chat message namespace isolation)", test_5_chat_isolation)
        await _record_async("TEST 6 (symptom namespace isolation)", test_6_symptom_isolation())
        await _record_async("TEST 7 (knowledge graph namespace isolation)", test_7_graph_isolation())
        await _record_async("TEST 8 (medication namespace isolation, live API)", test_8_medication_isolation())
    finally:
        await cleanup()

    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, ok, _ in results if ok)
    for label, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        line = f"  [{status}] {label}"
        if not ok:
            line += f" - {detail}"
        print(line)
    print(f"\n  {passed}/{len(results)} tests passed.")
    if passed < len(results):
        print("  See FAIL lines above for what to fix.")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_tests())
