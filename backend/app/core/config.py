"""
DocMind — Application Configuration
All settings are loaded from environment variables / .env file
"""
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── OpenAI ────────────────────────────────────────────────────────
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # ── RAG Pipeline ──────────────────────────────────────────────────
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    TOP_K_RESULTS: int = 5
    LLM_TEMPERATURE: float = 0.1

    # ── Storage ───────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    VECTOR_STORE_DIR: str = "vector_stores"

    # ── File Limits ───────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".txt"]

    # ── CORS ──────────────────────────────────────────────────────────
    # In production, replace with your actual frontend origin
    CORS_ORIGINS: List[str] = ["*"]

    # ── App Metadata ──────────────────────────────────────────────────
    APP_ENV: str = "development"  # development | production

    @property
    def max_file_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
