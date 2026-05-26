#!/usr/bin/env bash
# =============================================================================
# OG-RMM Platform — Production Rollback Script
# Spec: IEC 62443 §23.2 — Automated rollback on deployment failure
#
# Usage:
#   chmod +x scripts/rollback-production.sh
#   ./scripts/rollback-production.sh [--revision <N>]
# =============================================================================
set -euo pipefail

REVISION="${REVISION:-}"
ARGOCD_SERVER="${ARGOCD_SERVER:-argocd.og-rmm.internal}"
ARGOCD_AUTH_TOKEN="${ARGOCD_AUTH_TOKEN:-}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --revision) REVISION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

echo ""
echo "============================================================"
echo "  OG-RMM Platform — Production Rollback"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
echo ""

if command -v argocd &>/dev/null && [[ -n "$ARGOCD_AUTH_TOKEN" ]]; then
  if [[ -n "$REVISION" ]]; then
    echo "Rolling back to revision $REVISION..."
    argocd app rollback og-rmm-platform "$REVISION" \
      --server "$ARGOCD_SERVER" \
      --auth-token "$ARGOCD_AUTH_TOKEN"
  else
    echo "Rolling back to previous revision..."
    argocd app rollback og-rmm-platform \
      --server "$ARGOCD_SERVER" \
      --auth-token "$ARGOCD_AUTH_TOKEN"
  fi
  echo "Waiting for rollback to complete..."
  argocd app wait og-rmm-platform \
    --server "$ARGOCD_SERVER" \
    --auth-token "$ARGOCD_AUTH_TOKEN" \
    --health \
    --timeout 300
  echo "Rollback complete."
else
  echo "ArgoCD CLI not available. Manual rollback steps:"
  echo "  1. argocd app history og-rmm-platform"
  echo "  2. argocd app rollback og-rmm-platform <REVISION>"
  echo ""
  echo "Alternatively, use Helm:"
  echo "  helm history og-rmm-platform -n og-rmm"
  echo "  helm rollback og-rmm-platform <REVISION> -n og-rmm"
fi
