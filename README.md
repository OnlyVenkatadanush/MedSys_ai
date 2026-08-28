![alt text](image.png)# MedSys AI

A personal health companion that grounds its answers in your own medical documents, builds a live symptom knowledge graph from every conversation, and helps you find nearby care — all behind your own authenticated account.

FastAPI + MongoDB backend, React + TypeScript frontend, and a choice of a fully local LLM (Ollama) or a cloud one (Groq) for every AI feature.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend setup](#backend-setup)
  - [Frontend setup](#frontend-setup)
  - [Running both](#running-both)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [How the knowledge graph works](#how-the-knowledge-graph-works)
- [Local vs. cloud models](#local-vs-cloud-models)

---

## Overview

MedSys AI is built around one idea: your medical history shouldn't live in scattered PDFs and half-remembered symptoms. Upload a report once, and the app extracts what matters and remembers it — permanently, and automatically. Mention a symptom in chat, and it's logged. Every screen reads from the same living record, not static placeholder data.

The app is a single-page React app behind [Clerk](https://clerk.com) authentication, talking to a FastAPI backend that owns all the AI orchestration, document processing, and data storage.

## Features

### 🏠 Home
- A **system status banner** (Stable / Moderate / Serious) computed live from your symptom knowledge graph — not a canned message, it names the actual symptoms involved and how close together they occurred.
- Live **weather + air quality** for your location, with a contextual health tip.
- An LLM-generated **general wellness tip** that regenerates on every visit.
- The **knowledge graph** itself, rendered as an interactive node/edge diagram — see below.

### 💬 Chat
- Multi-session chat grounded (RAG) on documents you select from My Data, so answers cite your actual records instead of generic advice.
- **Deep Search** — optional live web search (with full-page scraping via Firecrawl when configured) for questions your documents can't answer.
- **Voice input** via Whisper speech-to-text.
- Every message is scanned in the background for symptoms *and* medications you mention about yourself — these feed both the Home knowledge graph and your Profile, with zero extra effort from you.

### 📍 Find Care
- An interactive map (TomTom/MapLibre) of nearby hospitals, clinics, and diagnostic centers, filterable by specialty and distance.
- Accurate turn-by-turn directions via Google Maps, using your real captured location as the origin.
- A manual "click the map to set your location" override for when browser geolocation is inaccurate (common on desktop, which lacks GPS).

### 📄 My Data
- Upload PDFs or photos of reports, prescriptions, and consultation notes.
- The backend OCRs the document, writes a structured summary, and classifies it automatically.
- Delete anything you no longer want retained.

### 👤 Profile
- Personal details (age, weight, height, BMI, blood group, emergency contact) that you enter once and can edit anytime.
- **History and Medications are never hand-typed lists that go stale.** They're automatically assembled from every document you've ever uploaded *and* every mention in Chat, past and future — so the record grows on its own as you use the app.

## Tech stack

**Frontend**
- [React 19](https://react.dev/) + TypeScript, built with [Vite](https://vitejs.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Clerk](https://clerk.com/) for authentication
- [Framer Motion](https://www.framer.com/motion/) for animation
- [React Router](https://reactrouter.com/) for routing
- [TomTom Maps SDK](https://developer.tomtom.com/) (MapLibre GL) for Find Care
- `react-markdown` + `remark-gfm` for rendering chat responses

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- [MongoDB](https://www.mongodb.com/) via `pymongo`
- [Clerk](https://clerk.com/) session JWT verification (RS256, JWKS)
- `sentence-transformers` for local embeddings (RAG chunk retrieval)
- `pymupdf` for PDF rasterization / OCR pipeline
- `ddgs` (DuckDuckGo) + optional [Firecrawl](https://firecrawl.dev/) for web search

**AI / external services**
- **LLMs**: [Ollama](https://ollama.com/) (local, e.g. MedGemma) or [Groq Cloud](https://groq.com/) — configurable per deployment, with automatic fallback
- **[Supermemory](https://supermemory.ai/)** — backs the symptom knowledge graph and long-term chat memory
- **[OpenWeather](https://openweathermap.org/)** — live weather/AQI on Home
- **[TomTom](https://developer.tomtom.com/)** — maps on Find Care

## Project structure

```
MedsysAI/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, router registration, CORS
│   │   ├── config.py          # Settings loaded from .env
│   │   ├── db.py              # MongoDB connection
│   │   ├── models.py          # Pydantic request/response models
│   │   ├── routers/           # One module per API surface
│   │   │   ├── chat.py        # Sessions, messages, sources, transcription
│   │   │   ├── facilities.py  # Find Care
│   │   │   ├── health.py      # Health check + model status
│   │   │   ├── home.py        # Dashboard snapshot
│   │   │   ├── mydata.py      # Document upload/list/delete
│   │   │   ├── profile.py     # Profile CRUD + derived history
│   │   │   └── symptoms.py    # Manual symptom logging
│   │   └── services/          # Business logic, external API clients
│   │       ├── clerk_auth.py       # JWT verification
│   │       ├── model_router.py     # LLM provider routing (Ollama/Groq)
│   │       ├── ocr.py              # Document OCR (text + vision models)
│   │       ├── rag.py              # Chunking, retrieval, source ingestion
│   │       ├── supermemory_client.py  # Knowledge graph read/write
│   │       ├── weather.py          # OpenWeather integration
│   │       └── web_search.py       # Deep search (DuckDuckGo + Firecrawl)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/              # Home, Chat, FindCare, MyData, Profile, auth
        ├── components/         # Organized by page/feature
        ├── services/           # Typed API client functions (one per router)
        ├── types/              # Shared TypeScript types
        └── hooks/, lib/        # Utilities
```

## Getting started

### Prerequisites

- **Node.js** 20+
- **Python** 3.12+
- **MongoDB** running locally (or a connection string to a hosted instance)
- A **[Clerk](https://clerk.com/)** account (free tier is fine) — needed for both frontend and backend
- Optional, depending on which features you want live: an **Ollama** install with a chat + vision model pulled, or a **Groq** API key; API keys for OpenWeather, TomTom, Supermemory, Firecrawl

### Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
cp .env.example .env          # then fill in your keys — see below
```

Run it:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local    # then fill in your keys — see below
```

Run it:

```bash
npm run dev
```

### Running both

With MongoDB running, start the backend (port 8000) and the frontend (port 5173, Vite's default) in separate terminals. Open `http://localhost:5173`.

> **No backend configured?** Leave `VITE_API_BASE_URL` empty and the frontend runs entirely on mock data — useful for UI-only work.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB` | Yes | Database connection |
| `CLERK_SECRET_KEY` | Yes | Verifies session JWTs server-side |
| `CLERK_PUBLISHABLE_KEY` | Yes | Must match the frontend's key — the JWT issuer/JWKS host is derived from it |
| `OLLAMA_HOST`, `OLLAMA_MODEL`, `OLLAMA_VISION_MODEL` | No | Local model routing. If `OLLAMA_MODEL` is empty, falls back to Groq |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL`, `GROQ_WHISPER_MODEL` | No* | Cloud model fallback + speech-to-text. *Required if not running Ollama locally |
| `SUPERMEMORY_API_KEY`, `SUPERMEMORY_CONTAINER_TAG`, `SUPERMEMORY_CHAT_CONTAINER_TAG` | No | Powers the knowledge graph; without it the graph stays empty |
| `OPENWEATHER_API_KEY`, `LOCATION_NAME`, `LOCATION_LAT`, `LOCATION_LNG` | No | Live weather on Home; falls back to static demo data without it |
| `FIRECRAWL_API_KEY` | No | Full-page scraping for Deep Search; falls back to search snippets without it |
| `EMBEDDING_MODEL` | No | Local embedding model for RAG (default `all-MiniLM-L6-v2`) |
| `CORS_ORIGINS` | Yes | Comma-separated origins allowed to call the API |

See `backend/.env.example` for a fully-commented template.

### Frontend (`frontend/.env.local`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Gates the app behind sign-in |
| `VITE_API_BASE_URL` | No | Backend URL. Leave empty to run on mock data |
| `VITE_TOMTOM_API_KEY` | No | Live map on Find Care; falls back to a placeholder map without it |

## API overview

All routes except `/health` require a valid Clerk session JWT (`Authorization: Bearer <token>`).

| Router | Prefix | Responsibility |
|---|---|---|
| `health` | `/health` | Liveness + active model provider status |
| `home` | `/home` | Dashboard snapshot: status, weather, tips, knowledge graph |
| `chat` | `/chat` | Sessions, messages, source management, transcription |
| `facilities` | `/facilities` | Find Care listings |
| `profile` | `/profile` | Personal details + derived history/medications |
| `symptoms` | `/symptoms` | Manual symptom logging |
| `mydata` | `/mydata` | Document upload, listing, deletion |

## How the knowledge graph works

Every symptom or condition you report — whether typed manually on Home or mentioned naturally in Chat — is logged as a structured memory in Supermemory. On each Home load, every distinct symptom becomes a **node**, and every pair of symptoms is connected by an **edge** labeled with the number of days between their occurrences — a complete graph, not just nearest-neighbor links.

To keep sensitive health data from being visible at a glance, node and edge labels stay hidden by default; hovering (or tapping, on touch devices) a specific node or edge reveals just that one's details.

The Home status banner reads this same graph to classify your current state as **Stable**, **Moderate**, or **Serious** — driven by how tightly clustered your recent symptoms are in time, not a fixed rule.

## Local vs. cloud models

Every AI feature — chat replies, document OCR, symptom/medication extraction, report generation, wellness tips — routes through a single provider-selection function. Set `OLLAMA_MODEL` (and `OLLAMA_VISION_MODEL` for document OCR) to run entirely on a local model with no data leaving your machine; leave them unset to use Groq's cloud API instead. No other code needs to change to switch between the two.
