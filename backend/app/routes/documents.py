"""
Documents router — handles upload, delete, and session listing.
All responses are shaped exactly to match the DocMind frontend contract.
"""
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.dependencies import get_vector_store_manager
from app.services.document_processor import DocumentProcessor
from app.services.vector_store import VectorStoreManager

logger = logging.getLogger("docmind.documents")
router = APIRouter(prefix="/api/documents", tags=["Documents"])


# ── Helpers ────────────────────────────────────────────────────────────
def _allowed_ext(filename: str) -> bool:
    suffix = Path(filename).suffix.lower()
    return suffix in settings.ALLOWED_EXTENSIONS


# ── POST /api/documents/upload ─────────────────────────────────────────
@router.post(
    "/upload",
    summary="Upload a document and build its FAISS vector index",
    response_description="Session ID + processing metadata",
)
async def upload_document(
    file: UploadFile = File(..., description="PDF, DOCX, or TXT file — max 10 MB"),
    vs_manager: VectorStoreManager = Depends(get_vector_store_manager),
):
    """
    1. Validates file type and size.
    2. Saves the file to disk.
    3. Chunks the document text.
    4. Embeds chunks via OpenAI and stores them in a FAISS index.
    5. Returns a `session_id` used for all subsequent queries.

    **Frontend contract (response shape):**
    ```json
    { "session_id": "uuid", "filename": "report.pdf", "chunks_created": 42, "message": "..." }
    ```
    """
    # ── Validate extension ──
    if not _allowed_ext(file.filename):
        ext = Path(file.filename).suffix.lower()
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is not supported. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}",
        )

    # ── Read content & check size ──
    content = await file.read()
    if len(content) > settings.max_file_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit.",
        )

    session_id = str(uuid.uuid4())
    upload_path = Path(settings.UPLOAD_DIR) / session_id
    upload_path.mkdir(parents=True, exist_ok=True)
    file_path = upload_path / file.filename

    try:
        # ── Save file ──
        file_path.write_bytes(content)
        logger.info("Saved '%s' → %s", file.filename, file_path)

        # ── Process & chunk ──
        processor = DocumentProcessor(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )
        chunks = processor.process(str(file_path))

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail="No extractable text found. Make sure the file is not encrypted or empty.",
            )

        # ── Embed & index ──
        vs_manager.create_store(session_id, chunks)
        logger.info("Indexed %d chunks for session %s", len(chunks), session_id)

        # ── Response — matches frontend exactly ──
        return JSONResponse(
            status_code=201,
            content={
                "session_id": session_id,
                "filename": file.filename,
                "chunks_created": len(chunks),
                "message": f"'{file.filename}' processed and indexed successfully.",
            },
        )

    except HTTPException:
        shutil.rmtree(upload_path, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(upload_path, ignore_errors=True)
        logger.exception("Upload failed for '%s': %s", file.filename, exc)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")


# ── DELETE /api/documents/{session_id} ────────────────────────────────
@router.delete(
    "/{session_id}",
    summary="Delete a document and its FAISS index",
)
async def delete_document(
    session_id: str,
    vs_manager: VectorStoreManager = Depends(get_vector_store_manager),
):
    upload_path = Path(settings.UPLOAD_DIR) / session_id
    if upload_path.exists():
        shutil.rmtree(upload_path, ignore_errors=True)
    vs_manager.delete_store(session_id)
    logger.info("Deleted session %s", session_id)
    return {"message": "Document and index deleted successfully.", "session_id": session_id}


# ── GET /api/documents/sessions ───────────────────────────────────────
@router.get(
    "/sessions",
    summary="List all active document sessions",
)
async def list_sessions(
    vs_manager: VectorStoreManager = Depends(get_vector_store_manager),
):
    sessions = vs_manager.list_sessions()
    return {"sessions": sessions, "count": len(sessions)}
