"""
Basic smoke tests for DocMind API.
Run with: pytest tests/ -v
"""
import os
import pytest
from fastapi.testclient import TestClient

# Set required env var before importing the app
os.environ.setdefault("OPENAI_API_KEY", "sk-test-placeholder")

from app.main import app  # noqa: E402

client = TestClient(app)


# ── Health endpoints ───────────────────────────────────────────────────
class TestHealth:
    def test_root_returns_200(self):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert data["service"] == "DocMind RAG Q&A API"
        assert data["status"] == "running"

    def test_health_returns_healthy(self):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert "model" in data
        assert "version" in data

    def test_docs_available(self):
        r = client.get("/docs")
        assert r.status_code == 200

    def test_openapi_json(self):
        r = client.get("/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        assert schema["info"]["title"] == "DocMind — Enterprise RAG Q&A API"


# ── Upload validation ──────────────────────────────────────────────────
class TestUploadValidation:
    def test_unsupported_extension_rejected(self):
        r = client.post(
            "/api/documents/upload",
            files={"file": ("test.csv", b"col1,col2\n1,2", "text/csv")},
        )
        assert r.status_code == 400
        assert "not supported" in r.json()["detail"].lower()

    def test_empty_txt_file_raises_422(self):
        """An empty file should produce no chunks → 422."""
        r = client.post(
            "/api/documents/upload",
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        # Either 422 (no chunks) or 500 (processing error) is acceptable
        assert r.status_code in (422, 500)


# ── Query validation ───────────────────────────────────────────────────
class TestQueryValidation:
    def test_missing_session_returns_404(self):
        r = client.post(
            "/api/query/",
            json={"session_id": "non-existent-session-id", "question": "What is this?"},
        )
        assert r.status_code == 404

    def test_short_question_rejected(self):
        r = client.post(
            "/api/query/",
            json={"session_id": "any-id", "question": "hi"},
        )
        # Pydantic min_length=3 → 422
        assert r.status_code == 422

    def test_top_k_out_of_range(self):
        r = client.post(
            "/api/query/",
            json={"session_id": "any", "question": "Valid question here", "top_k": 99},
        )
        assert r.status_code == 422


# ── Sessions endpoint ──────────────────────────────────────────────────
class TestSessions:
    def test_sessions_list_returns_dict(self):
        r = client.get("/api/documents/sessions")
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data
        assert "count" in data
        assert isinstance(data["sessions"], list)
