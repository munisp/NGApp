#!/bin/bash
set -e

echo "=================================================="
echo "KYC/KYB System Kubernetes Deployment Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if kubectl is installed
print_info "Checking prerequisites..."
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

print_success "Prerequisites check passed"
echo ""

# Navigate to project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_DIR/kubernetes"
cd "$K8S_DIR"

print_info "Kubernetes manifests directory: $K8S_DIR"
echo ""

# Create namespace
print_info "Creating namespace..."
kubectl apply -f base/namespace.yaml
print_success "Namespace created"
echo ""

# Create secrets and configmaps
print_info "Creating secrets and configmaps..."
kubectl apply -f base/secrets.yaml
print_success "Secrets and configmaps created"
echo ""

# Deploy infrastructure services
print_info "Deploying infrastructure services (PostgreSQL, Redis, Kafka, Zookeeper)..."
kubectl apply -f base/deployments.yaml
kubectl apply -f base/services.yaml
print_success "Infrastructure services deployed"
echo ""

# Wait for PostgreSQL to be ready
print_info "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n kyc-kyb-system --timeout=300s
print_success "PostgreSQL is ready"
echo ""

# Wait for Keycloak to be ready
print_info "Waiting for Keycloak to be ready..."
kubectl wait --for=condition=ready pod -l app=keycloak -n kyc-kyb-system --timeout=300s
print_success "Keycloak is ready"
echo ""

# Wait for Permify to be ready
print_info "Waiting for Permify to be ready..."
kubectl wait --for=condition=ready pod -l app=permify -n kyc-kyb-system --timeout=300s
print_success "Permify is ready"
echo ""

# Initialize Keycloak and Permify
print_info "Initializing Keycloak and Permify..."
# Run initialization job
kubectl create job --from=cronjob/init-keycloak init-keycloak-manual -n kyc-kyb-system 2>/dev/null || true
kubectl create job --from=cronjob/init-permify init-permify-manual -n kyc-kyb-system 2>/dev/null || true
sleep 10
print_success "Initialization complete"
echo ""

# Wait for application services to be ready
print_info "Waiting for application services to be ready..."
kubectl wait --for=condition=ready pod -l app=document-verification -n kyc-kyb-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=liveness -n kyc-kyb-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=aml-screening -n kyc-kyb-system --timeout=300s
kubectl wait --for=condition=ready pod -l app=risk-scoring -n kyc-kyb-system --timeout=300s
print_success "Application services are ready"
echo ""

# Deploy ingress
print_info "Deploying ingress..."
kubectl apply -f base/ingress.yaml
print_success "Ingress deployed"
echo ""

# Display status
print_info "Checking deployment status..."
echo ""
kubectl get all -n kyc-kyb-system
echo ""

# Display access information
echo "=================================================="
echo "Deployment Complete!"
echo "=================================================="
echo ""
echo "To access services:"
echo "  kubectl port-forward -n kyc-kyb-system svc/keycloak-service 8080:8080"
echo "  kubectl port-forward -n kyc-kyb-system svc/document-verification-service 8001:8001"
echo "  kubectl port-forward -n kyc-kyb-system svc/liveness-service 8002:8002"
echo "  kubectl port-forward -n kyc-kyb-system svc/aml-screening-service 8003:8003"
echo "  kubectl port-forward -n kyc-kyb-system svc/risk-scoring-service 8004:8004"
echo ""
echo "To view logs:"
echo "  kubectl logs -f -l app=<service-name> -n kyc-kyb-system"
echo ""
echo "To scale services:"
echo "  kubectl scale deployment <deployment-name> --replicas=<count> -n kyc-kyb-system"
echo ""
echo "To delete deployment:"
echo "  kubectl delete namespace kyc-kyb-system"
echo ""
print_success "System is ready for use!"
