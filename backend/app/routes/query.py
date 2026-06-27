"""
Query router — RAG-powered document Q&A endpoint.
Response shape is matched exactly to the DocMind frontend contract.
"""
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.dependencies import get_rag_pipeline, get_vector_store_manager
from app.services.rag_pipeline import RAGPipeline
from app.services.vector_store import VectorStoreManager

logger = logging.getLogger("docmind.query")
router = APIRouter(prefix="/api/query", tags=["Query"])


# ── Request / Response models ──────────────────────────────────────────
class QueryRequest(BaseModel):
    session_id: str = Field(
        ...,
        description="Session ID returned by /api/documents/upload",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    question: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Natural-language question about the document",
        examples=["Summarize the key findings of this report."],
    )
    top_k: Optional[int] = Field(
        None,
        ge=1,
        le=20,
        description="Number of document chunks to retrieve (1–20, default from config)",
    )


class SourceItem(BaseModel):
    file: str
    page: Optional[int] = None


class QueryResponse(BaseModel):
    """
    Frontend contract:
    { answer: string, sources: [{file, page?}], context_used: number }
    """
    answer: str
    sources: list[SourceItem]
    context_used: int


# ── POST /api/query/ ───────────────────────────────────────────────────
@router.post(
    "/",
    response_model=QueryResponse,
    summary="Query an uploaded document using RAG",
)
async def query_document(
    request: QueryRequest,
    vs_manager: VectorStoreManager = Depends(get_vector_store_manager),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline),
):
    """
    Retrieval-Augmented Generation pipeline:

    1. Embeds the question via OpenAI text-embedding-3-small.
    2. Runs FAISS similarity search → top-K most relevant chunks.
    3. Feeds chunks + question to GPT via LangChain prompt.
    4. Returns the generated answer with cited sources.

    **Frontend contract (response shape):**
    ```json
    { "answer": "...", "sources": [{"file": "...", "page": 3}], "context_used": 5 }
    ```
    """
    k = request.top_k or settings.TOP_K_RESULTS
    t_start = time.perf_counter()

    # ── Retrieve relevant chunks ──
    try:
        docs = vs_manager.similarity_search(
            session_id=request.session_id,
            query=request.question,
            k=k,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("Similarity search failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Vector search error: {exc}")

    if not docs:
        logger.info("No relevant docs found for session %s", request.session_id)
        return QueryResponse(
            answer="The provided document does not contain information relevant to your question.",
            sources=[],
            context_used=0,
        )

    # ── Generate answer via RAG ──
    try:
        result = rag_pipeline.query(request.question, docs)
    except Exception as exc:
        logger.exception("RAG generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Generation error: {exc}")

    elapsed_ms = round((time.perf_counter() - t_start) * 1000)
    logger.info(
        "Query OK | session=%s | k=%d | chunks=%d | %dms",
        request.session_id[:8], k, result["context_used"], elapsed_ms,
    )

    return QueryResponse(**result)
