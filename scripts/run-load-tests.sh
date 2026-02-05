#!/bin/bash

################################################################################
# Load Testing Runner Script
# Runs comprehensive load tests using Locust
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
OCR_SERVICE_URL="${OCR_SERVICE_URL:-http://localhost:5010}"
VIDEO_LIVENESS_URL="${VIDEO_LIVENESS_URL:-http://localhost:5011}"
FACIAL_RECOGNITION_URL="${FACIAL_RECOGNITION_URL:-http://localhost:5009}"

USERS="${USERS:-100}"
SPAWN_RATE="${SPAWN_RATE:-10}"
RUN_TIME="${RUN_TIME:-5m}"
REPORT_DIR="/tmp/load-test-reports"

# Logging functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v python3 &> /dev/null; then
        log_error "python3 is not installed"
        exit 1
    fi
    
    if ! python3 -c "import locust" &> /dev/null; then
        log_warning "locust is not installed, installing..."
        pip3 install locust
    fi
    
    log_success "Prerequisites check passed"
}

# Create report directory
create_report_dir() {
    mkdir -p ${REPORT_DIR}
    log_info "Report directory: ${REPORT_DIR}"
}

# Run load tests
run_load_tests() {
    local test_name=$1
    local user_class=$2
    
    log_info "Running load test: ${test_name}"
    log_info "  Users: ${USERS}"
    log_info "  Spawn Rate: ${SPAWN_RATE}/sec"
    log_info "  Duration: ${RUN_TIME}"
    
    export API_BASE_URL
    export OCR_SERVICE_URL
    export VIDEO_LIVENESS_URL
    export FACIAL_RECOGNITION_URL
    
    locust \
        -f /home/ubuntu/fintech-mobile-app/scripts/load-test.py \
        ${user_class} \
        --headless \
        --users ${USERS} \
        --spawn-rate ${SPAWN_RATE} \
        --run-time ${RUN_TIME} \
        --html ${REPORT_DIR}/${test_name}-report.html \
        --csv ${REPORT_DIR}/${test_name} \
        --loglevel INFO
    
    log_success "Load test completed: ${test_name}"
}

# Run all tests
run_all_tests() {
    log_info "========================================="
    log_info "Running All Load Tests"
    log_info "========================================="
    
    # Test 1: OCR Service
    log_info "\n1. Testing OCR Service..."
    run_load_tests "ocr-service" "OCRLoadTest"
    
    # Test 2: Video Liveness Service
    log_info "\n2. Testing Video Liveness Service..."
    run_load_tests "video-liveness" "VideoLivenessLoadTest"
    
    # Test 3: Facial Recognition Service
    log_info "\n3. Testing Facial Recognition Service..."
    run_load_tests "facial-recognition" "FacialRecognitionLoadTest"
    
    # Test 4: Complete KYC Flow
    log_info "\n4. Testing Complete KYC Flow..."
    run_load_tests "kyc-flow" "KYCFlowLoadTest"
    
    # Test 5: Database Operations
    log_info "\n5. Testing Database Operations..."
    run_load_tests "database" "DatabaseLoadTest"
    
    log_success "\nAll load tests completed!"
}

# Generate summary report
generate_summary() {
    log_info "Generating summary report..."
    
    cat > ${REPORT_DIR}/summary.md <<EOF
# Load Test Summary Report

**Date:** $(date)
**Duration:** ${RUN_TIME}
**Concurrent Users:** ${USERS}
**Spawn Rate:** ${SPAWN_RATE}/sec

## Test Configuration

| Parameter | Value |
|-----------|-------|
| API Base URL | ${API_BASE_URL} |
| OCR Service URL | ${OCR_SERVICE_URL} |
| Video Liveness URL | ${VIDEO_LIVENESS_URL} |
| Facial Recognition URL | ${FACIAL_RECOGNITION_URL} |

## Test Results

### 1. OCR Service

See detailed report: [ocr-service-report.html](ocr-service-report.html)

**Metrics:**
- Total Requests: See CSV
- Response Time (P50): See CSV
- Response Time (P95): See CSV
- Response Time (P99): See CSV
- Failure Rate: See CSV

### 2. Video Liveness Service

See detailed report: [video-liveness-report.html](video-liveness-report.html)

**Metrics:**
- Total Requests: See CSV
- Response Time (P50): See CSV
- Response Time (P95): See CSV
- Response Time (P99): See CSV
- Failure Rate: See CSV

### 3. Facial Recognition Service

See detailed report: [facial-recognition-report.html](facial-recognition-report.html)

**Metrics:**
- Total Requests: See CSV
- Response Time (P50): See CSV
- Response Time (P95): See CSV
- Response Time (P99): See CSV
- Failure Rate: See CSV

### 4. Complete KYC Flow

See detailed report: [kyc-flow-report.html](kyc-flow-report.html)

**Metrics:**
- Total Submissions: See CSV
- Response Time (P50): See CSV
- Response Time (P95): See CSV
- Response Time (P99): See CSV
- Failure Rate: See CSV

### 5. Database Operations

See detailed report: [database-report.html](database-report.html)

**Metrics:**
- Total Queries: See CSV
- Response Time (P50): See CSV
- Response Time (P95): See CSV
- Response Time (P99): See CSV
- Failure Rate: See CSV

## Recommendations

Based on the load test results:

1. **Scaling Recommendations:**
   - If P95 response time > 2s: Increase replicas
   - If failure rate > 1%: Investigate errors
   - If CPU > 70%: Add more CPU resources
   - If Memory > 80%: Add more memory

2. **Performance Optimization:**
   - Enable caching for frequently accessed data
   - Optimize database queries
   - Use connection pooling
   - Enable compression

3. **Capacity Planning:**
   - Current capacity: ${USERS} concurrent users
   - Recommended production capacity: $((USERS * 2)) concurrent users
   - Peak capacity with autoscaling: $((USERS * 5)) concurrent users

## Next Steps

1. Review detailed HTML reports
2. Analyze CSV data for trends
3. Implement recommended optimizations
4. Re-run tests to validate improvements
5. Set up continuous load testing in CI/CD

---

**Generated by:** Load Testing Suite v1.0.0
**Report Location:** ${REPORT_DIR}
EOF
    
    log_success "Summary report generated: ${REPORT_DIR}/summary.md"
}

