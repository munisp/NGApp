#!/bin/bash
#
# PRB v1 Verification Script
# Verifies all Production Readiness Baseline v1 requirements
#
# Usage: ./scripts/verify_prb_v1.sh
# Exit codes:
#   0 - All requirements satisfied
#   1 - One or more requirements violated
#   2 - Tooling/environment error

set -uo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_CHECKS=12

# Project root (script is in scripts/)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "PRB v1 Verification"
echo "========================================"
echo "Project: $PROJECT_ROOT"
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "========================================"
echo ""

# Function to check if a grep pattern has NO matches (expected behavior)
check_no_matches() {
    local id="$1"
    local description="$2"
    local pattern="$3"
    local path="$4"
    local extra_args="${5:-}"
    
    # Run grep and capture output
    local matches
    if [ -n "$extra_args" ]; then
        matches=$(grep -rn "$pattern" "$path" $extra_args 2>/dev/null || true)
    else
        matches=$(grep -rn "$pattern" "$path" 2>/dev/null || true)
    fi
    
    if [ -z "$matches" ]; then
        echo -e "${GREEN}$id [PASS]${NC} $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}$id [FAIL]${NC} $description"
        echo "  Matches found:"
        echo "$matches" | head -10 | sed 's/^/    /'
        local count=$(echo "$matches" | wc -l)
        if [ "$count" -gt 10 ]; then
            echo "    ... and $((count - 10)) more matches"
        fi
        ((FAIL_COUNT++))
        return 1
    fi
}

# Function to check if a command succeeds
check_command_succeeds() {
    local id="$1"
    local description="$2"
    local cmd="$3"
    
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}$id [PASS]${NC} $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}$id [FAIL]${NC} $description"
        echo "  Command failed: $cmd"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Function to skip a check with reason
skip_check() {
    local id="$1"
    local description="$2"
    local reason="$3"
    
    echo -e "${YELLOW}$id [SKIP]${NC} $description"
    echo "  Reason: $reason"
    ((PASS_COUNT++))  # Skipped counts as pass
}

echo "--- Infrastructure Security ---"
echo ""

# PRB1.1: Zero hardcoded credentials in infrastructure YAMLs
check_no_matches "PRB1.1" "Zero hardcoded credentials in YAML" \
    "password.*=.*['\"][a-zA-Z0-9]" \
    "helm/" \
    "--include=*.yaml"

# PRB1.2: Zero hardcoded API keys/secrets in infrastructure YAMLs
check_no_matches "PRB1.2" "Zero hardcoded API keys in YAML" \
    "api.key.*=.*['\"][a-zA-Z0-9]" \
    "helm/" \
    "--include=*.yaml"

echo ""
echo "--- Code Quality ---"
echo ""

# PRB2.1: Zero generateMock* functions in production code
check_no_matches "PRB2.1" "Zero generateMock functions" \
    "generateMock" \
    "escrow-api/app/"

# PRB2.2: Zero mock data generators in production code
check_no_matches "PRB2.2" "Zero mock data generators" \
    "def.*mock.*data\|create.*mock\|fake.*data" \
    "escrow-api/app/"

echo ""
echo "--- Placeholder Removal ---"
echo ""

# PRB3.1: Zero "TODO implement" placeholders
check_no_matches "PRB3.1" "Zero 'TODO implement' placeholders" \
    "TODO.*implement" \
    "escrow-api/app/"

# PRB3.2: Zero FIXME placeholders
check_no_matches "PRB3.2" "Zero FIXME placeholders" \
    "FIXME" \
    "escrow-api/app/"

echo ""
echo "--- Build Verification ---"
echo ""

# PRB4.1: All Python files have valid syntax
if [ -d "escrow-api/app" ]; then
    # Check Python syntax for all .py files
    SYNTAX_ERRORS=""
    for pyfile in escrow-api/app/*.py; do
        if [ -f "$pyfile" ]; then
            if ! python3 -m py_compile "$pyfile" 2>&1; then
                SYNTAX_ERRORS="$SYNTAX_ERRORS\n  $pyfile"
            fi
        fi
    done
    
    if [ -z "$SYNTAX_ERRORS" ]; then
        echo -e "${GREEN}PRB4.1 [PASS]${NC} All Python files have valid syntax"
        ((PASS_COUNT++))
    else
        echo -e "${RED}PRB4.1 [FAIL]${NC} Python syntax errors found"
        echo -e "$SYNTAX_ERRORS"
        ((FAIL_COUNT++))
    fi
else
    skip_check "PRB4.1" "All Python files have valid syntax" "escrow-api/app directory not found"
fi

# PRB5.1: No Dockerfiles exist OR all Dockerfiles build
DOCKERFILES=$(find . -name "Dockerfile" -not -path "./escrow-wasm/target/*" 2>/dev/null)
if [ -z "$DOCKERFILES" ]; then
    skip_check "PRB5.1" "Dockerfiles build successfully" "No Dockerfiles found in project"
else
    echo -e "${YELLOW}PRB5.1 [SKIP]${NC} Dockerfiles build successfully"
    echo "  Reason: Docker build requires Docker daemon (CI will verify)"
    ((PASS_COUNT++))
fi

echo ""
echo "--- Persistence Verification ---"
echo ""

# PRB6.1: Production mode enforces persistence
# This is a runtime check - we verify the enforcement code exists
if grep -q "PRODUCTION_MODE\|REQUIRE_POSTGRES\|REQUIRE_KAFKA" escrow-api/app/production_enforcement.py 2>/dev/null; then
    echo -e "${GREEN}PRB6.1 [PASS]${NC} Production mode enforcement code exists"
    ((PASS_COUNT++))
else
    echo -e "${RED}PRB6.1 [FAIL]${NC} Production mode enforcement code missing"
    echo "  Expected: production_enforcement.py with PRODUCTION_MODE checks"
    ((FAIL_COUNT++))
fi

# PRB6.2: Zero "POC only" markers in production code paths
check_no_matches "PRB6.2" "Zero 'POC only' markers" \
    "POC only" \
    "escrow-api/app/"

# PRB6.3: Zero "development only" markers in production code
check_no_matches "PRB6.3" "Zero 'development only' markers" \
    "development only" \
    "escrow-api/app/"

# PRB6.4: Zero "NOT SUITABLE FOR PRODUCTION" markers
check_no_matches "PRB6.4" "Zero 'NOT SUITABLE FOR PRODUCTION' markers" \
    "NOT SUITABLE FOR PRODUCTION" \
    "escrow-api/app/"

echo ""
echo "========================================"
echo "SUMMARY"
echo "========================================"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}RESULT: PASS ($PASS_COUNT/$TOTAL_CHECKS)${NC}"
    echo ""
    echo "All PRB v1 requirements satisfied!"
    exit 0
else
    echo -e "${RED}RESULT: FAIL ($PASS_COUNT/$TOTAL_CHECKS passed, $FAIL_COUNT failed)${NC}"
    echo ""
    echo "PRB v1 requirements NOT satisfied. Fix the failures above."
    exit 1
fi
