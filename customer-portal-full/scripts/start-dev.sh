#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# NGApp Insurance Platform - Local Development Startup Script
# ══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./scripts/start-dev.sh              # Start portal + PostgreSQL only
#   ./scripts/start-dev.sh --all        # Start portal + all 33 microservices
#   ./scripts/start-dev.sh --pillar 1   # Start portal + Pillar 1 services
#
# Prerequisites:
#   - Node.js 20+, pnpm
#   - PostgreSQL running on localhost:5432 (or via Docker)
#   - Go 1.21+ (for Go microservices)
#   - Python 3.11+ (for Python microservices)
#   - Rust/Cargo (for Rust microservices)

set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[NGApp]${NC} $*"; }
warn() { echo -e "${YELLOW}[NGApp]${NC} $*"; }
err()  { echo -e "${RED}[NGApp]${NC} $*"; }

# ── Check PostgreSQL ──────────────────────────────────────────────────────────
check_postgres() {
  if pg_isready -h localhost -p 5432 -U ngapp >/dev/null 2>&1; then
    log "PostgreSQL is running"
    return 0
  fi

  warn "PostgreSQL not running. Starting via Docker..."
  if command -v docker >/dev/null 2>&1; then
    docker run -d \
      --name ngapp-postgres \
      -e POSTGRES_USER="${POSTGRES_USER:-ngapp}" \
      -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD env var}" \
      -e POSTGRES_DB="${POSTGRES_DB:-ngapp}" \
      -p 5432:5432 \
      postgres:16-alpine >/dev/null 2>&1 || true

    log "Waiting for PostgreSQL to be ready..."
    for i in $(seq 1 30); do
      if pg_isready -h localhost -p 5432 -U ngapp >/dev/null 2>&1; then
        log "PostgreSQL is ready"
        return 0
      fi
      sleep 1
    done
    err "PostgreSQL failed to start"
    return 1
  else
    err "PostgreSQL not running and Docker not available. Please start PostgreSQL manually."
    return 1
  fi
}

# ── Run Database Migrations ───────────────────────────────────────────────────
run_migrations() {
  log "Running database migrations..."
  npx drizzle-kit push --force 2>/dev/null || warn "Migration push skipped (may already be up to date)"
  
  log "Seeding database..."
  node server/seed.mjs 2>/dev/null || warn "Seed skipped (may already have data)"
}

# ── Start Portal ──────────────────────────────────────────────────────────────
start_portal() {
  log "Starting customer portal on port ${PORT:-5000}..."
  npx tsx server/index.ts &
  PORTAL_PID=$!
  log "Portal started (PID: $PORTAL_PID)"
}

# ── Start Go Microservice ────────────────────────────────────────────────────
start_go_service() {
  local dir=$1
  local name=$(basename "$dir")
  
  if [ ! -d "../$dir" ]; then
    warn "Skipping $name: directory not found"
    return
  fi
  
  pushd "../$dir" >/dev/null
  if [ -f "go.mod" ] && [ -d "cmd/server" ]; then
    log "Starting $name..."
    go run ./cmd/server/ &
  elif [ -f "main.go" ]; then
    log "Starting $name..."
    go run main.go &
  else
    warn "Skipping $name: no Go entry point found"
  fi
  popd >/dev/null
}

# ── Start Python Microservice ────────────────────────────────────────────────
start_python_service() {
  local dir=$1
  local name=$(basename "$dir")
  
  if [ ! -d "../$dir" ]; then
    warn "Skipping $name: directory not found"
    return
  fi
  
  pushd "../$dir" >/dev/null
  if [ -f "app/main.py" ]; then
    log "Starting $name..."
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port "${2:-8000}" &
  else
    warn "Skipping $name: no Python entry point found"
  fi
  popd >/dev/null
}

