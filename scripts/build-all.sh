#!/bin/bash
set -e

# ===========================================
# Build All Docker Images Script
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

REGISTRY="${REGISTRY:-registry.yourdomain.com}"
TAG="${TAG:-latest}"
PUSH="${PUSH:-false}"
PARALLEL="${PARALLEL:-4}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Service definitions: name:directory:dockerfile
SERVICES=(
    "customer-portal:customer-portal-full:docker/Dockerfile.react"
    "claims-adjudication:claims-adjudication-engine:Dockerfile"
    "policy-workflow:policy-workflow-go:Dockerfile"
    "kyc-orchestrator:kyc-kyb-system:Dockerfile"
    "fraud-detection:cross-company-fraud-database:Dockerfile"
    "communication-service:communication-service:Dockerfile"
    "geospatial-service:geospatial-service/go-service:Dockerfile"
    "telco-integration:telco-data-integration-service:Dockerfile"
    "erpnext-integration:erpnext-integration-service:Dockerfile"
    "openimis-integration:openimis-insurance-ops-integrated:Dockerfile"
    "etherisc-integration:etherisc-gif-enhanced:Dockerfile"
    "broker-api:broker-api-service/go-service:Dockerfile"
    "underwriting-service:underwriting-service:Dockerfile"
    "document-service:document-service:Dockerfile"
    "microinsurance-service:microinsurance-service:Dockerfile"
    "analytics-service:analytics-service:Dockerfile"
    "payment-service:payment-service:Dockerfile"
    "ussd-service:ussd-service:Dockerfile"
    "whatsapp-service:whatsapp-service:Dockerfile"
    "mobile-money-service:mobile-money-service:Dockerfile"
    "liveness-detection:liveness-detection-service:Dockerfile"
    "aml-screening:aml-screening-service:Dockerfile"
    "risk-scoring:risk-scoring-service:Dockerfile"
)

build_image() {
    local name=$1
    local dir=$2
    local dockerfile=$3
    
    local full_path="$PROJECT_ROOT/$dir"
    local image_name="$REGISTRY/insurance/$name:$TAG"
    
    if [ ! -d "$full_path" ]; then
        log_warning "Directory not found: $dir (skipping $name)"
        return 0
    fi
    
    local dockerfile_path="$full_path/$dockerfile"
    if [ ! -f "$dockerfile_path" ]; then
        # Try project-level docker directory
        dockerfile_path="$PROJECT_ROOT/$dockerfile"
        if [ ! -f "$dockerfile_path" ]; then
            log_warning "Dockerfile not found for $name (skipping)"
            return 0
        fi
    fi
    
    log_info "Building $name..."
    
    docker build \
        -t "$image_name" \
        -f "$dockerfile_path" \
        "$full_path" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VERSION="$TAG" \
        --label "org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --label "org.opencontainers.image.version=$TAG" \
        --label "org.opencontainers.image.title=$name"
    
    if [ "$PUSH" = "true" ]; then
        log_info "Pushing $name..."
        docker push "$image_name"
    fi
    
    log_success "Built $name"
}

build_all() {
    log_info "Building all Docker images..."
    log_info "Registry: $REGISTRY"
    log_info "Tag: $TAG"
    log_info "Push: $PUSH"
    echo ""
    
    local failed=()
    local success=()
    
    for service in "${SERVICES[@]}"; do
        IFS=':' read -r name dir dockerfile <<< "$service"
        
        if build_image "$name" "$dir" "$dockerfile"; then
            success+=("$name")
        else
            failed+=("$name")
        fi
    done
    
    echo ""
    log_info "Build Summary:"
    log_success "Successful: ${#success[@]}"
    
    if [ ${#failed[@]} -gt 0 ]; then
        log_error "Failed: ${#failed[@]}"
        for f in "${failed[@]}"; do
            log_error "  - $f"
        done
        exit 1
    fi
    
    log_success "All images built successfully!"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    -r, --registry      Docker registry URL [default: registry.yourdomain.com]
    -t, --tag           Image tag [default: latest]
    -p, --push          Push images after building
    -h, --help          Show this help message

Environment Variables:
    REGISTRY            Docker registry URL
    TAG                 Image tag
    PUSH                Push images (true/false)

Examples:
    $0 -r myregistry.com -t v1.0.0 -p
    REGISTRY=myregistry.com TAG=dev $0
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -p|--push)
            PUSH="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

build_all
