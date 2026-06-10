#!/bin/bash
# Payment Switch Platform - Kubernetes Deployment Script
# For production on-premise environments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
K8S_DIR="${PROJECT_ROOT}/payment-core/deployment/kubernetes"
K8S_BASE_DIR="${PROJECT_ROOT}/k8s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

NAMESPACE="${NAMESPACE:-payment-switch}"
DRY_RUN="${DRY_RUN:-false}"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    # Check Helm
    if ! command -v helm &> /dev/null; then
        log_warn "Helm is not installed. Some components may not deploy correctly."
    fi
    
    log_info "Prerequisites check passed."
    
    # Show cluster info
    log_info "Connected to cluster:"
    kubectl cluster-info | head -2
}

# Apply with optional dry-run
kubectl_apply() {
    local file="$1"
    local extra_args="${2:-}"
    
    if [ "$DRY_RUN" == "true" ]; then
        kubectl apply -f "$file" --dry-run=server $extra_args
    else
        kubectl apply -f "$file" $extra_args
    fi
}

# Create namespace
create_namespace() {
    log_step "Creating namespace: $NAMESPACE"
    
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespace
    kubectl label namespace "$NAMESPACE" \
        app.kubernetes.io/name=payment-switch \
        app.kubernetes.io/part-of=payment-switch \
        --overwrite
}

