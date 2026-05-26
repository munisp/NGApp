#!/bin/bash
# Payment Switch Platform - Docker Compose Smoke Test Script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

TESTS_PASSED=0
TESTS_FAILED=0

# Test a health endpoint
test_health() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    
    echo -n "Testing $name... "
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    
    if [ "$response_code" == "$expected_code" ]; then
        log_pass "$name (HTTP $response_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_fail "$name (Expected HTTP $expected_code, got $response_code)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test database connectivity
test_database() {
    local name="$1"
    local container="$2"
    local command="$3"
    
    echo -n "Testing $name... "
    
    if docker exec "$container" sh -c "$command" > /dev/null 2>&1; then
        log_pass "$name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_fail "$name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test Kafka
test_kafka() {
    echo -n "Testing Kafka... "
    
    if docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
        log_pass "Kafka"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_fail "Kafka"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Main test suite
main() {
    echo "=============================================="
    echo "Payment Switch Platform - Smoke Tests"
    echo "=============================================="
    echo ""
    
    log_info "Running health endpoint tests..."
    echo ""
    
    # Web Portal
    test_health "Web Portal" "http://localhost:3000/api/health" || true
    
    # Go Ledger Service
    test_health "Go Ledger Service" "http://localhost:8080/health" || true
    
    # Fraud Detection Service
    test_health "Fraud Detection Service" "http://localhost:8081/health" || true
    
    # Data Pipeline Service
    test_health "Data Pipeline Service" "http://localhost:8082/health" || true
    
    # Prometheus
    test_health "Prometheus" "http://localhost:9090/-/healthy" || true
    
    # Grafana
    test_health "Grafana" "http://localhost:3001/api/health" || true
    
    # Adminer
    test_health "Adminer" "http://localhost:8090" || true
    
    # Redis Commander
    test_health "Redis Commander" "http://localhost:8091" || true
    
    echo ""
    log_info "Running database connectivity tests..."
    echo ""
    
    # MySQL
    test_database "MySQL" "web-checkout-mysql" "mysqladmin ping -h localhost -u root -proot_password_2024" || true
    
    # PostgreSQL
    test_database "PostgreSQL" "payment-core-postgres" "pg_isready -U payment_user -d payment_switch" || true
    
    # Redis
    test_database "Redis" "shared-redis" "redis-cli ping" || true
    
    echo ""
    log_info "Running message broker tests..."
    echo ""
    
    # Kafka
    test_kafka || true
    
    echo ""
    echo "=============================================="
    echo "Test Results"
    echo "=============================================="
    echo ""
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -gt 0 ]; then
        log_error "Some tests failed. Check the logs above for details."
        exit 1
    else
        log_info "All smoke tests passed!"
        exit 0
    fi
}

main
