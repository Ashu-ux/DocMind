"""
DocMind — Enterprise RAG Q&A API
FastAPI application entry point
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.routes import documents, query

# ── Logging ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("docmind")


# ── Lifespan ───────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.VECTOR_STORE_DIR).mkdir(parents=True, exist_ok=True)
    logger.info("✅ DocMind RAG API started — model=%s embedding=%s",
                settings.OPENAI_MODEL, settings.EMBEDDING_MODEL)
    yield
    # ── Shutdown ──
    logger.info("🔴 DocMind RAG API shutting down")


# ── App ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DocMind — Enterprise RAG Q&A API",
    description=(
        "Upload PDF / DOCX / TXT documents and query them with "
        "natural-language questions using Retrieval-Augmented Generation. "
        "Powered by **LangChain**, **FAISS**, and **OpenAI**."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ────────────────────────────────────────────────────────────
app.include_router(documents.router)
app.include_router(query.router)


# ── Root endpoints ─────────────────────────────────────────────────────
@app.get("/", tags=["Health"], summary="API root")
def root():
    return {
        "service": "DocMind RAG Q&A API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health", tags=["Health"], summary="Health check")
def health():
    return {
        "status": "healthy",
        "model": settings.OPENAI_MODEL,
        "embedding": settings.EMBEDDING_MODEL,
        "version": "1.0.0",
    }
