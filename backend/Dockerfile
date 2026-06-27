# ═══════════════════════════════════════════════════════════════
# DocMind Backend — Multi-Stage Dockerfile
# Stage 1: Build  → install all Python packages
# Stage 2: Runtime → lean image, no build tools
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Builder ────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install C/C++ compiler only in builder stage
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY requirements.txt .

# Install into /install prefix so we can copy cleanly
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="Ashutosh Kumar <infoashu5173@gmail.com>"
LABEL description="DocMind — Enterprise RAG Q&A Backend"
LABEL version="1.0.0"

WORKDIR /app

# Install curl for health checks only
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY app/ app/

# Create persistent storage directories
RUN mkdir -p uploads vector_stores \
    && useradd -m -u 1001 docmind \
    && chown -R docmind:docmind /app

USER docmind

EXPOSE 8000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--access-log"]
