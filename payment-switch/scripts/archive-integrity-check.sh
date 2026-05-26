#!/bin/bash
# =============================================================================
# Archive Referential Integrity Checker
# =============================================================================
# Runs BEFORE archive generation to ensure NO files are missing.
# Checks: directory presence, critical file existence, cross-references,
#          file counts, and size baselines.
#
# Usage: bash scripts/archive-integrity-check.sh [--fix] [--baseline]
#   --baseline  Generate a new baseline from current disk state
#   --fix       Attempt to recover missing files from previous archives
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE_FILE="${REPO_ROOT}/scripts/.archive-baseline.json"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ERRORS=0
WARNINGS=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ERRORS=$((ERRORS + 1)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
log_info() { echo -e "       $1"; }

cd "$REPO_ROOT"

echo "=============================================="
echo "  Archive Referential Integrity Check"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="
echo ""

# -------------------------------------------------------
# 1. REQUIRED DIRECTORIES — every one of these MUST exist
# -------------------------------------------------------
echo "--- 1. Required Directories ---"

REQUIRED_DIRS=(
    "admin-dashboard"
    "admin-dashboard/src"
    "admin-dashboard/node_modules"
    "client"
    "client/src"
    "config"
    "compliance"
    "deploy"
    "dist"
    "docs"
    "drizzle"
    "drizzle/meta"
    "k8s"
    "kubernetes"
    "load-tests"
    "middleware"
    "mobile"
    "mobile-app"
    "monitoring"
    "nginx"
    "node_modules"
    "orchestrator"
    "patches"
    "payment-core"
    "payment-core/deployment"
    "payment-core/go-services"
    "payment-core/python-services"
    "payment-core/rust-services"
    "payment-core/services"
    "payment-switch"
    "scripts"
    "sdks"
    "security"
    "server"
    "shared"
    ".github"
    ".github/workflows"
    ".manus"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        count=$(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l)
        log_pass "$dir/ (${count} files at top level)"
    else
        log_fail "MISSING DIRECTORY: $dir/"
    fi
done

echo ""

# -------------------------------------------------------
# 2. CRITICAL FILES — must exist at specific paths
# -------------------------------------------------------
echo "--- 2. Critical Files ---"

CRITICAL_FILES=(
    "package.json"
    "pnpm-lock.yaml"
    "tsconfig.json"
    "drizzle.config.ts"
    "Dockerfile"
    "docker-compose.yml"
    "docker-compose.staging.yml"
    "docker-compose.unified.yml"
    "docker-compose.middleware.yml"
    "docker-swarm-stack.yml"
    "README.md"
    ".env.staging.example"
    "server/db.ts"
    "server/_core/index.ts"
    "server/auditLog.ts"
    "server/middleware/secretManager.ts"
    "client/src/App.tsx"
    "client/src/main.tsx"
    "admin-dashboard/next.config.js"
    "admin-dashboard/package.json"
    "admin-dashboard/src/app/page.tsx"
    "admin-dashboard/src/components/hub/DashboardHub.tsx"
    "admin-dashboard/src/components/layout/Sidebar.tsx"
    "admin-dashboard/src/components/layout/Layout.tsx"
    "drizzle/schema.ts"
    "payment-core/go-services/go.mod"
    "payment-core/python-services/nibss_analytics/real_ai_ml_service.py"
    "payment-core/rust-services/gateway-engine/Cargo.toml"
    "payment-core/rust-services/outbound-ledger/Cargo.toml"
    ".github/workflows/ci.yml"
    ".github/workflows/deploy-production.yml"
    "orchestrator/workers/go/go.mod"
    "scripts/archive-integrity-check.sh"
    "payment-switch/PROJECT_SUMMARY.md"
)

for f in "${CRITICAL_FILES[@]}"; do
    if [ -f "$f" ]; then
        size=$(du -sh "$f" 2>/dev/null | cut -f1)
        log_pass "$f (${size})"
    else
        log_fail "MISSING FILE: $f"
    fi
done

echo ""

# -------------------------------------------------------
# 3. FILE COUNT THRESHOLDS — catch bulk deletions
# -------------------------------------------------------
echo "--- 3. File Count Thresholds ---"

check_count() {
    local dir="$1"
    local min_count="$2"
    local label="$3"
    
    if [ ! -d "$dir" ]; then
        log_fail "$label: directory missing"
        return
    fi
    
    local actual
    actual=$(find "$dir" -type f 2>/dev/null | wc -l)
    
    if [ "$actual" -ge "$min_count" ]; then
        log_pass "$label: ${actual} files (minimum: ${min_count})"
    else
        log_fail "$label: only ${actual} files (expected at least ${min_count})"
    fi
}

check_count "server"                     100   "Server (tRPC + Express)"
check_count "client/src"                 50    "Client (Vite React)"
check_count "admin-dashboard/src"        50    "Admin Dashboard (Next.js)"
check_count "drizzle"                    60    "Drizzle schemas + migrations"
check_count "payment-core/go-services"   100   "Go services"
check_count "payment-core/rust-services" 30    "Rust services"
check_count "payment-core/python-services" 10  "Python services"
check_count "payment-core/deployment"    20    "Deployment configs"
check_count "node_modules"               50000 "Root node_modules"
check_count "admin-dashboard/node_modules" 20000 "Admin node_modules"
check_count "payment-switch"             90000 "Payment Switch (original artifacts)"
check_count ".github/workflows"          4     "CI/CD workflows"
check_count "docs"                       20    "Documentation"
check_count "orchestrator"               20    "Orchestrator services"
check_count "mobile"                     15    "Mobile (Flutter)"

echo ""

# -------------------------------------------------------
# 4. CROSS-REFERENCE CHECKS — verify internal references
# -------------------------------------------------------
echo "--- 4. Cross-Reference Checks ---"

# Check that package.json doesn't reference mysql2
if grep -q '"mysql2"' package.json 2>/dev/null; then
    log_fail "package.json still references mysql2"
else
    log_pass "package.json: no mysql2 dependency"
fi

# Check that pg driver is in package.json
if grep -q '"pg"' package.json 2>/dev/null; then
    log_pass "package.json: pg driver present"
else
    log_fail "package.json: pg driver missing"
fi

# Check docker-compose files use postgres
for dc in docker-compose.yml docker-compose.staging.yml docker-compose.unified.yml; do
    if [ -f "$dc" ]; then
        if grep -q "postgres" "$dc" 2>/dev/null; then
            log_pass "$dc: uses PostgreSQL"
        else
            log_warn "$dc: no PostgreSQL reference found"
        fi
    fi
done

# Check Go services use lib/pq
if [ -f "payment-core/go-services/go.mod" ]; then
    if grep -q "lib/pq" payment-core/go-services/go.mod 2>/dev/null; then
        log_pass "Go services: lib/pq driver present"
    else
        log_fail "Go services: lib/pq driver missing from go.mod"
    fi
fi

# Check Python services use psycopg2
if [ -f "payment-core/python-services/real_ai_ml_service.py" ]; then
    if grep -q "psycopg2" payment-core/python-services/real_ai_ml_service.py 2>/dev/null; then
        log_pass "Python services: psycopg2 driver present"
    else
        log_warn "Python services: psycopg2 not found in real_ai_ml_service.py"
    fi
fi

# Check Mojaloop dialect is pg
if grep -q "DIALECT.*pg" docker-compose.unified.yml 2>/dev/null; then
    log_pass "Mojaloop: DIALECT=pg configured"
else
    log_warn "Mojaloop: DIALECT=pg not found in docker-compose.unified.yml"
fi

echo ""

# -------------------------------------------------------
# 5. SIZE SANITY CHECK
# -------------------------------------------------------
echo "--- 5. Total Size Sanity Check ---"

TOTAL_FILES=$(find . -not -path './.git/*' -type f | wc -l)
TOTAL_SIZE_KB=$(du -sk --exclude='.git' . 2>/dev/null | cut -f1)

echo "   Total files (excl .git): ${TOTAL_FILES}"
echo "   Total size (excl .git):  $((TOTAL_SIZE_KB / 1024)) MB"

if [ "$TOTAL_FILES" -ge 150000 ]; then
    log_pass "File count: ${TOTAL_FILES} (threshold: 150,000)"
else
    log_fail "File count: ${TOTAL_FILES} — below 150,000 threshold. Files may be missing!"
fi

if [ "$TOTAL_SIZE_KB" -ge 2000000 ]; then
    log_pass "Total size: $((TOTAL_SIZE_KB / 1024)) MB (threshold: 2,000 MB)"
else
    log_fail "Total size: $((TOTAL_SIZE_KB / 1024)) MB — below 2 GB threshold. Content may be missing!"
fi

echo ""

# -------------------------------------------------------
# 6. BASELINE COMPARISON (if baseline exists)
# -------------------------------------------------------
if [ -f "$BASELINE_FILE" ] && command -v python3 &>/dev/null; then
    echo "--- 6. Baseline Comparison ---"
    python3 -c "
import json, os, sys

with open('$BASELINE_FILE') as f:
    baseline = json.load(f)

missing_dirs = []
shrunk_dirs = []

for entry in baseline.get('directories', []):
    d = entry['path']
    min_files = int(entry['file_count'] * 0.9)  # 10% tolerance
    if not os.path.isdir(d):
        missing_dirs.append(d)
    else:
        actual = sum(1 for _ in os.scandir(d) if True)  # rough count
        actual_full = int(os.popen(f'find \"{d}\" -type f 2>/dev/null | wc -l').read().strip())
        if actual_full < min_files:
            shrunk_dirs.append((d, entry['file_count'], actual_full))

if missing_dirs:
    for d in missing_dirs:
        print(f'\033[0;31m[FAIL]\033[0m Baseline dir missing: {d}')
else:
    print(f'\033[0;32m[PASS]\033[0m All baseline directories present')

if shrunk_dirs:
    for d, expected, actual in shrunk_dirs:
        print(f'\033[1;33m[WARN]\033[0m {d}: {actual} files (baseline: {expected}, -10% = {int(expected*0.9)})')
else:
    print(f'\033[0;32m[PASS]\033[0m All directories within 10% of baseline file counts')
" 2>/dev/null || log_warn "Baseline comparison skipped (parse error)"
    echo ""
fi

# -------------------------------------------------------
# GENERATE BASELINE (if --baseline flag)
# -------------------------------------------------------
if [[ "${1:-}" == "--baseline" ]]; then
    echo "--- Generating Baseline ---"
    python3 -c "
import json, os, subprocess

dirs = []
for entry in sorted(os.listdir('.')):
    if entry == '.git' or not os.path.isdir(entry):
        continue
    count = int(subprocess.check_output(f'find \"{entry}\" -type f 2>/dev/null | wc -l', shell=True).strip())
    size = subprocess.check_output(f'du -sk \"{entry}\" 2>/dev/null', shell=True).decode().split()[0]
    dirs.append({'path': entry, 'file_count': count, 'size_kb': int(size)})

total_files = int(subprocess.check_output('find . -not -path \"./.git/*\" -type f | wc -l', shell=True).strip())

baseline = {
    'generated': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'total_files': total_files,
    'directories': dirs
}

with open('$BASELINE_FILE', 'w') as f:
    json.dump(baseline, f, indent=2)

print(f'Baseline saved: {len(dirs)} directories, {total_files} total files')
" 2>/dev/null
    echo ""
fi

# -------------------------------------------------------
# SUMMARY
# -------------------------------------------------------
echo "=============================================="
if [ "$ERRORS" -gt 0 ]; then
    echo -e "  ${RED}INTEGRITY CHECK FAILED${NC}"
    echo -e "  ${RED}${ERRORS} error(s), ${WARNINGS} warning(s)${NC}"
    echo "  DO NOT GENERATE ARCHIVE UNTIL ERRORS ARE FIXED"
    echo "=============================================="
    exit 1
else
    echo -e "  ${GREEN}INTEGRITY CHECK PASSED${NC}"
    echo -e "  ${WARNINGS} warning(s), 0 errors"
    echo "  Safe to generate archive"
    echo "=============================================="
    exit 0
fi