# ── Start Rust Microservice ──────────────────────────────────────────────────
start_rust_service() {
  local dir=$1
  local name=$(basename "$dir")
  
  if [ ! -d "../$dir" ]; then
    warn "Skipping $name: directory not found"
    return
  fi
  
  pushd "../$dir" >/dev/null
  if [ -f "Cargo.toml" ]; then
    log "Starting $name..."
    cargo run --release &
  else
    warn "Skipping $name: no Cargo.toml found"
  fi
  popd >/dev/null
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  log "Shutting down all services..."
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null
  log "All services stopped"
}
trap cleanup EXIT INT TERM

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  local mode="${1:-portal}"
  
  log "══════════════════════════════════════════════════════"
  log "  NGApp Insurance Platform - Development Server"
  log "══════════════════════════════════════════════════════"
  echo ""
  
  check_postgres
  run_migrations
  start_portal
  
  case "$mode" in
    --all)
      log "Starting all 33 microservices..."
      # Pillar 1 - Go
      start_go_service "ussd-gateway"
      start_go_service "whatsapp-bot"
      start_go_service "mobile-money-service"
      start_go_service "agent-network-platform"
      # Pillar 2 - Go/Rust
      start_go_service "microinsurance-engine"
      start_rust_service "parametric-insurance-engine"
      start_go_service "product-builder"
      start_go_service "usage-based-insurance"
      start_go_service "takaful-module"
      # Pillar 3 - Python/Rust/Go
      start_python_service "ai-claims-engine" 8200
      start_python_service "ai-underwriting-engine" 8201
      start_rust_service "fraud-detection-neural"
      start_go_service "ai-chatbot"
      start_python_service "predictive-analytics" 8203
      # Pillar 4 - Go
      start_go_service "instant-payout-service"
      start_go_service "multi-currency-service"
      # Pillar 5 - Go/Python
      start_go_service "multi-country-regulatory"
      start_python_service "ifrs17-engine" 8210
      start_go_service "pan-african-ekyc"
      # Pillar 6 - Go
      start_go_service "multi-language-service"
      start_go_service "notification-service"
      start_go_service "gamification-service"
      # Pillar 7 - Python/Go
      start_python_service "lakehouse-analytics" 8211
      start_python_service "actuarial-platform" 8212
      start_go_service "api-marketplace"
      # Pillar 8 - Go/Rust
      start_go_service "multi-tenant-platform"
      start_go_service "dr-ha-service"
      start_rust_service "performance-gateway"
      start_go_service "devops-platform"
      ;;
    --pillar)
      local pillar="${2:-1}"
      log "Starting Pillar $pillar services..."
      case "$pillar" in
        1) start_go_service "ussd-gateway"; start_go_service "whatsapp-bot"; start_go_service "mobile-money-service"; start_go_service "agent-network-platform" ;;
        2) start_go_service "microinsurance-engine"; start_rust_service "parametric-insurance-engine"; start_go_service "product-builder"; start_go_service "usage-based-insurance"; start_go_service "takaful-module" ;;
        3) start_python_service "ai-claims-engine" 8200; start_python_service "ai-underwriting-engine" 8201; start_rust_service "fraud-detection-neural"; start_go_service "ai-chatbot"; start_python_service "predictive-analytics" 8203 ;;
        4) start_go_service "instant-payout-service"; start_go_service "multi-currency-service" ;;
        5) start_go_service "multi-country-regulatory"; start_python_service "ifrs17-engine" 8210; start_go_service "pan-african-ekyc" ;;
        6) start_go_service "multi-language-service"; start_go_service "notification-service"; start_go_service "gamification-service" ;;
        7) start_python_service "lakehouse-analytics" 8211; start_python_service "actuarial-platform" 8212; start_go_service "api-marketplace" ;;
        8) start_go_service "multi-tenant-platform"; start_go_service "dr-ha-service"; start_rust_service "performance-gateway"; start_go_service "devops-platform" ;;
        *) err "Unknown pillar: $pillar" ;;
      esac
      ;;
    *)
      log "Portal-only mode (no microservices)"
      log "Use --all to start all microservices, or --pillar N for a specific pillar"
      ;;
  esac
  
  echo ""
  log "══════════════════════════════════════════════════════"
  log "  Portal:  http://localhost:${PORT:-5000}"
  log "  tRPC:    http://localhost:${PORT:-5000}/api/trpc"
  log "══════════════════════════════════════════════════════"
  echo ""
  log "Press Ctrl+C to stop all services"
  
  wait
}

main "$@"
