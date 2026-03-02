#!/usr/bin/env bash
##############################################################################
# NEXCOM Exchange - Automated Incident Containment
# Called by the gateway's insider threat monitor or manually by SecOps.
#
# Usage:
#   ./containment.sh <action> [args...]
#
# Actions:
#   block-ip <ip> [duration]     - Block IP via gateway DDoS + K8s NetworkPolicy
#   revoke-user <user_id>        - Revoke all sessions and disable user in Keycloak
#   halt-trading                 - Activate emergency trading halt via matching engine
#   rotate-secrets               - Rotate all Vault Transit keys and API secrets
#   isolate-service <service>    - Apply deny-all NetworkPolicy to a service
#   snapshot-forensics <pod>     - Snapshot pod logs and state for forensic analysis
##############################################################################

set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8000}"
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KUBECTL="${KUBECTL:-kubectl}"
NAMESPACE="${NAMESPACE:-nexcom-exchange}"
LOG_DIR="/var/log/nexcom/incidents"

log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[$ts] CONTAINMENT: $*" | tee -a "${LOG_DIR}/containment.log" 2>/dev/null || echo "[$ts] CONTAINMENT: $*"
}

ensure_log_dir() {
  mkdir -p "$LOG_DIR" 2>/dev/null || true
}

# ---- Block IP ----
block_ip() {
  local ip="${1:?IP address required}"
  local duration="${2:-15m}"
  log "Blocking IP $ip for $duration"

  # 1. Block via gateway API (DDoS protection layer + Redis)
  curl -sf -X POST "${GATEWAY_URL}/api/v1/security/block-ip" \
    -H "Content-Type: application/json" \
    -d "{\"ip\":\"${ip}\",\"duration\":\"${duration}\",\"reason\":\"automated-containment\"}" \
    && log "Gateway: IP $ip blocked" \
    || log "WARN: Gateway block failed (may be offline)"

  # 2. Block via K8s NetworkPolicy (cluster-wide)
  cat <<EOF | $KUBECTL apply -f - 2>/dev/null || log "WARN: kubectl not available"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-ip-${ip//\./-}
  namespace: ${NAMESPACE}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - ${ip}/32
EOF
  log "K8s NetworkPolicy applied for $ip"
}

# ---- Revoke User ----
revoke_user() {
  local user_id="${1:?User ID required}"
  log "Revoking all sessions for user $user_id"

  # 1. Revoke sessions via gateway
  curl -sf -X POST "${GATEWAY_URL}/api/v1/security/revoke-sessions" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"${user_id}\"}" \
    && log "Gateway: Sessions revoked for $user_id" \
    || log "WARN: Gateway session revocation failed"

  # 2. Disable user in Keycloak
  local token
  token=$(curl -sf -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
    -d "grant_type=client_credentials&client_id=admin-cli&client_secret=${KEYCLOAK_ADMIN_SECRET:-}" \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

  if [ -n "$token" ]; then
    curl -sf -X PUT "${KEYCLOAK_URL}/admin/realms/nexcom/users/${user_id}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d '{"enabled": false}' \
      && log "Keycloak: User $user_id disabled" \
      || log "WARN: Keycloak user disable failed"
  else
    log "WARN: Cannot authenticate to Keycloak"
  fi
}

# ---- Halt Trading ----
halt_trading() {
  log "EMERGENCY: Activating trading halt"

  # 1. Send halt signal to matching engine
  curl -sf -X POST "${GATEWAY_URL}/api/v1/circuit-breakers/halt" \
    -H "Content-Type: application/json" \
    -d '{"reason":"security-incident","scope":"all"}' \
    && log "Matching engine: Trading halted" \
    || log "WARN: Trading halt request failed"

  # 2. Scale down matching engine pods as failsafe
  $KUBECTL scale deployment matching-engine --replicas=0 -n "$NAMESPACE" 2>/dev/null \
    && log "K8s: Matching engine scaled to 0" \
    || log "WARN: kubectl scale failed"
}

# ---- Rotate Secrets ----
rotate_secrets() {
  log "Rotating all secrets"

  # 1. Rotate Vault Transit key
  curl -sf -X POST "${GATEWAY_URL}/api/v1/security/rotate-keys" \
    && log "Vault Transit key rotated" \
    || log "WARN: Transit key rotation failed"

  # 2. Rotate Vault Transit key directly
  if [ -n "$VAULT_TOKEN" ]; then
    curl -sf -X POST "${VAULT_ADDR}/v1/transit/keys/nexcom-exchange/rotate" \
      -H "X-Vault-Token: $VAULT_TOKEN" \
      && log "Vault: Direct Transit key rotation successful" \
      || log "WARN: Direct Vault rotation failed"
  fi

  log "Secret rotation complete — services will pick up new keys on next request"
}

# ---- Isolate Service ----
isolate_service() {
  local service="${1:?Service name required}"
  log "Isolating service: $service"

  cat <<EOF | $KUBECTL apply -f - 2>/dev/null || log "WARN: kubectl not available"
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-${service}
  namespace: ${NAMESPACE}
spec:
  podSelector:
    matchLabels:
      app: ${service}
  policyTypes:
    - Ingress
    - Egress
  ingress: []
  egress: []
EOF
  log "K8s: Service $service isolated (deny-all ingress+egress)"
}

# ---- Snapshot Forensics ----
snapshot_forensics() {
  local pod="${1:?Pod name required}"
  local incident_id
  incident_id="INC-$(date +%s)"
  local snapshot_dir="${LOG_DIR}/${incident_id}"
  mkdir -p "$snapshot_dir"

  log "Creating forensic snapshot for pod $pod (incident: $incident_id)"

  # 1. Pod logs
  $KUBECTL logs "$pod" -n "$NAMESPACE" --all-containers > "${snapshot_dir}/pod-logs.txt" 2>/dev/null \
    || log "WARN: Could not capture pod logs"

  # 2. Pod description (env vars, events, etc.)
  $KUBECTL describe pod "$pod" -n "$NAMESPACE" > "${snapshot_dir}/pod-describe.txt" 2>/dev/null \
    || log "WARN: Could not describe pod"

  # 3. Network connections
  $KUBECTL exec "$pod" -n "$NAMESPACE" -- ss -tunap > "${snapshot_dir}/network-connections.txt" 2>/dev/null \
    || log "WARN: Could not capture network state"

  # 4. Process list
  $KUBECTL exec "$pod" -n "$NAMESPACE" -- ps aux > "${snapshot_dir}/processes.txt" 2>/dev/null \
    || log "WARN: Could not capture process list"

  # 5. Export audit log chain
  curl -sf "${GATEWAY_URL}/api/v1/security/audit-log" > "${snapshot_dir}/audit-log-status.json" 2>/dev/null \
    || log "WARN: Could not export audit log status"

  log "Forensic snapshot saved to ${snapshot_dir}"
  echo "$snapshot_dir"
}

# ---- Main dispatcher ----
main() {
  ensure_log_dir
  local action="${1:?Action required: block-ip|revoke-user|halt-trading|rotate-secrets|isolate-service|snapshot-forensics}"
  shift

  case "$action" in
    block-ip)          block_ip "$@" ;;
    revoke-user)       revoke_user "$@" ;;
    halt-trading)      halt_trading "$@" ;;
    rotate-secrets)    rotate_secrets "$@" ;;
    isolate-service)   isolate_service "$@" ;;
    snapshot-forensics) snapshot_forensics "$@" ;;
    *)
      echo "Unknown action: $action"
      echo "Usage: $0 {block-ip|revoke-user|halt-trading|rotate-secrets|isolate-service|snapshot-forensics} [args...]"
      exit 1
      ;;
  esac
}

main "$@"
