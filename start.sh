#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# DocMind — Quick Start Script (macOS / Linux)
# Usage: chmod +x start.sh && ./start.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; WHITE='\033[1;37m'; NC='\033[0m'

# ── Banner ───────────────────────────────────────────────────────
echo -e "${WHITE}"
echo "  ██████╗  ██████╗  ██████╗ ███╗   ███╗██╗███╗   ██╗██████╗ "
echo "  ██╔══██╗██╔═══██╗██╔════╝ ████╗ ████║██║████╗  ██║██╔══██╗"
echo "  ██║  ██║██║   ██║██║      ██╔████╔██║██║██╔██╗ ██║██║  ██║"
echo "  ██║  ██║██║   ██║██║      ██║╚██╔╝██║██║██║╚██╗██║██║  ██║"
echo "  ██████╔╝╚██████╔╝╚██████╗ ██║ ╚═╝ ██║██║██║ ╚████║██████╔╝"
echo "  ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝"
echo -e "${NC}"
echo -e "${CYAN}  Enterprise RAG Q&A System  v1.0.0${NC}"
echo "  ─────────────────────────────────────────────────────────────"
echo ""

# ── Check .env ───────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    echo -e "${RED}  [ERROR] .env file not found.${NC}"
    echo "  Run: cp .env.example .env && nano .env"
    echo "  Add your OPENAI_API_KEY and save."
    exit 1
fi

# ── Check OPENAI_API_KEY is set ───────────────────────────────────
if grep -qE '^OPENAI_API_KEY=sk-your' .env 2>/dev/null; then
    echo -e "${YELLOW}  [WARN] OPENAI_API_KEY still has placeholder value in .env${NC}"
    echo "  Please edit .env and set your real API key."
    exit 1
fi

# ── Check Docker ──────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo -e "${RED}  [ERROR] Docker not found. Install from https://docker.com${NC}"
    exit 1
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
    echo -e "${RED}  [ERROR] Docker Compose not found.${NC}"
    exit 1
fi

# Use 'docker compose' (v2) or 'docker-compose' (v1)
DC="docker compose"
command -v docker-compose &>/dev/null && DC="docker-compose"

# ── Build & Start ─────────────────────────────────────────────────
echo -e "  ${CYAN}[1/3] Building Docker images…${NC}"
$DC build

echo ""
echo -e "  ${CYAN}[2/3] Starting services…${NC}"
$DC up -d

echo ""
echo -e "  ${CYAN}[3/3] Waiting for health check (20s)…${NC}"
sleep 20

# ── Health check ─────────────────────────────────────────────────
if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    STATUS="${GREEN}✅ Online${NC}"
else
    STATUS="${YELLOW}⚠️  Starting up (may take a few more seconds)${NC}"
fi

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo -e "  API Status  →  ${STATUS}"
echo ""
echo -e "  ${GREEN}Frontend  →  http://localhost:3000${NC}"
echo -e "  ${GREEN}API Docs  →  http://localhost:3000/docs${NC}"
echo -e "  ${GREEN}Direct API→  http://localhost:8000${NC}"
echo ""
echo "  Commands:"
echo "    Stop        →  $DC down"
echo "    Logs        →  $DC logs -f"
echo "    Rebuild     →  $DC up -d --build"
echo "  ─────────────────────────────────────────────────────────────"
echo ""

# Auto-open browser (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3000"
fi
