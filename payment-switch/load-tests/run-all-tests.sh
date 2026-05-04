#!/bin/bash

# Unified Payment Switch Platform - Load Test Runner
# Usage: ./run-all-tests.sh [environment]
# Example: ./run-all-tests.sh staging

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-local}
RESULTS_DIR="./results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Payment Switch Platform - Load Testing${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Results Directory: ${YELLOW}$RESULTS_DIR${NC}"
echo ""

# Load environment-specific configuration
case $ENVIRONMENT in
  local)
    BASE_URL="http://localhost:80"
    API_KEY="test_api_key"
    ;;
  staging)
    BASE_URL="${STAGING_URL:-https://staging.paymentswitch.com}"
    API_KEY="${STAGING_API_KEY}"
    ;;
  production)
    BASE_URL="${PRODUCTION_URL:-https://api.paymentswitch.com}"
    API_KEY="${PRODUCTION_API_KEY}"
    echo -e "${RED}WARNING: Running load tests against PRODUCTION${NC}"
    echo -e "${RED}Press Ctrl+C to cancel, or wait 10 seconds to continue...${NC}"
    sleep 10
    ;;
  *)
    echo -e "${RED}Unknown environment: $ENVIRONMENT${NC}"
    echo "Usage: $0 [local|staging|production]"
    exit 1
    ;;
esac

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Install k6: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if services are healthy
echo -e "${YELLOW}Checking service health...${NC}"
if curl -f -s "${BASE_URL}/health" > /dev/null; then
    echo -e "${GREEN}✓ Services are healthy${NC}"
else
    echo -e "${RED}✗ Services are not responding${NC}"
    echo "Please ensure all services are running"
    exit 1
fi

echo ""

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local duration=$3
    
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo -e "${YELLOW}Duration: ~$duration${NC}"
    echo -e "${YELLOW}========================================${NC}"
    
    local result_file="$RESULTS_DIR/${test_name// /_}.json"
    
    if k6 run \
        --env BASE_URL="$BASE_URL" \
        --env API_KEY="$API_KEY" \
        --out json="$result_file" \
        "$test_file"; then
        echo -e "${GREEN}✓ $test_name completed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        return 1
    fi
}

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Run tests
echo -e "${GREEN}Starting load tests...${NC}"
echo ""

# Test 1: Payment Processing
if run_test "Payment Processing Load Test" "payment-processing.js" "30 minutes"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

echo ""
sleep 5

# Test 2: Fraud Detection
if run_test "Fraud Detection Load Test" "fraud-detection.js" "25 minutes"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

echo ""
sleep 5

# Test 3: Web Portal API (if file exists)
if [ -f "web-portal-api.js" ]; then
    if run_test "Web Portal API Load Test" "web-portal-api.js" "20 minutes"; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    echo ""
    sleep 5
fi

# Test 4: End-to-End Integration (if file exists)
if [ -f "e2e-integration.js" ]; then
    if run_test "End-to-End Integration Test" "e2e-integration.js" "15 minutes"; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    echo ""
fi

# Generate summary report
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Results Directory: ${YELLOW}$RESULTS_DIR${NC}"
echo ""

# Create summary report
cat > "$RESULTS_DIR/summary.txt" << EOF
Payment Switch Platform - Load Test Summary
============================================

Environment: $ENVIRONMENT
Date: $(date)
Base URL: $BASE_URL

Test Results:
- Tests Passed: $TESTS_PASSED
- Tests Failed: $TESTS_FAILED

Results Location: $RESULTS_DIR

Next Steps:
1. Review detailed results in JSON files
2. Analyze metrics in Grafana dashboards
3. Check service logs for errors
4. Compare results with performance targets
5. Identify and address bottlenecks

Performance Targets:
- Payment Processing: 10,000 TPS, P95 <100ms
- Fraud Detection: 5,000 TPS, P95 <200ms
- Web Portal API: 1,000 RPS, P95 <300ms
- Overall Success Rate: >99%
EOF

echo -e "${GREEN}Summary report saved to: $RESULTS_DIR/summary.txt${NC}"
echo ""

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the results.${NC}"
    exit 1
fi
