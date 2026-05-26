#!/usr/bin/env bash
# =============================================================================
# OG-RMM Platform — Comprehensive Smoke Test Suite
# =============================================================================
set -uo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
PHYSICS_URL="${PHYSICS_URL:-http://localhost:8080}"
ML_URL="${ML_URL:-http://localhost:8000}"
ADAPTER_URL="${ADAPTER_URL:-http://localhost:8090}"
TIMEOUT=10
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
PASS=0; FAIL=0; SKIP=0; TOTAL=0

log()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()     { echo -e "${GREEN}[PASS]${NC}  $*"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail()   { echo -e "${RED}[FAIL]${NC}  $*"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
skip()   { echo -e "${YELLOW}[SKIP]${NC}  $*"; SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); }
header() { echo -e "\n${BLUE}══ $* ══${NC}"; }

service_up() { curl -sf --max-time "$TIMEOUT" "$1" > /dev/null 2>&1; }

assert_json_key() {
  local label="$1" url="$2" key="$3" expected="${4:-}"
  local resp
  resp=$(curl -sf --max-time "$TIMEOUT" -H "Content-Type: application/json" "$url" 2>/dev/null) || { fail "$label — request failed"; return; }
  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$key' in d" 2>/dev/null; then
    if [[ -n "$expected" ]]; then
      actual=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key',''))" 2>/dev/null)
      [[ "$actual" == "$expected" ]] && ok "$label — $key=$expected" || fail "$label — expected $key=$expected, got $key=$actual"
    else
      ok "$label — has key '$key'"
    fi
  else
    fail "$label — missing key '$key' in: ${resp:0:200}"
  fi
}

assert_post_json() {
  local label="$1" url="$2" body="$3" key="$4"
  local resp
  resp=$(curl -sf --max-time "$TIMEOUT" -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null) || { fail "$label — POST failed"; return; }
  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$key' in d" 2>/dev/null; then
    ok "$label — response has '$key'"
  else
    fail "$label — missing '$key' in: ${resp:0:200}"
  fi
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          OG-RMM Platform — Smoke Test Suite                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
log "App: $APP_URL | Physics: $PHYSICS_URL | ML: $ML_URL | Adapter: $ADAPTER_URL"

# 1. Node.js App
header "1. Node.js Application"
if service_up "$APP_URL/health"; then
  assert_json_key "App health" "$APP_URL/health" "status"
else
  skip "App not reachable at $APP_URL"
fi

# 2. Go Protocol Adapter
header "2. Go Protocol Adapter"
if service_up "$ADAPTER_URL/health"; then
  assert_json_key "Adapter health"  "$ADAPTER_URL/health"  "status"  "healthy"
  assert_json_key "Adapter ready"   "$ADAPTER_URL/ready"   "ready"
  assert_json_key "Adapter stats"   "$ADAPTER_URL/stats"   "uptime_seconds"
  TELEMETRY='[{"deviceId":"RTU-TEST-001","wellId":"W-001","tag":"wellhead_pressure_psi","value":215.3,"unit":"psi","quality":"GOOD"}]'
  assert_post_json "Adapter ingest" "$ADAPTER_URL/ingest" "$TELEMETRY" "accepted"
  assert_post_json "Adapter flush"  "$ADAPTER_URL/flush"  "{}" "flushed"
  METRICS=$(curl -sf --max-time "$TIMEOUT" "$ADAPTER_URL/metrics" 2>/dev/null) || METRICS=""
  echo "$METRICS" | grep -q "ogrmm_points_ingested_total" && ok "Adapter Prometheus metrics present" || fail "Adapter Prometheus metrics missing"
else
  skip "Protocol adapter not reachable at $ADAPTER_URL"
fi

# 3. Rust Physics Engine
header "3. Rust Physics Engine"
if service_up "$PHYSICS_URL/health"; then
  assert_json_key "Physics health" "$PHYSICS_URL/health" "status"
  NODAL_BODY='{"well_id":"W-001","reservoir_pressure":3500,"q_max":1500,"skin_factor":0,"esp_frequency_hz":0,"wellhead_pressure":200,"tvd_ft":8000,"fluid_gradient":0.433,"water_cut":0.28,"gor_scf_per_bbl":650}'
  assert_post_json "Physics nodal analysis" "$PHYSICS_URL/compute/nodal" "$NODAL_BODY" "ipr_curve"
  DECLINE_BODY='{"well_id":"W-001","qi":1200,"di":0.08,"b":0.5,"months":12}'
  assert_post_json "Physics decline curve" "$PHYSICS_URL/compute/decline" "$DECLINE_BODY" "eur_mbbl"
  SAND_BODY='{"well_id":"W-001","tvd_ft":8000,"reservoir_pressure_psia":3500,"bhfp_psia":2800,"ucs_psi":2800,"friction_angle_deg":32,"biot_coefficient":0.8,"overburden_gradient_psi_ft":0.95,"completion_type":"CASED_PERFORATED","current_rate_bpd":800}'
  assert_post_json "Physics sand onset" "$PHYSICS_URL/compute/sand-onset" "$SAND_BODY" "critical_drawdown_psi"
  GEO_BODY='{"well_id":"W-001","tvd_ft":8000,"current_mud_weight_ppg":10.5}'
  assert_post_json "Physics geomechanics" "$PHYSICS_URL/compute/geomechanics" "$GEO_BODY" "fracture_gradient_ppg"
else
  skip "Physics engine not reachable at $PHYSICS_URL"
fi

# 4. Python ML Service
header "4. Python ML Service"
if service_up "$ML_URL/health"; then
  assert_json_key "ML health" "$ML_URL/health" "status"
  assert_post_json "ML decline curve" "$ML_URL/decline-curve" '{"well_id":"W-001","production_data":[{"date":"2024-01-01","oil_rate_bpd":1200},{"date":"2024-02-01","oil_rate_bpd":1050},{"date":"2024-03-01","oil_rate_bpd":920}],"forecast_months":12}' "forecast"
  assert_post_json "ML anomaly detection" "$ML_URL/anomaly-detection" '{"well_id":"W-001","sensor_data":[{"timestamp":1700000000000,"tag":"wellhead_pressure_psi","value":215.3},{"timestamp":1700003600000,"tag":"wellhead_pressure_psi","value":312.7}]}' "anomalies"
  assert_post_json "ML well test interpret" "$ML_URL/well-test-interpret" '{"well_id":"W-001","test_type":"MULTI_RATE","test_duration_hours":72,"wellhead_pressure_psi":215.3,"wellhead_temperature_f":168,"flow_rates_bpd":[800,1000,1200],"stabilized_pressures_psi":[2950,2800,2650]}' "productivity_index"
else
  skip "ML service not reachable at $ML_URL"
fi

# 5. Docker Compose validation
header "5. Docker Compose Validation"
DC_FILE="/home/ubuntu/og-rmm-platform/docker-compose.yml"
if [[ -f "$DC_FILE" ]]; then
  SERVICE_COUNT=$(grep -c "^  [a-z]" "$DC_FILE" 2>/dev/null || echo "0")
  [[ "$SERVICE_COUNT" -ge 10 ]] && ok "Docker Compose — $SERVICE_COUNT services defined" || fail "Docker Compose — only $SERVICE_COUNT services"
  for svc in postgres redis mosquitto physics-engine ml-service telemetry-ingestion; do
    grep -q "^  $svc:" "$DC_FILE" 2>/dev/null && ok "Docker Compose — '$svc' defined" || fail "Docker Compose — '$svc' missing"
  done
else
  fail "docker-compose.yml not found"
fi

# 6. K8s manifests
header "6. Kubernetes Manifests"
K8S_DIR="/home/ubuntu/og-rmm-platform/infra/k8s"
for subdir in deployments services hpa pdb configmaps jobs network-policies; do
  if [[ -d "$K8S_DIR/$subdir" ]] && ls "$K8S_DIR/$subdir"/*.yaml > /dev/null 2>&1; then
    ok "K8s — $subdir/ present"
  else
    fail "K8s — $subdir/ missing"
  fi
done

# 7. Seed data
header "7. Seed Data Coverage"
SEED_FILE="/home/ubuntu/og-rmm-platform/server/routers/masterSeed.ts"
if [[ -f "$SEED_FILE" ]]; then
  SEED_INSERTS=$(grep -c "db.insert" "$SEED_FILE" 2>/dev/null || echo "0")
  [[ "$SEED_INSERTS" -ge 20 ]] && ok "Seed — $SEED_INSERTS table inserts" || fail "Seed — only $SEED_INSERTS inserts"
else
  fail "masterSeed.ts not found"
fi

# 8. Test suite
header "8. Test Suite"
TEST_FILES=$(find /home/ubuntu/og-rmm-platform/server -name "*.test.ts" 2>/dev/null | wc -l)
[[ "$TEST_FILES" -ge 5 ]] && ok "Test suite — $TEST_FILES test files" || fail "Test suite — only $TEST_FILES files"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    SMOKE TEST RESULTS                       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Total:   $TOTAL"
echo "║  Passed:  $PASS"
echo "║  Failed:  $FAIL"
echo "║  Skipped: $SKIP"
echo "╚══════════════════════════════════════════════════════════════╝"
[[ "$FAIL" -gt 0 ]] && { echo -e "${RED}SMOKE TEST FAILED — $FAIL test(s) failed${NC}"; exit 1; } || { echo -e "${GREEN}SMOKE TEST PASSED — $PASS passed, $SKIP skipped${NC}"; exit 0; }
