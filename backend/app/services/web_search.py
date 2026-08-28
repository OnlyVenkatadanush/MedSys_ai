"""Deep search: DuckDuckGo search + Firecrawl scrape, feeding results into
the vector store and Supermemory so the chat pipeline can ground answers on
fresh external content the same way it grounds on uploaded documents.

Triggered either by the user's "Deep Search" toggle, or by the model itself
choosing the web_search tool (see model_router.decide_web_search).
"""

import asyncio
import httpx

try:
    from duckduckgo_search import DDGS
except ImportError:
    try:
        from ddgs import DDGS
    except ImportError:
        DDGS = None

from app.config import settings
from app.services import rag, supermemory_client

FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape"
MAX_RESULTS = 5
MAX_SCRAPED = 3


def _ddg_search(query: str, max_results: int) -> list[dict]:
    if DDGS is None:
        return []
    try:
        return DDGS().text(query, max_results=max_results)
    except Exception:
        return []


async def _scrape(client: httpx.AsyncClient, url: str) -> str | None:
    if not settings.firecrawl_api_key:
        return None
    try:
        res = await client.post(
            FIRECRAWL_SCRAPE_URL,
            headers={"Authorization": f"Bearer {settings.firecrawl_api_key}"},
            json={"url": url, "formats": ["markdown"]},
            timeout=25.0,
        )
        res.raise_for_status()
        return res.json().get("data", {}).get("markdown")
    except httpx.HTTPError:
        return None


async def deep_search(query: str) -> list[dict]:
    """Searches the web, scrapes (or falls back to search snippets without a
    Firecrawl key), and stores every result for retrieval. Returns a compact
    {title, url} list for surfacing in the sources panel."""
    results = await asyncio.to_thread(_ddg_search, query, MAX_RESULTS)
    if not results:
        return []

    stored: list[dict] = []
    async with httpx.AsyncClient() as client:
        for result in results[:MAX_SCRAPED]:
            url = result.get("href")
            title = result.get("title") or url
            if not url:
                continue

            markdown = await _scrape(client, url)
            content = markdown or result.get("body", "")
            if not content.strip():
                continue

            rag.store_web_content(url, title, content)
            await supermemory_client.log_web_content(query, url, title, content)
            stored.append({"title": title, "url": url})

    return stored
