#!/usr/bin/env bash
# ─── SPIRE Installation Script ────────────────────────────────────────────────
# Installs SPIFFE/SPIRE into the spire-system namespace.
# Spec: IEC 62443 SR 1.2 — Software process identification
#
# Prerequisites:
#   - kubectl configured for the target cluster
#   - helm 3.x installed
#   - SPIRE Controller Manager CRDs installed
#
# Usage:
#   chmod +x infra/spire/install-spire.sh
#   ./infra/spire/install-spire.sh [--dry-run]
set -euo pipefail

DRY_RUN="${1:-}"
NAMESPACE="spire-system"
RELEASE_NAME="spire"
CHART_REPO="https://spiffe.github.io/helm-charts"
CHART_VERSION="0.21.0"  # Pin to a specific version for reproducibility

echo "═══════════════════════════════════════════════════════════"
echo "  OG-RMM Platform — SPIFFE/SPIRE Installation"
echo "  Trust Domain: og-rmm.internal"
echo "  IEC 62443: SR 1.2 + SR 3.1"
echo "═══════════════════════════════════════════════════════════"

# ── Step 1: Add SPIFFE Helm repository ────────────────────────────────────────
echo "[1/5] Adding SPIFFE Helm repository..."
helm repo add spiffe "${CHART_REPO}" --force-update
helm repo update

# ── Step 2: Create namespace ──────────────────────────────────────────────────
echo "[2/5] Creating namespace ${NAMESPACE}..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace "${NAMESPACE}" \
  pod-security.kubernetes.io/enforce=restricted \
  og-rmm/component=security-infrastructure \
  --overwrite

# ── Step 3: Install SPIRE Controller Manager CRDs ─────────────────────────────
echo "[3/5] Installing SPIRE Controller Manager CRDs..."
kubectl apply -f https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterspiffeids.yaml
kubectl apply -f https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterfederatedtrustdomains.yaml

# ── Step 4: Install SPIRE ─────────────────────────────────────────────────────
echo "[4/5] Installing SPIRE ${CHART_VERSION}..."
HELM_CMD="helm upgrade --install ${RELEASE_NAME} spiffe/spire \
  --namespace ${NAMESPACE} \
  --version ${CHART_VERSION} \
  --values infra/spire/spire-server-values.yaml \
  --wait \
  --timeout 5m"

if [[ "${DRY_RUN}" == "--dry-run" ]]; then
  echo "[DRY RUN] Would execute: ${HELM_CMD}"
else
  eval "${HELM_CMD}"
fi

# ── Step 5: Apply SPIFFE ID registration entries ──────────────────────────────
echo "[5/5] Applying SPIFFE ID registration entries..."
if [[ "${DRY_RUN}" == "--dry-run" ]]; then
  echo "[DRY RUN] Would apply: infra/spire/registration-entries.yaml"
else
  kubectl apply -f infra/spire/registration-entries.yaml
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  SPIRE installation complete!"
echo ""
echo "  Verify SPIRE server health:"
echo "    kubectl -n ${NAMESPACE} exec spire-server-0 -- spire-server healthcheck"
echo ""
echo "  List registered entries:"
echo "    kubectl -n ${NAMESPACE} exec spire-server-0 -- spire-server entry show"
echo ""
echo "  Trust bundle (for peer validation):"
echo "    kubectl -n ${NAMESPACE} exec spire-server-0 -- spire-server bundle show"
echo "═══════════════════════════════════════════════════════════"
