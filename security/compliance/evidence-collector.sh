#!/usr/bin/env bash
##############################################################################
# NEXCOM Exchange - Continuous Compliance Evidence Collector
# Collects evidence for SOC 2, ISO 27001, CBN, and NDPR compliance audits.
#
# Run daily via cron or Kubernetes CronJob to maintain continuous compliance.
#
# Usage:
#   ./evidence-collector.sh [output_dir]
##############################################################################

set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8000}"
VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
KUBECTL="${KUBECTL:-kubectl}"
NAMESPACE="${NAMESPACE:-nexcom-exchange}"
OUTPUT_DIR="${1:-/var/log/nexcom/compliance/$(date +%Y-%m-%d)}"

mkdir -p "$OUTPUT_DIR"

log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[$ts] COMPLIANCE: $*"
}

# ---- CC2: Audit Log Integrity ----
collect_audit_evidence() {
  log "Collecting audit log evidence (CC2, CC7)"

  # Verify hash chain integrity
  curl -sf "${GATEWAY_URL}/api/v1/security/audit-log" \
    -o "${OUTPUT_DIR}/audit-log-status.json" 2>/dev/null \
    && log "  Audit log status collected" \
    || log "  WARN: Could not collect audit log status"

  # Collect security dashboard (overall posture)
  curl -sf "${GATEWAY_URL}/api/v1/security/dashboard" \
    -o "${OUTPUT_DIR}/security-dashboard.json" 2>/dev/null \
    && log "  Security dashboard collected" \
    || log "  WARN: Could not collect security dashboard"
}

# ---- CC5: Access Controls ----
collect_access_evidence() {
  log "Collecting access control evidence (CC5, CC6)"

  # Active sessions
  curl -sf "${GATEWAY_URL}/api/v1/security/sessions" \
    -o "${OUTPUT_DIR}/active-sessions.json" 2>/dev/null \
    && log "  Active sessions collected" \
    || log "  WARN: Could not collect session data"

  # DDoS protection stats
  curl -sf "${GATEWAY_URL}/api/v1/security/ddos" \
    -o "${OUTPUT_DIR}/ddos-stats.json" 2>/dev/null \
    && log "  DDoS stats collected" \
    || log "  WARN: Could not collect DDoS stats"

  # Insider threat alerts
  curl -sf "${GATEWAY_URL}/api/v1/security/insider-alerts" \
    -o "${OUTPUT_DIR}/insider-alerts.json" 2>/dev/null \
    && log "  Insider alerts collected" \
    || log "  WARN: Could not collect insider alerts"
}

# ---- CC6.6: Encryption Evidence ----
collect_encryption_evidence() {
  log "Collecting encryption evidence (CC6.6)"

  # Vault status
  curl -sf "${GATEWAY_URL}/api/v1/security/vault" \
    -o "${OUTPUT_DIR}/vault-status.json" 2>/dev/null \
    && log "  Vault status collected" \
    || log "  WARN: Could not collect Vault status"

  # TLS certificate expiry check
  if command -v openssl &>/dev/null; then
    echo | openssl s_client -connect localhost:8200 -servername vault 2>/dev/null \
      | openssl x509 -noout -dates -subject 2>/dev/null \
      > "${OUTPUT_DIR}/tls-cert-info.txt" \
      || log "  WARN: Could not check TLS certificate"
  fi
}

# ---- CC7: Kubernetes Security Posture ----
collect_k8s_evidence() {
  log "Collecting Kubernetes security evidence (CC7, CC8)"

  # Network policies
  $KUBECTL get networkpolicies -n "$NAMESPACE" -o yaml \
    > "${OUTPUT_DIR}/network-policies.yaml" 2>/dev/null \
    && log "  Network policies collected" \
    || log "  WARN: kubectl not available"

  # Pod security contexts
  $KUBECTL get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext}{"\n"}{end}' \
    > "${OUTPUT_DIR}/pod-security-contexts.txt" 2>/dev/null \
    && log "  Pod security contexts collected" \
    || log "  WARN: Could not collect pod security contexts"

  # RBAC roles
  $KUBECTL get roles,rolebindings -n "$NAMESPACE" -o yaml \
    > "${OUTPUT_DIR}/rbac-roles.yaml" 2>/dev/null \
    && log "  RBAC roles collected" \
    || log "  WARN: Could not collect RBAC roles"
}

# ---- Generate compliance summary ----
generate_summary() {
  log "Generating compliance summary"

  cat > "${OUTPUT_DIR}/compliance-summary.json" <<EOF
{
  "collection_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform": "NEXCOM Exchange",
  "frameworks": ["SOC2", "ISO27001", "CBN", "NDPR", "GDPR"],
  "evidence_files": $(ls -1 "$OUTPUT_DIR" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip().split('\n')))" 2>/dev/null || echo '[]'),
  "controls_checked": {
    "CC2_audit_integrity": $([ -f "${OUTPUT_DIR}/audit-log-status.json" ] && echo "true" || echo "false"),
    "CC5_access_controls": $([ -f "${OUTPUT_DIR}/active-sessions.json" ] && echo "true" || echo "false"),
    "CC6_encryption": $([ -f "${OUTPUT_DIR}/vault-status.json" ] && echo "true" || echo "false"),
    "CC7_k8s_security": $([ -f "${OUTPUT_DIR}/network-policies.yaml" ] && echo "true" || echo "false"),
    "security_dashboard": $([ -f "${OUTPUT_DIR}/security-dashboard.json" ] && echo "true" || echo "false")
  }
}
EOF

  log "Compliance evidence collected to ${OUTPUT_DIR}"
  log "Files: $(ls -1 "$OUTPUT_DIR" | wc -l) evidence artifacts"
}

# ---- Main ----
main() {
  log "Starting compliance evidence collection"
  log "Output directory: ${OUTPUT_DIR}"

  collect_audit_evidence
  collect_access_evidence
  collect_encryption_evidence
  collect_k8s_evidence
  generate_summary

  log "Evidence collection complete"
}

main "$@"
