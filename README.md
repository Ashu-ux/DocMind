# 🧠 DocMind — Enterprise RAG Document Q&A System

> **Upload any corporate document and query it with natural language.**  
> Powered by **LangChain** · **FAISS** · **OpenAI GPT** · **FastAPI** · **Docker**

[![Python](https://img.shields.io/badge/Python-3.11-3776ab?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangChain](https://img.shields.io/badge/LangChain-0.2-1C3C3C)](https://langchain.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![CI](https://img.shields.io/github/actions/workflow/status/Ashu-ux/enterprise-rag-qa/ci.yml?label=CI&logo=githubactions&logoColor=white)](https://github.com/Ashu-ux/enterprise-rag-qa/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📸 Preview

> Professional black & white UI with document management, settings panel, session stats, and copy/export features.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DocMind / Enterprise RAG                        API Online  ● healthy  │
├──────────────────────────┬──────────────────────────────────────────────┤
│  UPLOAD                  │  quarterly_report.pdf · 42 chunks  Export  ✕ │
│  ┌────────────────────┐  ├──────────────────────────────────────────────┤
│  │   Drop file here   │  │                                              │
│  │   PDF · DOCX · TXT │  │  AK  Summarize the key findings             │
│  │   [  Browse  ]     │  │                                              │
│  └────────────────────┘  │  AI  The report highlights three areas:     │
│                          │      • Revenue grew 23% YoY…                │
│  DOCUMENTS               │      Sources: [report.pdf · p.4]  Copy      │
│  ▶ quarterly_report.pdf  │                                              │
│                          ├──────────────────────────────────────────────┤
│  ACTIVE DOCUMENT         │  Summarize  Key findings  Conclusions  …    │
│  File    report.pdf      │  ┌─────────────────────────────────────┐    │
│  Chunks  42              │  │  Ask a question…              0/2000 │ → │
│  Session 3fa85f64…       │  └─────────────────────────────────────┘    │
│                          │  Top-K: 5  ·  GPT-4o-mini                   │
│  SETTINGS                │                                              │
│  Top-K  ──●──────  5     └──────────────────────────────────────────────┘
│  Show Sources   [ON]
│
│  SESSION STATS
│   3 Queries   1 Docs
│  42 Chunks  1.2s Avg
└──────────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📁 **Multi-format Upload** | PDF, DOCX, TXT — drag-and-drop or file picker |
| 🔍 **Semantic Retrieval** | FAISS vector index for millisecond-speed similarity search |
| 🧠 **RAG Pipeline** | LangChain orchestrates context-aware Q&A with GPT-4o-mini |
| 📎 **Cited Answers** | Every AI response includes page + source references |
| ⚙️ **Configurable** | Top-K slider, Show Sources & Context toggles |
| 📊 **Session Stats** | Live counters — queries, chunks, avg response time |
| 📋 **Copy & Export** | Copy any answer or export full chat as `.txt` |
| ⌨️ **Keyboard Shortcuts** | `Ctrl+K`, `Ctrl+E`, `Ctrl+U` and more |
| 🐳 **Dockerized** | Single `docker-compose up` to run everything |
| 🔄 **CI/CD** | GitHub Actions — test → build → push to Docker Hub |

---

## 🚀 Quick Start

### Option A — Docker Compose *(Recommended)*

```bash
# 1. Clone the repository
git clone https://github.com/Ashu-ux/enterprise-rag-qa.git
cd enterprise-rag-qa

# 2. Create your environment file
cp .env.example .env
# ✏️  Open .env and set your OPENAI_API_KEY

# 3. Build and start all services
docker-compose up -d --build

# ✅  Frontend → http://localhost:3000
# ✅  API Docs → http://localhost:3000/docs
# ✅  Direct API → http://localhost:8000
```

### Option B — Local Development

```bash
# 1. Set up Python virtual environment
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env file in backend/
cp .env.example backend/.env
# ✏️  Set OPENAI_API_KEY in backend/.env

# 4. Run the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 5. Open the frontend
#    Open frontend/index.html in your browser
#    OR run: python -m http.server 3000 --directory frontend
```

> **Note for local dev:** Change `API_BASE = ''` → `API_BASE = 'http://localhost:8000'` in `frontend/js/app.js`

---

## 📡 API Reference

Base URL: `http://localhost:8000`  
Interactive Docs: `http://localhost:8000/docs`

### `GET /health`
```json
{ "status": "healthy", "model": "gpt-4o-mini", "version": "1.0.0" }
```

### `POST /api/documents/upload`
Upload a document and build its FAISS vector index.

| Field | Type | Description |
|-------|------|-------------|
| `file` | `File` | PDF, DOCX, or TXT — max 10 MB |

**Response `201`:**
```json
{
  "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "filename":   "report.pdf",
  "chunks_created": 42,
  "message":    "'report.pdf' processed and indexed successfully."
}
```

### `POST /api/query/`
Ask a question about an uploaded document.

**Request body:**
```json
{
  "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "question":   "Summarize the key findings.",
  "top_k":      5
}
```

**Response `200`:**
```json
{
  "answer":       "The report highlights three key findings: ...",
  "sources":      [{ "file": "report.pdf", "page": 4 }],
  "context_used": 5
}
```

### `DELETE /api/documents/{session_id}`
Remove a document and its FAISS index.

### `GET /api/documents/sessions`
List all active session IDs.

---

## 🗂️ Project Structure

```
enterprise-rag-qa/
├── 📁 backend/
│   ├── 📁 app/
│   │   ├── 📁 core/
│   │   │   └── config.py           ← Pydantic settings (env vars)
│   │   ├── 📁 routes/
│   │   │   ├── documents.py        ← Upload / delete / list endpoints
│   │   │   └── query.py            ← RAG Q&A endpoint
│   │   ├── 📁 services/
│   │   │   ├── document_processor.py  ← Load & chunk PDF/DOCX/TXT
│   │   │   ├── vector_store.py        ← FAISS index manager
│   │   │   └── rag_pipeline.py        ← LangChain + OpenAI generation
│   │   ├── dependencies.py         ← DI singletons
│   │   └── main.py                 ← FastAPI application entry point
│   ├── 📁 tests/
│   │   └── test_api.py             ← Unit tests (no API key needed)
│   ├── requirements.txt
│   ├── Dockerfile                  ← Multi-stage production build
│   └── .env.example
│
├── 📁 frontend/
│   ├── index.html                  ← Single-page application
│   ├── 📁 css/
│   │   └── style.css               ← Black & white design system
│   └── 📁 js/
│       └── app.js                  ← Upload, chat, settings, export
│
├── 📁 .github/
│   └── 📁 workflows/
│       └── ci.yml                  ← Test → Build → Push pipeline
│
├── docker-compose.yml              ← Backend + Frontend orchestration
├── nginx.conf                      ← Nginx: serves frontend + proxies API
├── .env.example                    ← Root-level environment template
├── .gitignore
├── LICENSE
└── README.md
```

---

## ⚙️ Configuration

All variables are set in `.env` (copied from `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | **required** | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | LLM for answer generation |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Model for chunk embeddings |
| `CHUNK_SIZE` | `1000` | Characters per document chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between adjacent chunks |
| `TOP_K_RESULTS` | `5` | Default chunks retrieved per query |
| `LLM_TEMPERATURE` | `0.1` | LLM creativity (0 = deterministic) |
| `MAX_FILE_SIZE_MB` | `10` | Maximum upload file size |
| `APP_ENV` | `development` | `development` or `production` |

---

## 🐳 Docker Commands

```bash
# Start all services (detached)
docker-compose up -d --build

# View logs
docker-compose logs -f

# View only backend logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Stop and delete volumes (clears all uploads & indexes)
docker-compose down -v

# Rebuild a single service
docker-compose up -d --build backend
```

---

## 🧪 Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Tests run **without** an OpenAI API key — they only validate the API structure and input/output contracts.

---

## 🔄 CI/CD Pipeline

| Job | Trigger | Steps |
|-----|---------|-------|
| 🧪 Test | All branches | Install → verify imports → pytest |
| 🐳 Build | After tests | Multi-stage Docker build + smoke test |
| 🚀 Push | `main` only | Push to Docker Hub (needs secrets) |

**Required GitHub Secrets** (Settings → Secrets → Actions):
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| API Framework | FastAPI + Uvicorn | 0.111 / 0.30 |
| RAG Orchestration | LangChain | 0.2 |
| Embeddings | OpenAI text-embedding-3-small | — |
| LLM | OpenAI gpt-4o-mini | — |
| Vector Database | FAISS CPU | 1.8 |
| Document Parsing | PyPDF, docx2txt | — |
| Containerization | Docker + Compose | — |
| Reverse Proxy | Nginx | 1.27 |
| CI/CD | GitHub Actions | — |
| Frontend | Vanilla HTML/CSS/JS | — |

---

## 📝 License

MIT License — see [LICENSE](LICENSE)

---

## 👤 Author

**Ashutosh Kumar** — LLM Engineer & Software Developer

[![GitHub](https://img.shields.io/badge/GitHub-Ashu--ux-181717?logo=github)](https://github.com/Ashu-ux)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-ashutoshhk22-0A66C2?logo=linkedin)](https://linkedin.com/in/ashutoshhk22)
[![LeetCode](https://img.shields.io/badge/LeetCode-ashutoshsingh7256-FFA116?logo=leetcode)](https://leetcode.com/u/ashutoshsingh7256)
