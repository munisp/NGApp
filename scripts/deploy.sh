#!/bin/bash
set -e

# ===========================================
# Unified Insurance Platform Deployment Script
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
NAMESPACE="insurance-platform"
REGISTRY="registry.yourdomain.com"
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/.kube/config}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy          Deploy the platform to Kubernetes
    destroy         Remove the platform from Kubernetes
    status          Check deployment status
    logs            View logs for a service
    scale           Scale a service
    rollback        Rollback a deployment
    build           Build Docker images
    push            Push Docker images to registry

Options:
    -e, --environment   Environment (development|staging|production) [default: production]
    -n, --namespace     Kubernetes namespace [default: insurance-platform]
    -r, --registry      Docker registry URL [default: registry.yourdomain.com]
    -k, --kubeconfig    Path to kubeconfig file [default: ~/.kube/config]
    -h, --help          Show this help message

Examples:
    $0 deploy -e production
    $0 build -r myregistry.com
    $0 logs claims-adjudication
    $0 scale fraud-detection --replicas=5
EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=()
    
    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing+=("helm")
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
    
    if [ ! -f "$KUBECONFIG_PATH" ]; then
        log_error "Kubeconfig not found at $KUBECONFIG_PATH"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

create_namespaces() {
    log_info "Creating namespaces..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/base/namespace.yaml"
    
    log_success "Namespaces created"
}

deploy_storage_classes() {
    log_info "Deploying storage classes..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/base/storage-classes.yaml"
    
    log_success "Storage classes deployed"
}

deploy_secrets() {
    log_info "Deploying secrets..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/base/secrets.yaml"
    
    log_success "Secrets deployed"
}

deploy_configmaps() {
    log_info "Deploying ConfigMaps..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/base/configmap.yaml"
    
    log_success "ConfigMaps deployed"
}

deploy_network_policies() {
    log_info "Deploying network policies..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/base/network-policies.yaml"
    
    log_success "Network policies deployed"
}

deploy_middleware() {
    log_info "Deploying middleware services..."
    
    # Deploy PostgreSQL
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/postgresql.yaml"
    
    # Deploy Redis
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/redis.yaml"
    
    # Deploy Kafka
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/kafka.yaml"
    
    # Deploy Temporal
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/temporal.yaml"
    
    # Deploy TigerBeetle
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/tigerbeetle.yaml"
    
    # Deploy Iceberg Lakehouse
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/iceberg-lakehouse.yaml"
    
    # Deploy Dapr
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/dapr.yaml"
    
    # Deploy Fluvio
    kubectl apply -f "$PROJECT_ROOT/k8s/middleware/fluvio.yaml"
    
    log_success "Middleware services deployed"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/prometheus.yaml"
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/grafana.yaml"
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/jaeger.yaml"
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/loki.yaml"
    
    log_success "Monitoring stack deployed"
}

deploy_services() {
    log_info "Deploying application services..."
    
    for service_file in "$PROJECT_ROOT/k8s/base/services/"*.yaml; do
        log_info "Deploying $(basename "$service_file")..."
        kubectl apply -f "$service_file"
    done
    
    log_success "Application services deployed"
}

deploy_ingress() {
    log_info "Deploying ingress..."
    
    kubectl apply -f "$PROJECT_ROOT/k8s/ingress/ingress.yaml"
    
    log_success "Ingress deployed"
}

wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    kubectl wait --for=condition=available --timeout=600s deployment --all -n "$NAMESPACE" || true
    
    log_success "Deployments ready"
}

deploy_with_kustomize() {
    log_info "Deploying with Kustomize for $ENVIRONMENT environment..."
    
    kubectl apply -k "$PROJECT_ROOT/k8s/overlays/$ENVIRONMENT"
    
    log_success "Kustomize deployment complete"
}

deploy_with_helm() {
    log_info "Deploying with Helm for $ENVIRONMENT environment..."
    
    helm upgrade --install insurance-platform \
        "$PROJECT_ROOT/helm/insurance-platform" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values "$PROJECT_ROOT/helm/insurance-platform/values.yaml" \
        --set environment="$ENVIRONMENT" \
        --set global.imageRegistry="$REGISTRY" \
        --wait \
        --timeout 15m
    
    log_success "Helm deployment complete"
}

deploy() {
    log_info "Starting deployment to $ENVIRONMENT environment..."
    
    check_prerequisites
    create_namespaces
    deploy_storage_classes
    deploy_secrets
    deploy_configmaps
    deploy_network_policies
    deploy_middleware
    
    log_info "Waiting for middleware to be ready..."
    sleep 60
    
    deploy_monitoring
    deploy_services
    deploy_ingress
    wait_for_deployments
    
    log_success "Deployment complete!"
    
    # Show status
    status
}

