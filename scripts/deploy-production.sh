#!/usr/bin/env bash
# =============================================================================
# OG-RMM Platform — Production Deployment Script
# Spec: IEC 62443 §23.2 — GitOps-driven production deployment via ArgoCD
#
# Usage:
#   chmod +x scripts/deploy-production.sh
#   ./scripts/deploy-production.sh [--dry-run] [--region kuwait|uae|both]
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - ArgoCD CLI installed (argocd)
#   - Helm 3.x installed
#   - SPIRE server running (infra/spire/install-spire.sh)
# =============================================================================
set -euo pipefail

DRY_RUN=false
REGION="both"
ARGOCD_SERVER="${ARGOCD_SERVER:-argocd.og-rmm.internal}"
ARGOCD_AUTH_TOKEN="${ARGOCD_AUTH_TOKEN:-}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

KUBECTL="kubectl"
if [[ "$DRY_RUN" == "true" ]]; then
  KUBECTL="kubectl --dry-run=client"
  echo "[DRY-RUN] Dry run mode enabled — no changes will be applied"
fi

echo ""
echo "============================================================"
echo "  OG-RMM Platform — Production Deployment"
echo "  Region: $REGION | Dry-run: $DRY_RUN"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
echo ""

# ── Step 1: Run validation ────────────────────────────────────────────────────
echo "[1/8] Running pre-deployment validation..."
if ! ./scripts/validate-production.sh; then
  echo "ERROR: Validation failed. Aborting deployment."
  exit 1
fi

# ── Step 2: Build production bundle ──────────────────────────────────────────
echo "[2/8] Building production bundle..."
if [[ "$DRY_RUN" == "false" ]]; then
  pnpm build
  echo "  Build complete: dist/"
fi

# ── Step 3: Apply namespaces ──────────────────────────────────────────────────
echo "[3/8] Applying Kubernetes namespaces..."
$KUBECTL apply -f infra/k8s/namespaces/namespaces.yaml

# ── Step 4: Apply network policies ───────────────────────────────────────────
echo "[4/8] Applying network policies (IEC 62443 zone isolation)..."
$KUBECTL apply -f infra/k8s/network-policies/network-policies.yaml

# ── Step 5: Install/upgrade SPIRE ────────────────────────────────────────────
echo "[5/8] Installing SPIRE (SPIFFE workload identity — IEC 62443 SR 1.2)..."
if helm repo list | grep -q "spiffe"; then
  echo "  SPIFFE Helm repo already added"
else
  helm repo add spiffe https://spiffe.github.io/helm-charts-hardened/
  helm repo update
fi
if [[ "$DRY_RUN" == "false" ]]; then
  helm upgrade --install spire-server spiffe/spire \
    --namespace spire-system \
    --create-namespace \
    --values infra/spire/spire-server-values.yaml \
    --wait --timeout 5m
  # Apply SPIFFE registration entries
  kubectl apply -f infra/spire/registration-entries.yaml
  kubectl apply -f infra/spire/mtls-pod-annotations.yaml
fi

# ── Step 6: Install ArgoCD ────────────────────────────────────────────────────
echo "[6/8] Installing/verifying ArgoCD..."
if ! kubectl get namespace argocd &>/dev/null; then
  echo "  Creating argocd namespace..."
  kubectl create namespace argocd
  kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
  echo "  Waiting for ArgoCD to be ready..."
  kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd
fi

# ── Step 7: Apply ArgoCD project and application ──────────────────────────────
echo "[7/8] Applying ArgoCD manifests..."
$KUBECTL apply -f infra/argocd/platform-project.yaml
if [[ "$REGION" == "both" ]]; then
  $KUBECTL apply -f infra/argocd/platform-appset.yaml
elif [[ "$REGION" == "kuwait" ]]; then
  $KUBECTL apply -f infra/argocd/platform-production.yaml
elif [[ "$REGION" == "uae" ]]; then
  $KUBECTL apply -f infra/argocd/platform-production.yaml
fi

# ── Step 8: Trigger sync and wait ────────────────────────────────────────────
echo "[8/8] Triggering ArgoCD sync..."
if command -v argocd &>/dev/null && [[ -n "$ARGOCD_AUTH_TOKEN" ]]; then
  argocd app sync og-rmm-platform \
    --server "$ARGOCD_SERVER" \
    --auth-token "$ARGOCD_AUTH_TOKEN" \
    --prune \
    --force
  echo "  Waiting for sync to complete..."
  argocd app wait og-rmm-platform \
    --server "$ARGOCD_SERVER" \
    --auth-token "$ARGOCD_AUTH_TOKEN" \
    --health \
    --timeout 300
  echo "  ArgoCD sync complete"
else
  echo "  ArgoCD CLI not available or ARGOCD_AUTH_TOKEN not set"
  echo "  Manual sync: argocd app sync og-rmm-platform"
fi

echo ""
echo "============================================================"
echo "  Deployment complete!"
echo "  Platform URL: https://og-rmm.your-domain.com"
echo "  ArgoCD UI:    https://$ARGOCD_SERVER"
echo "============================================================"
echo ""