# Deploy network policies
deploy_network_policies() {
    log_step "Deploying network policies..."
    
    if [ -d "${K8S_BASE_DIR}/networkpolicies" ]; then
        for policy in "${K8S_BASE_DIR}/networkpolicies"/*.yaml; do
            if [ -f "$policy" ]; then
                log_info "Applying: $(basename $policy)"
                kubectl_apply "$policy" "-n $NAMESPACE"
            fi
        done
    fi
}

# Deploy encryption configs
deploy_encryption() {
    log_step "Deploying encryption configurations..."
    
    if [ -d "${K8S_BASE_DIR}/encryption" ]; then
        for config in "${K8S_BASE_DIR}/encryption"/*.yaml; do
            if [ -f "$config" ]; then
                log_info "Applying: $(basename $config)"
                kubectl_apply "$config" "-n $NAMESPACE"
            fi
        done
    fi
}

# Deploy infrastructure services
deploy_infrastructure() {
    log_step "Deploying infrastructure services..."
    
    # Kafka
    if [ -f "${K8S_DIR}/kafka-deployment.yaml" ]; then
        log_info "Deploying Kafka..."
        kubectl_apply "${K8S_DIR}/kafka-deployment.yaml" "-n $NAMESPACE"
    fi
    
    # Wait for Kafka to be ready
    if [ "$DRY_RUN" != "true" ]; then
        log_info "Waiting for Kafka to be ready..."
        kubectl wait --for=condition=available deployment/kafka -n "$NAMESPACE" --timeout=300s 2>/dev/null || true
    fi
}

# Deploy APISIX Gateway
deploy_apisix() {
    log_step "Deploying APISIX API Gateway..."
    
    # APISIX deployment
    if [ -f "${K8S_DIR}/apisix-deployment.yaml" ]; then
        kubectl_apply "${K8S_DIR}/apisix-deployment.yaml" "-n $NAMESPACE"
    fi
    
    # APISIX gateway config
    if [ -f "${K8S_DIR}/apisix-gateway.yaml" ]; then
        kubectl_apply "${K8S_DIR}/apisix-gateway.yaml" "-n $NAMESPACE"
    fi
    
    # APISIX routes
    if [ -f "${K8S_DIR}/apisix-routes.yaml" ]; then
        kubectl_apply "${K8S_DIR}/apisix-routes.yaml" "-n $NAMESPACE"
    fi
    
    # Additional routes
    if [ -f "${K8S_DIR}/apisix-additional-routes.yaml" ]; then
        kubectl_apply "${K8S_DIR}/apisix-additional-routes.yaml" "-n $NAMESPACE"
    fi
    
    # Security policies
    if [ -f "${K8S_DIR}/apisix-security-policies.yaml" ]; then
        kubectl_apply "${K8S_DIR}/apisix-security-policies.yaml" "-n $NAMESPACE"
    fi
    
    # Security headers plugin
    if [ -f "${K8S_BASE_DIR}/apisix/security-headers-plugin.yaml" ]; then
        kubectl_apply "${K8S_BASE_DIR}/apisix/security-headers-plugin.yaml" "-n $NAMESPACE"
    fi
}

# Deploy Mojaloop components
deploy_mojaloop() {
    log_step "Deploying Mojaloop components..."
    
    if [ -f "${K8S_DIR}/mojaloop-deployment.yaml" ]; then
        kubectl_apply "${K8S_DIR}/mojaloop-deployment.yaml" "-n $NAMESPACE"
    fi
    
    if [ -f "${K8S_DIR}/mojaloop-central-settlements.yaml" ]; then
        kubectl_apply "${K8S_DIR}/mojaloop-central-settlements.yaml" "-n $NAMESPACE"
    fi
    
    # Mojaloop directory
    if [ -d "${K8S_DIR}/mojaloop" ]; then
        for manifest in "${K8S_DIR}/mojaloop"/*.yaml; do
            if [ -f "$manifest" ]; then
                log_info "Applying: $(basename $manifest)"
                kubectl_apply "$manifest" "-n $NAMESPACE"
            fi
        done
    fi
}

# Deploy core services
deploy_core_services() {
    log_step "Deploying core services..."
    
    # Go Ledger Service
    if [ -f "${K8S_DIR}/go-ledger-service.yaml" ]; then
        log_info "Deploying Go Ledger Service..."
        kubectl_apply "${K8S_DIR}/go-ledger-service.yaml" "-n $NAMESPACE"
    fi
    
    # Fraud Detection Service
    if [ -f "${K8S_DIR}/fraud-detection-service.yaml" ]; then
        log_info "Deploying Fraud Detection Service..."
        kubectl_apply "${K8S_DIR}/fraud-detection-service.yaml" "-n $NAMESPACE"
    fi
    
    # Lakehouse deployments
    if [ -d "${K8S_DIR}/lakehouse" ]; then
        for manifest in "${K8S_DIR}/lakehouse"/*.yaml; do
            if [ -f "$manifest" ]; then
                log_info "Applying: $(basename $manifest)"
                kubectl_apply "$manifest" "-n $NAMESPACE"
            fi
        done
    fi
    
    # Data integration
    if [ -d "${K8S_DIR}/data-integration" ]; then
        for manifest in "${K8S_DIR}/data-integration"/*.yaml; do
            if [ -f "$manifest" ]; then
                log_info "Applying: $(basename $manifest)"
                kubectl_apply "$manifest" "-n $NAMESPACE"
            fi
        done
    fi
}

# Deploy service-specific deployments
deploy_services() {
    log_step "Deploying application services..."
    
    local service_dirs=(
        "advanced-analytics-service"
        "approval-workflow-service"
        "batch-processing-service"
        "biometric-auth"
        "corporate-onboarding-service"
        "erp-integration-service"
        "instant-settlement"
        "invoicing-service"
        "notification-service"
        "kafka-consumers"
        "integrations"
    )
    
    for service_dir in "${service_dirs[@]}"; do
        if [ -d "${K8S_DIR}/${service_dir}" ]; then
            log_info "Deploying ${service_dir}..."
            for manifest in "${K8S_DIR}/${service_dir}"/*.yaml; do
                if [ -f "$manifest" ]; then
                    kubectl_apply "$manifest" "-n $NAMESPACE"
                fi
            done
        fi
    done
}

# Deploy monitoring stack
deploy_monitoring() {
    log_step "Deploying monitoring stack..."
    
    if [ -d "${K8S_DIR}/monitoring" ]; then
        for manifest in "${K8S_DIR}/monitoring"/*.yaml; do
            if [ -f "$manifest" ]; then
                log_info "Applying: $(basename $manifest)"
                kubectl_apply "$manifest" "-n $NAMESPACE"
            fi
        done
    fi
}

# Deploy HA configurations
deploy_ha() {
    log_step "Deploying HA configurations..."
    
    if [ -f "${K8S_DIR}/ha-configurations.yaml" ]; then
        kubectl_apply "${K8S_DIR}/ha-configurations.yaml" "-n $NAMESPACE"
    fi
}

# Deploy canary configurations
deploy_canary() {
    log_step "Deploying canary configurations..."
    
    if [ -d "${K8S_DIR}/canary" ]; then
        for manifest in "${K8S_DIR}/canary"/*.yaml; do
            if [ -f "$manifest" ]; then
                log_info "Applying: $(basename $manifest)"
                kubectl_apply "$manifest" "-n $NAMESPACE"
            fi
        done
    fi
}

# Deploy external secrets
deploy_external_secrets() {
    log_step "Deploying external secrets configurations..."
    
    if [ -d "${K8S_DIR}/external-secrets" ]; then
        for manifest in "${K8S_DIR}/external-secrets"/*.yaml; do
            if [ -f "$manifest" ]; then
                log_info "Applying: $(basename $manifest)"
                kubectl_apply "$manifest" "-n $NAMESPACE"
            fi
        done
    fi
}

# Wait for deployments
wait_for_deployments() {
    if [ "$DRY_RUN" == "true" ]; then
        log_info "Dry run mode - skipping wait for deployments"
        return 0
    fi
    
    log_step "Waiting for deployments to be ready..."
    
    local deployments=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        log_info "Waiting for deployment: $deployment"
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=300s || true
    done
}

# Show deployment status
show_status() {
    log_step "Deployment Status"
    echo ""
    
    log_info "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo ""
    
    log_info "Services:"
    kubectl get services -n "$NAMESPACE"
    echo ""
    
    log_info "Deployments:"
    kubectl get deployments -n "$NAMESPACE"
    echo ""
    
    # Get ingress/load balancer IPs
    log_info "Ingress/LoadBalancer endpoints:"
    kubectl get ingress,svc -n "$NAMESPACE" -o wide | grep -E "LoadBalancer|Ingress" || echo "No external endpoints found"
}

# Main deployment
main() {
    echo "=============================================="
    echo "Payment Switch Platform - Kubernetes Deploy"
    echo "=============================================="
    echo ""
    
    if [ "$DRY_RUN" == "true" ]; then
        log_warn "Running in DRY RUN mode - no changes will be applied"
    fi
    
    check_prerequisites
    create_namespace
    deploy_network_policies
    deploy_encryption
    deploy_external_secrets
    deploy_infrastructure
    deploy_apisix
    deploy_mojaloop
    deploy_core_services
    deploy_services
    deploy_monitoring
    deploy_ha
    deploy_canary
    wait_for_deployments
    show_status
    
    echo ""
    log_info "Deployment complete!"
    echo ""
    echo "Run verification with: $SCRIPT_DIR/verify.sh"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            export DRY_RUN=true
            shift
            ;;
        --namespace|-n)
            export NAMESPACE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run           Run in dry-run mode (no changes applied)"
            echo "  --namespace, -n     Kubernetes namespace (default: payment-switch)"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