destroy() {
    log_warning "This will delete all resources in namespace $NAMESPACE"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Destroying deployment..."
        
        kubectl delete namespace "$NAMESPACE" --ignore-not-found
        kubectl delete namespace middleware --ignore-not-found
        kubectl delete namespace monitoring --ignore-not-found
        kubectl delete namespace ingress --ignore-not-found
        
        log_success "Deployment destroyed"
    else
        log_info "Aborted"
    fi
}

status() {
    log_info "Deployment Status for $NAMESPACE"
    echo ""
    
    echo "=== Pods ==="
    kubectl get pods -n "$NAMESPACE" -o wide
    echo ""
    
    echo "=== Services ==="
    kubectl get services -n "$NAMESPACE"
    echo ""
    
    echo "=== Deployments ==="
    kubectl get deployments -n "$NAMESPACE"
    echo ""
    
    echo "=== HPAs ==="
    kubectl get hpa -n "$NAMESPACE"
    echo ""
    
    echo "=== Ingress ==="
    kubectl get ingress -n "$NAMESPACE"
}

logs() {
    local service=$1
    local follow=${2:-false}
    
    if [ -z "$service" ]; then
        log_error "Service name required"
        exit 1
    fi
    
    if [ "$follow" = "true" ] || [ "$follow" = "-f" ]; then
        kubectl logs -f -l app="$service" -n "$NAMESPACE" --all-containers
    else
        kubectl logs -l app="$service" -n "$NAMESPACE" --all-containers --tail=100
    fi
}

scale() {
    local service=$1
    local replicas=$2
    
    if [ -z "$service" ] || [ -z "$replicas" ]; then
        log_error "Service name and replicas required"
        exit 1
    fi
    
    log_info "Scaling $service to $replicas replicas..."
    kubectl scale deployment "$service" --replicas="$replicas" -n "$NAMESPACE"
    log_success "Scaled $service to $replicas replicas"
}

rollback() {
    local service=$1
    local revision=${2:-0}
    
    if [ -z "$service" ]; then
        log_error "Service name required"
        exit 1
    fi
    
    log_info "Rolling back $service..."
    
    if [ "$revision" -eq 0 ]; then
        kubectl rollout undo deployment "$service" -n "$NAMESPACE"
    else
        kubectl rollout undo deployment "$service" --to-revision="$revision" -n "$NAMESPACE"
    fi
    
    log_success "Rollback complete"
}

build_images() {
    log_info "Building Docker images..."
    
    local services=(
        "customer-portal:customer-portal-full"
        "claims-adjudication:claims-adjudication-engine"
        "policy-workflow:policy-workflow-go"
        "kyc-orchestrator:kyc-kyb-system"
        "fraud-detection:cross-company-fraud-database"
        "communication-service:communication-service"
        "geospatial-service:geospatial-service/go-service"
        "telco-integration:telco-data-integration-service"
        "erpnext-integration:erpnext-integration-service"
        "openimis-integration:openimis-insurance-ops-integrated"
        "etherisc-integration:etherisc-gif-enhanced"
        "broker-api:broker-api-service/go-service"
    )
    
    for service_pair in "${services[@]}"; do
        IFS=':' read -r image_name service_dir <<< "$service_pair"
        
        if [ -d "$PROJECT_ROOT/$service_dir" ]; then
            log_info "Building $image_name..."
            docker build -t "$REGISTRY/insurance/$image_name:latest" "$PROJECT_ROOT/$service_dir"
        else
            log_warning "Directory not found: $service_dir"
        fi
    done
    
    log_success "All images built"
}

push_images() {
    log_info "Pushing Docker images to $REGISTRY..."
    
    local images=(
        "customer-portal"
        "claims-adjudication"
        "policy-workflow"
        "kyc-orchestrator"
        "fraud-detection"
        "communication-service"
        "geospatial-service"
        "telco-integration"
        "erpnext-integration"
        "openimis-integration"
        "etherisc-integration"
        "broker-api"
    )
    
    for image in "${images[@]}"; do
        log_info "Pushing $image..."
        docker push "$REGISTRY/insurance/$image:latest"
    done
    
    log_success "All images pushed"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -k|--kubeconfig)
            KUBECONFIG_PATH="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        deploy|destroy|status|logs|scale|rollback|build|push)
            COMMAND="$1"
            shift
            break
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Export kubeconfig
export KUBECONFIG="$KUBECONFIG_PATH"

# Execute command
case $COMMAND in
    deploy)
        deploy
        ;;
    destroy)
        destroy
        ;;
    status)
        status
        ;;
    logs)
        logs "$@"
        ;;
    scale)
        scale "$@"
        ;;
    rollback)
        rollback "$@"
        ;;
    build)
        build_images
        ;;
    push)
        push_images
        ;;
    *)
        usage
        exit 1
        ;;
esac
