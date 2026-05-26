#!/bin/bash
# Payment Switch Platform - Kubernetes Prerequisites Bootstrap Script
# Installs and validates required tools for Kubernetes deployment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            OS="debian"
        elif [ -f /etc/redhat-release ]; then
            OS="redhat"
        else
            OS="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        OS="unknown"
    fi
    log_info "Detected OS: $OS"
}

# Install kubectl
install_kubectl() {
    if command -v kubectl &> /dev/null; then
        log_info "kubectl is already installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
        return 0
    fi
    
    log_info "Installing kubectl..."
    
    case $OS in
        debian)
            curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
            echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list
            sudo apt-get update
            sudo apt-get install -y kubectl
            ;;
        redhat)
            cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key
EOF
            sudo yum install -y kubectl
            ;;
        macos)
            brew install kubectl
            ;;
        *)
            curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
            chmod +x kubectl
            sudo mv kubectl /usr/local/bin/
            ;;
    esac
    
    log_info "kubectl installed successfully"
}

# Install Helm
install_helm() {
    if command -v helm &> /dev/null; then
        log_info "Helm is already installed: $(helm version --short)"
        return 0
    fi
    
    log_info "Installing Helm..."
    
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    
    log_info "Helm installed successfully"
}

# Install kustomize
install_kustomize() {
    if command -v kustomize &> /dev/null; then
        log_info "kustomize is already installed: $(kustomize version)"
        return 0
    fi
    
    log_info "Installing kustomize..."
    
    curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
    sudo mv kustomize /usr/local/bin/
    
    log_info "kustomize installed successfully"
}

# Install kubeval (for manifest validation)
install_kubeval() {
    if command -v kubeval &> /dev/null; then
        log_info "kubeval is already installed"
        return 0
    fi
    
    log_info "Installing kubeval..."
    
    local version="0.16.1"
    local os_name="linux"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        os_name="darwin"
    fi
    
    curl -L "https://github.com/instrumenta/kubeval/releases/download/v${version}/kubeval-${os_name}-amd64.tar.gz" | tar xz
    sudo mv kubeval /usr/local/bin/
    
    log_info "kubeval installed successfully"
}

# Validate cluster connectivity
validate_cluster() {
    log_info "Validating cluster connectivity..."
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        log_error "Please ensure:"
        log_error "  1. Your kubeconfig is properly configured (~/.kube/config)"
        log_error "  2. The cluster is running and accessible"
        log_error "  3. You have the correct credentials"
        return 1
    fi
    
    log_info "Cluster connectivity validated"
    kubectl cluster-info
    echo ""
    
    log_info "Cluster nodes:"
    kubectl get nodes
    echo ""
    
    log_info "Cluster version:"
    kubectl version
}

# Check required namespaces
check_namespaces() {
    log_info "Checking required namespaces..."
    
    local namespaces=("kube-system" "default")
    
    for ns in "${namespaces[@]}"; do
        if kubectl get namespace "$ns" &> /dev/null; then
            log_info "Namespace $ns exists"
        else
            log_warn "Namespace $ns not found"
        fi
    done
}

# Check storage classes
check_storage_classes() {
    log_info "Checking storage classes..."
    
    kubectl get storageclasses
    
    local default_sc=$(kubectl get storageclasses -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
    
    if [ -n "$default_sc" ]; then
        log_info "Default storage class: $default_sc"
    else
        log_warn "No default storage class found. You may need to create one."
    fi
}

# Check ingress controller
check_ingress() {
    log_info "Checking ingress controller..."
    
    if kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx &> /dev/null; then
        log_info "NGINX Ingress Controller found"
    elif kubectl get pods -n kube-system -l app=traefik &> /dev/null; then
        log_info "Traefik Ingress Controller found"
    else
        log_warn "No ingress controller found. You may need to install one."
        log_warn "For NGINX: helm upgrade --install ingress-nginx ingress-nginx --repo https://kubernetes.github.io/ingress-nginx --namespace ingress-nginx --create-namespace"
    fi
}

# Check metrics server
check_metrics() {
    log_info "Checking metrics server..."
    
    if kubectl top nodes &> /dev/null; then
        log_info "Metrics server is running"
    else
        log_warn "Metrics server not found. Resource monitoring will be limited."
        log_warn "Install with: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
    fi
}

# Summary
show_summary() {
    echo ""
    echo "=============================================="
    echo "Prerequisites Summary"
    echo "=============================================="
    echo ""
    
    echo "Tools:"
    echo "  kubectl:   $(command -v kubectl &> /dev/null && echo 'Installed' || echo 'Not installed')"
    echo "  helm:      $(command -v helm &> /dev/null && echo 'Installed' || echo 'Not installed')"
    echo "  kustomize: $(command -v kustomize &> /dev/null && echo 'Installed' || echo 'Not installed')"
    echo "  kubeval:   $(command -v kubeval &> /dev/null && echo 'Installed' || echo 'Not installed')"
    echo ""
    
    echo "Cluster:"
    if kubectl cluster-info &> /dev/null; then
        echo "  Status: Connected"
        echo "  Nodes:  $(kubectl get nodes --no-headers | wc -l)"
    else
        echo "  Status: Not connected"
    fi
    echo ""
}

# Main
main() {
    echo "=============================================="
    echo "Payment Switch Platform - Prerequisites Setup"
    echo "=============================================="
    echo ""
    
    detect_os
    
    install_kubectl
    install_helm
    install_kustomize
    install_kubeval
    
    echo ""
    
    if [ "${SKIP_VALIDATION:-false}" != "true" ]; then
        validate_cluster
        check_namespaces
        check_storage_classes
        check_ingress
        check_metrics
    fi
    
    show_summary
    
    log_info "Prerequisites setup complete!"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-validation)
            export SKIP_VALIDATION=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-validation  Skip cluster validation"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
