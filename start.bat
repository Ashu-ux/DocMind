@echo off
REM ═══════════════════════════════════════════════════════════════
REM  DocMind — Quick Start Script (Windows)
REM  Usage: Double-click or run from Command Prompt
REM ═══════════════════════════════════════════════════════════════

title DocMind - Enterprise RAG Q&A

echo.
echo  ██████╗  ██████╗  ██████╗ ███╗   ███╗██╗███╗   ██╗██████╗
echo  ██╔══██╗██╔═══██╗██╔════╝ ████╗ ████║██║████╗  ██║██╔══██╗
echo  ██║  ██║██║   ██║██║      ██╔████╔██║██║██╔██╗ ██║██║  ██║
echo  ██║  ██║██║   ██║██║      ██║╚██╔╝██║██║██║╚██╗██║██║  ██║
echo  ██████╔╝╚██████╔╝╚██████╗ ██║ ╚═╝ ██║██║██║ ╚████║██████╔╝
echo  ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝
echo.
echo  Enterprise RAG Q^&A System  v1.0.0
echo  ─────────────────────────────────────────────────────────────
echo.

REM ── Check for .env file ──────────────────────────────────────────
if not exist ".env" (
    echo  [ERROR] .env file not found!
    echo  Run: copy .env.example .env
    echo  Then edit .env and add your OPENAI_API_KEY
    echo.
    pause
    exit /b 1
)

REM ── Check for Docker ─────────────────────────────────────────────
docker --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker is not installed or not running.
    echo  Download Docker Desktop: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker Compose not found.
    pause
    exit /b 1
)

REM ── Start services ───────────────────────────────────────────────
echo  [1/3] Building Docker images...
docker-compose build --no-cache

echo.
echo  [2/3] Starting services...
docker-compose up -d

echo.
echo  [3/3] Waiting for health check...
timeout /t 10 /nobreak >nul

REM ── Status ───────────────────────────────────────────────────────
echo.
echo  ─────────────────────────────────────────────────────────────
echo  ✅  DocMind is running!
echo.
echo  Frontend  →  http://localhost:3000
echo  API Docs  →  http://localhost:3000/docs
echo  Direct API→  http://localhost:8000
echo  ─────────────────────────────────────────────────────────────
echo.
echo  To stop:  docker-compose down
echo  To view logs: docker-compose logs -f
echo.
start "" "http://localhost:3000"
pause
