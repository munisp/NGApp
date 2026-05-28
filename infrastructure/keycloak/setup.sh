#!/usr/bin/env bash
# ── OG-RMM Keycloak + Permify Setup Script ────────────────────────────────────
#
# Usage: ./setup.sh [--reset]
#   --reset: Tear down existing containers and volumes before setup
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - .env file in this directory with required variables
#
# Environment variables (see .env.example):
#   KEYCLOAK_ADMIN_PASSWORD   Admin password for Keycloak (default: admin)
#   KEYCLOAK_DB_PASSWORD      PostgreSQL password for Keycloak DB (default: keycloak)
#   PERMIFY_DB_PASSWORD       PostgreSQL password for Permify DB (default: permify)
#   KEYCLOAK_HOSTNAME         Public hostname for Keycloak (default: localhost)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.keycloak.yml"
SCHEMA_FILE="$SCRIPT_DIR/../permify/og-rmm-schema.perm"

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
PERMIFY_URL="${PERMIFY_URL:-http://localhost:3476}"

# Load .env if present
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

log() { echo -e "\033[0;36m[setup]\033[0m $*"; }
ok()  { echo -e "\033[0;32m[  ok]\033[0m $*"; }
err() { echo -e "\033[0;31m[ err]\033[0m $*" >&2; }

wait_for_url() {
  local url="$1"
  local name="$2"
  local max_attempts="${3:-30}"
  local attempt=0
  log "Waiting for $name at $url..."
  until curl -sf "$url" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
      err "$name did not become ready in time"
      exit 1
    fi
    sleep 3
  done
  ok "$name is ready"
}

# ── Main ──────────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--reset" ]]; then
  log "Resetting existing containers and volumes..."
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
fi

log "Starting Keycloak + Permify stack..."
docker compose -f "$COMPOSE_FILE" up -d

# Wait for services to be ready
wait_for_url "$KEYCLOAK_URL/health/ready" "Keycloak" 40
wait_for_url "$PERMIFY_URL/healthz" "Permify" 20

# ── Upload Permify Schema ─────────────────────────────────────────────────────

log "Uploading Permify authorization schema..."

SCHEMA_CONTENT=$(cat "$SCHEMA_FILE")

RESPONSE=$(curl -sf -X POST \
  "$PERMIFY_URL/v1/tenants/t1/schemas/write" \
  -H "Content-Type: application/json" \
  -d "{\"schema\": $(echo "$SCHEMA_CONTENT" | jq -Rs .)}" \
  2>&1) || {
  err "Failed to upload Permify schema: $RESPONSE"
  err "You can upload it manually later using:"
  err "  curl -X POST $PERMIFY_URL/v1/tenants/t1/schemas/write -H 'Content-Type: application/json' -d '{\"schema\": \"...\"}'"
  exit 1
}

ok "Permify schema uploaded successfully"
echo "$RESPONSE" | jq '.schema_version // .' 2>/dev/null || echo "$RESPONSE"

# ── Verify Keycloak Realm Import ──────────────────────────────────────────────

log "Verifying Keycloak realm import..."
ADMIN_TOKEN=$(curl -sf -X POST \
  "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=${KEYCLOAK_ADMIN_PASSWORD:-admin}" \
  | jq -r '.access_token' 2>/dev/null) || {
  err "Failed to get Keycloak admin token"
  exit 1
}

REALM_CHECK=$(curl -sf \
  "$KEYCLOAK_URL/admin/realms/og-rmm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  2>/dev/null) || {
  err "og-rmm realm not found — importing manually..."
  curl -sf -X POST \
    "$KEYCLOAK_URL/admin/realms" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d @"$SCRIPT_DIR/og-rmm-realm.json"
  ok "Realm imported"
}

REALM_NAME=$(echo "$REALM_CHECK" | jq -r '.realm' 2>/dev/null)
if [[ "$REALM_NAME" == "og-rmm" ]]; then
  ok "Keycloak realm 'og-rmm' is active"
else
  err "Realm verification failed"
  exit 1
fi

# ── Print Connection Info ─────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          OG-RMM Identity & Authorization Stack Ready             ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Keycloak Admin UI:  $KEYCLOAK_URL/admin                        "
echo "║  Keycloak Realm:     $KEYCLOAK_URL/realms/og-rmm                "
echo "║  OIDC Discovery:     $KEYCLOAK_URL/realms/og-rmm/.well-known/openid-configuration"
echo "║  Permify HTTP API:   $PERMIFY_URL                               "
echo "║  Permify gRPC:       localhost:3478                              "
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Roles: admin | operator | viewer | auditor | contractor         ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Add to .env:                                                     ║"
echo "║    KEYCLOAK_ISSUER=$KEYCLOAK_URL/realms/og-rmm                  "
echo "║    PERMIFY_URL=$PERMIFY_URL                                      "
echo "║    PERMIFY_ENABLED=true                                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
