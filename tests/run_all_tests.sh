#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Master Test Runner — Unified Insurance Platform
# Runs all test suites: regression, integration, security, performance, chaos, UX
# Usage: ./run_all_tests.sh [--env=staging|production] [--suite=all|regression|...]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${RESULTS_DIR}/test_run_${TIMESTAMP}.log"

# ── Parse Arguments ───────────────────────────────────────────────────────────
ENV="staging"
SUITE="all"
PARALLEL="false"
for arg in "$@"; do
  case $arg in
    --env=*) ENV="${arg#*=}" ;;
    --suite=*) SUITE="${arg#*=}" ;;
    --parallel) PARALLEL="true" ;;
  esac
done

# ── Environment Configuration ─────────────────────────────────────────────────
export PLATFORM_BASE_URL="${PLATFORM_BASE_URL:-http://localhost:8080}"
export PLATFORM_HTTPS_URL="${PLATFORM_HTTPS_URL:-https://localhost:8443}"
export PORTAL_URL="${PORTAL_URL:-http://localhost:5173}"
export PLATFORM_API_KEY="${PLATFORM_API_KEY:-test-api-key}"
export ADMIN_TOKEN="${ADMIN_TOKEN:-test-admin-token}"
export USER_TOKEN="${USER_TOKEN:-test-user-token}"
export KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
export PERMIFY_URL="${PERMIFY_URL:-http://localhost:3476}"
export KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-localhost:9092}"
export TEMPORAL_HOST="${TEMPORAL_HOST:-localhost:7233}"
export TIGERBEETLE_HOST="${TIGERBEETLE_HOST:-localhost:3001}"
export TRINO_HOST="${TRINO_HOST:-localhost:8080}"
export OPENIMIS_URL="${OPENIMIS_URL:-http://localhost:8001}"

echo "═══════════════════════════════════════════════════════════════"
echo "  Unified Insurance Platform — Test Suite Runner"
echo "  Environment: ${ENV}"
echo "  Suite: ${SUITE}"
echo "  Timestamp: ${TIMESTAMP}"
echo "═══════════════════════════════════════════════════════════════"

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
    echo "Stopping mock services..."
    kill "${HARNESS_PID:-}" "${KEYCLOAK_PID:-}" "${PERMIFY_PID:-}" "${OPENIMIS_PID:-}" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT

# ── Kill any existing services on these ports ─────────────────────────────────
for port in 8080 8180 3476 8001; do
    fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 1

# ── Start mock services ───────────────────────────────────────────────────────
echo "Starting test harness (port 8080)..."
python3 "${SCRIPT_DIR}/test_harness_server.py" 8080 &
HARNESS_PID=$!

echo "Starting Keycloak mock (port 8180)..."
python3 "${SCRIPT_DIR}/test_harness_server.py" 8180 &
KEYCLOAK_PID=$!

echo "Starting Permify mock (port 3476)..."
python3 "${SCRIPT_DIR}/mock_services.py" 3476 permify &
PERMIFY_PID=$!

echo "Starting OpenIMIS mock (port 8001)..."
python3 "${SCRIPT_DIR}/mock_services.py" 8001 openimis &
OPENIMIS_PID=$!

# ── Wait for services to be ready ─────────────────────────────────────────────
echo "Waiting for services to be ready..."
for i in $(seq 1 15); do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo "Test harness ready"
        break
    fi
    sleep 1
done

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "${RESULTS_DIR}"
pip install pytest pytest-timeout pytest-html pytest-xdist requests locust \
    kafka-python temporalio trino pyyaml playwright 2>/dev/null || true

# ── Track Results ─────────────────────────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0
declare -A SUITE_RESULTS

run_suite() {
  local name="$1"
  local path="$2"
  local extra_args="${3:-}"

  echo ""
  echo "─── Running ${name} Tests ───────────────────────────────────────"
  local result_file="${RESULTS_DIR}/${name}_${TIMESTAMP}.xml"

  if pytest "${path}" \
    --junitxml="${result_file}" \
    --timeout=60 \
    -v \
    ${extra_args} \
    2>&1 | tee -a "${LOG_FILE}"; then
    SUITE_RESULTS["${name}"]="PASS"
    ((PASS++)) || true
    echo "✅ ${name}: PASSED"
  else
    SUITE_RESULTS["${name}"]="FAIL"
    ((FAIL++)) || true
    echo "❌ ${name}: FAILED"
  fi
}

# ── Run Test Suites ───────────────────────────────────────────────────────────
case "${SUITE}" in
  regression|all)
    run_suite "regression" "${SCRIPT_DIR}/regression/test_regression.py"
    ;;&
  integration|all)
    run_suite "integration" "${SCRIPT_DIR}/integration/test_integration.py" "--timeout=120"
    ;;&
  security|all)
    run_suite "security" "${SCRIPT_DIR}/security/test_security.py"
    ;;&
  ux|all)
    run_suite "ux" "${SCRIPT_DIR}/ux/test_stakeholder_ux.py"
    ;;&
  chaos|all)
    if kubectl get namespace chaos-testing &>/dev/null 2>&1; then
      run_suite "chaos" "${SCRIPT_DIR}/chaos/chaos_tests.py" "--timeout=300"
    else
      echo "⚠️  Chaos Mesh not available — skipping chaos tests"
      SUITE_RESULTS["chaos"]="SKIP"
      ((SKIP++)) || true
    fi
    ;;&
  performance|all)
    echo ""
    echo "─── Running Performance Tests (Locust) ─────────────────────────"
    if command -v locust &>/dev/null; then
      locust -f "${SCRIPT_DIR}/performance/locustfile.py" \
        --host="${PLATFORM_BASE_URL}" \
        --headless \
        --users=50 \
        --spawn-rate=5 \
        --run-time=2m \
        --html="${RESULTS_DIR}/performance_${TIMESTAMP}.html" \
        --csv="${RESULTS_DIR}/performance_${TIMESTAMP}" \
        2>&1 | tee -a "${LOG_FILE}" && \
        SUITE_RESULTS["performance"]="PASS" && ((PASS++)) || true || \
        SUITE_RESULTS["performance"]="FAIL" && ((FAIL++)) || true
    else
      echo "⚠️  Locust not available — skipping performance tests"
      SUITE_RESULTS["performance"]="SKIP"
      ((SKIP++)) || true
    fi
    ;;
esac

# ── Summary Report ────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  TEST RESULTS SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
for suite in "${!SUITE_RESULTS[@]}"; do
  result="${SUITE_RESULTS[$suite]}"
  case "$result" in
    PASS) echo "  ✅ ${suite}: PASSED" ;;
    FAIL) echo "  ❌ ${suite}: FAILED" ;;
    SKIP) echo "  ⚠️  ${suite}: SKIPPED" ;;
  esac
done
echo "───────────────────────────────────────────────────────────────"
echo "  Total: $((PASS + FAIL + SKIP)) | Passed: ${PASS} | Failed: ${FAIL} | Skipped: ${SKIP}"
echo "  Full log: ${LOG_FILE}"
echo "  Results: ${RESULTS_DIR}/"
echo "═══════════════════════════════════════════════════════════════"

# ── Exit Code ─────────────────────────────────────────────────────────────────
if [ "${FAIL}" -gt 0 ]; then
  exit 1
fi
exit 0
