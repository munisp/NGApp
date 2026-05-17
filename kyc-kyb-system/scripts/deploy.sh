#!/bin/bash
set -e

echo "=================================================="
echo "KYC/KYB System Deployment Script"
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

# Check if Docker and Docker Compose are installed
print_info "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Prerequisites check passed"
echo ""

# Navigate to project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

print_info "Project directory: $PROJECT_DIR"
echo ""

# Stop existing containers
print_info "Stopping existing containers (if any)..."
docker-compose down -v 2>/dev/null || docker compose down -v 2>/dev/null || true
print_success "Existing containers stopped"
echo ""

# Build images
print_info "Building Docker images..."
docker-compose build --no-cache || docker compose build --no-cache
print_success "Docker images built successfully"
echo ""

# Start infrastructure services first
print_info "Starting infrastructure services (PostgreSQL, Redis, Kafka, Zookeeper)..."
docker-compose up -d postgres redis zookeeper kafka || docker compose up -d postgres redis zookeeper kafka
sleep 10
print_success "Infrastructure services started"
echo ""

# Wait for PostgreSQL to be ready
print_info "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U kyc_admin -d kyc_kyb_system > /dev/null 2>&1 || \
      docker compose exec -T postgres pg_isready -U kyc_admin -d kyc_kyb_system > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
print_success "PostgreSQL is ready"
echo ""

# Start Keycloak and Permify
print_info "Starting Keycloak and Permify..."
docker-compose up -d keycloak permify || docker compose up -d keycloak permify
sleep 20
print_success "Keycloak and Permify started"
echo ""

# Wait for Keycloak to be ready
print_info "Waiting for Keycloak to be ready..."
until curl -sf http://localhost:8080/health/ready > /dev/null 2>&1; do
  echo "Waiting for Keycloak..."
  sleep 5
done
print_success "Keycloak is ready"
echo ""

# Wait for Permify to be ready
print_info "Waiting for Permify to be ready..."
until curl -sf http://localhost:3476/healthz > /dev/null 2>&1; do
  echo "Waiting for Permify..."
  sleep 3
done
print_success "Permify is ready"
echo ""

# Run initialization
print_info "Running initialization service..."
docker-compose up init-service || docker compose up init-service
print_success "Initialization complete"
echo ""

# Start application services
print_info "Starting application services..."
docker-compose up -d document-verification-service liveness-service aml-screening-service risk-scoring-service || \
docker compose up -d document-verification-service liveness-service aml-screening-service risk-scoring-service
sleep 15
print_success "Application services started"
echo ""

# Start nginx
print_info "Starting nginx API gateway..."
docker-compose up -d nginx || docker compose up -d nginx
print_success "Nginx started"
echo ""

# Display status
print_info "Checking service status..."
echo ""
docker-compose ps || docker compose ps
echo ""

# Display access information
echo "=================================================="
echo "Deployment Complete!"
echo "=================================================="
echo ""
echo "Service URLs:"
echo "  Keycloak Admin:          http://localhost:8080"
echo "  Permify API:             http://localhost:3476"
echo "  Document Verification:   http://localhost:8001"
echo "  Liveness Service:        http://localhost:8002"
echo "  AML Screening:           http://localhost:8003"
echo "  Risk Scoring:            http://localhost:8004"
echo "  API Gateway (Nginx):     http://localhost:80"
echo ""
echo "Credentials:"
echo "  Keycloak Admin:"
echo "    Username: admin"
echo "    Password: admin_secure_password_2026"
echo ""
echo "  Test Users:"
echo "    admin / admin123"
echo "    compliance / compliance123"
echo "    kyc_analyst / kyc123"
echo "    risk_manager / risk123"
echo "    operator / operator123"
echo ""
echo "To view logs: docker-compose logs -f [service-name]"
echo "To stop: docker-compose down"
echo "To stop and remove volumes: docker-compose down -v"
echo ""
print_success "System is ready for use!"
