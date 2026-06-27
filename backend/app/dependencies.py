"""
Dependency injection — singleton services shared across requests.
"""
from app.core.config import settings
from app.services.rag_pipeline import RAGPipeline
from app.services.vector_store import VectorStoreManager

_vs_manager: VectorStoreManager | None = None
_rag_pipeline: RAGPipeline | None = None


def get_vector_store_manager() -> VectorStoreManager:
    global _vs_manager
    if _vs_manager is None:
        _vs_manager = VectorStoreManager(
            vector_store_dir=settings.VECTOR_STORE_DIR,
            api_key=settings.OPENAI_API_KEY,
            embedding_model=settings.EMBEDDING_MODEL,
        )
    return _vs_manager


def get_rag_pipeline() -> RAGPipeline:
    global _rag_pipeline
    if _rag_pipeline is None:
        _rag_pipeline = RAGPipeline(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            temperature=settings.LLM_TEMPERATURE,
        )
    return _rag_pipeline
