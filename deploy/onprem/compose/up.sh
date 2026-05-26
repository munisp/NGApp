#!/bin/bash
# Payment Switch Platform - Docker Compose Deployment Script
# For development/demo environments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.unified.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Validate environment variables
validate_env() {
    log_info "Validating environment configuration..."
    
    # Create .env from example if not exists
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${PROJECT_ROOT}/.env.example" ]; then
            log_warn ".env file not found. Creating from .env.example..."
            cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
        else
            log_warn ".env file not found. Creating with defaults..."
            cat > "$ENV_FILE" << 'EOF'
# Payment Switch Platform Environment Configuration
# IMPORTANT: Change these values for production!

# Database Configuration
DATABASE_NAME=payment_switch_portal
DATABASE_USER=portal_user
DATABASE_PASSWORD=portal_pass_2024_CHANGE_ME

# Redis Configuration
REDIS_PASSWORD=redis_pass_2024_CHANGE_ME

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-CHANGE-IN-PRODUCTION

# Grafana
GRAFANA_PASSWORD=admin_CHANGE_ME

# OAuth (optional)
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=

# App Configuration
VITE_APP_ID=payment-switch
VITE_APP_TITLE=Payment Switch Platform
VITE_APP_LOGO=

# External Services (optional)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=Payment Switch Platform
RESEND_API_KEY=
RESEND_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Built-in Services (optional)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=
EOF
        fi
    fi
    
    # Check for default passwords
    if grep -q "CHANGE_ME\|CHANGE-IN-PRODUCTION" "$ENV_FILE"; then
        log_warn "Default passwords detected in .env file!"
        log_warn "For production, please update all passwords marked with CHANGE_ME"
        
        if [ "${FORCE_DEPLOY:-false}" != "true" ]; then
            read -p "Continue with default passwords? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "Deployment cancelled. Please update .env file."
                exit 1
            fi
        fi
    fi
    
    log_info "Environment validation passed."
}

# Validate Docker Compose configuration
validate_compose() {
    log_info "Validating Docker Compose configuration..."
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Validate compose file
    if ! docker compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
        log_error "Docker Compose configuration is invalid:"
        docker compose -f "$COMPOSE_FILE" config
        exit 1
    fi
    
    log_info "Docker Compose configuration is valid."
}

# Pull images
pull_images() {
    log_info "Pulling Docker images..."
    docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures || true
    log_info "Image pull complete."
}

# Build custom images
build_images() {
    log_info "Building custom images..."
    docker compose -f "$COMPOSE_FILE" build --parallel
    log_info "Image build complete."
}

# Initialize TigerBeetle data file
init_tigerbeetle() {
    log_info "Initializing TigerBeetle data file..."
    
    TIGERBEETLE_DATA_DIR="${PROJECT_ROOT}/data/tigerbeetle"
    mkdir -p "$TIGERBEETLE_DATA_DIR"
    
    if [ ! -f "$TIGERBEETLE_DATA_DIR/0_0.tigerbeetle" ]; then
        docker run --rm -v "$TIGERBEETLE_DATA_DIR:/var/lib/tigerbeetle" \
            ghcr.io/tigerbeetle/tigerbeetle:latest \
            format --cluster=0 --replica=0 --replica-count=1 /var/lib/tigerbeetle/0_0.tigerbeetle
        log_info "TigerBeetle data file initialized."
    else
        log_info "TigerBeetle data file already exists."
    fi
}

# Start services
start_services() {
    log_info "Starting Payment Switch services..."
    
    # Start infrastructure services first
    log_info "Starting infrastructure services (databases, message broker)..."
    docker compose -f "$COMPOSE_FILE" up -d mysql postgres redis tigerbeetle zookeeper kafka
    
    # Wait for infrastructure to be healthy
    log_info "Waiting for infrastructure services to be healthy..."
    sleep 30
    
    # Start application services
    log_info "Starting application services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    log_info "All services started."
}

# Wait for services to be healthy
wait_for_health() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local unhealthy=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | jq -r 'select(.Health == "unhealthy" or .Health == "starting") | .Name' | wc -l)
        
        if [ "$unhealthy" -eq 0 ]; then
            log_info "All services are healthy!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 5
    done
    
    log_warn "Some services may not be fully healthy yet. Check with: docker compose ps"
    return 1
}

# Show service status
show_status() {
    log_info "Service Status:"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Access URLs:"
    echo "  - Web Portal:      http://localhost:3000"
    echo "  - API Gateway:     http://localhost:80"
    echo "  - Go Ledger API:   http://localhost:8080"
    echo "  - Fraud Detection: http://localhost:8081"
    echo "  - Data Pipeline:   http://localhost:8082"
    echo "  - Prometheus:      http://localhost:9090"
    echo "  - Grafana:         http://localhost:3001 (admin/admin)"
    echo "  - Adminer (MySQL): http://localhost:8090"
    echo "  - Redis Commander: http://localhost:8091"
}

# Main deployment
main() {
    echo "=============================================="
    echo "Payment Switch Platform - Docker Compose Deploy"
    echo "=============================================="
    echo ""
    
    check_prerequisites
    validate_env
    validate_compose
    
    if [ "${SKIP_PULL:-false}" != "true" ]; then
        pull_images
    fi
    
    if [ "${SKIP_BUILD:-false}" != "true" ]; then
        build_images
    fi
    
    init_tigerbeetle
    start_services
    wait_for_health
    show_status
    
    echo ""
    log_info "Deployment complete!"
    echo ""
    echo "Run smoke tests with: $SCRIPT_DIR/smoke-test.sh"
    echo "Stop services with:   $SCRIPT_DIR/down.sh"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-pull)
            export SKIP_PULL=true
            shift
            ;;
        --skip-build)
            export SKIP_BUILD=true
            shift
            ;;
        --force)
            export FORCE_DEPLOY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-pull   Skip pulling Docker images"
            echo "  --skip-build  Skip building custom images"
            echo "  --force       Force deployment with default passwords"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