# Print summary
print_summary() {
    log_info "========================================="
    log_info "Load Test Summary"
    log_info "========================================="
    log_info "Report Directory: ${REPORT_DIR}"
    log_info ""
    log_info "Generated Reports:"
    log_info "  - ocr-service-report.html"
    log_info "  - video-liveness-report.html"
    log_info "  - facial-recognition-report.html"
    log_info "  - kyc-flow-report.html"
    log_info "  - database-report.html"
    log_info "  - summary.md"
    log_info ""
    log_info "CSV Data:"
    log_info "  - ocr-service_stats.csv"
    log_info "  - video-liveness_stats.csv"
    log_info "  - facial-recognition_stats.csv"
    log_info "  - kyc-flow_stats.csv"
    log_info "  - database_stats.csv"
    log_info "========================================="
    log_info ""
    log_info "To view reports:"
    log_info "  cd ${REPORT_DIR}"
    log_info "  python3 -m http.server 8000"
    log_info "  Open http://localhost:8000 in browser"
    log_info "========================================="
}

# Main function
main() {
    log_info "Load Testing Suite"
    log_info "=================="
    
    check_prerequisites
    create_report_dir
    run_all_tests
    generate_summary
    print_summary
    
    log_success "Load testing complete!"
}

# Show usage
show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Run comprehensive load tests for African Fintech Mobile App

OPTIONS:
  -h, --help              Show this help message
  -u, --users NUM         Number of concurrent users (default: 100)
  -r, --spawn-rate NUM    User spawn rate per second (default: 10)
  -t, --run-time TIME     Test duration (e.g., 5m, 1h) (default: 5m)
  -a, --api URL           API base URL (default: http://localhost:3000)
  -o, --ocr URL           OCR service URL (default: http://localhost:5010)
  -v, --video URL         Video liveness URL (default: http://localhost:5011)
  -f, --facial URL        Facial recognition URL (default: http://localhost:5009)

EXAMPLES:
  # Run with default settings
  $0

  # Run with 200 users for 10 minutes
  $0 --users 200 --run-time 10m

  # Run against staging environment
  $0 --api https://api-staging.example.com \\
     --ocr https://ocr-staging.example.com:5010 \\
     --video https://video-staging.example.com:5011 \\
     --facial https://facial-staging.example.com:5009

  # Run quick test with 50 users for 2 minutes
  $0 -u 50 -t 2m

ENVIRONMENT VARIABLES:
  API_BASE_URL            API server URL
  OCR_SERVICE_URL         OCR service URL
  VIDEO_LIVENESS_URL      Video liveness URL
  FACIAL_RECOGNITION_URL  Facial recognition URL
  USERS                   Number of concurrent users
  SPAWN_RATE              User spawn rate per second
  RUN_TIME                Test duration

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--users)
            USERS="$2"
            shift 2
            ;;
        -r|--spawn-rate)
            SPAWN_RATE="$2"
            shift 2
            ;;
        -t|--run-time)
            RUN_TIME="$2"
            shift 2
            ;;
        -a|--api)
            API_BASE_URL="$2"
            shift 2
            ;;
        -o|--ocr)
            OCR_SERVICE_URL="$2"
            shift 2
            ;;
        -v|--video)
            VIDEO_LIVENESS_URL="$2"
            shift 2
            ;;
        -f|--facial)
            FACIAL_RECOGNITION_URL="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main
