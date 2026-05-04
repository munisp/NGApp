#!/bin/bash

# Payment Switch Admin Portal - E2E Test Runner Script
# Run this script whenever a new version is released to verify all functionality
#
# Usage:
#   ./scripts/run-e2e-tests.sh [options]
#
# Options:
#   --headed        Run tests in headed mode (visible browser)
#   --ui            Open Playwright UI for interactive testing
#   --report        Generate and open HTML report after tests
#   --quick         Run only navigation tests (quick smoke test)
#   --full          Run all tests including comprehensive report
#   --ci            Run in CI mode (no retries, fail fast)
#
# Environment Variables:
#   BASE_URL        Base URL of the application (default: http://localhost:3001)
#   CI              Set to 'true' for CI environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${BASE_URL:-http://localhost:3001}"
HEADED=""
UI_MODE=""
REPORT=""
QUICK=""
FULL=""
CI_MODE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --headed)
            HEADED="--headed"
            shift
            ;;
        --ui)
            UI_MODE="true"
            shift
            ;;
        --report)
            REPORT="true"
            shift
            ;;
        --quick)
            QUICK="true"
            shift
            ;;
        --full)
            FULL="true"
            shift
            ;;
        --ci)
            CI_MODE="true"
            export CI=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Payment Switch Admin Portal E2E Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Base URL: ${GREEN}$BASE_URL${NC}"
echo -e "Date: $(date)"
echo ""

# Change to the admin-dashboard directory
cd "$(dirname "$0")/.."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Check if Playwright browsers are installed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install chromium
fi

# Export BASE_URL for Playwright
export BASE_URL

# Run tests based on mode
if [ "$UI_MODE" = "true" ]; then
    echo -e "${BLUE}Opening Playwright UI...${NC}"
    npx playwright test --ui
elif [ "$QUICK" = "true" ]; then
    echo -e "${BLUE}Running quick smoke tests (navigation only)...${NC}"
    npx playwright test navigation.spec.ts $HEADED
elif [ "$FULL" = "true" ]; then
    echo -e "${BLUE}Running full test suite...${NC}"
    
    echo -e "\n${YELLOW}1/8 Navigation Tests${NC}"
    npx playwright test navigation.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}2/8 User Journeys Tests${NC}"
    npx playwright test user-journeys.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}3/8 KYC Verification Tests${NC}"
    npx playwright test kyc-verification.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}4/8 KYB Verification Tests${NC}"
    npx playwright test kyb-verification.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}5/8 Onboarding Tests${NC}"
    npx playwright test onboarding.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}6/8 Participants Tests${NC}"
    npx playwright test participants.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}7/8 Integration Testing Tests${NC}"
    npx playwright test integration-testing.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}8/8 Remaining Pages Tests${NC}"
    npx playwright test remaining-pages.spec.ts $HEADED || true
    
    echo -e "\n${YELLOW}Generating Comprehensive Report...${NC}"
    npx playwright test comprehensive-report.spec.ts $HEADED || true
else
    echo -e "${BLUE}Running all E2E tests...${NC}"
    npx playwright test $HEADED
fi

# Generate report if requested
if [ "$REPORT" = "true" ]; then
    echo -e "\n${BLUE}Opening HTML report...${NC}"
    npx playwright show-report test-results/html-report
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}E2E Tests Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Test results saved to: ${BLUE}test-results/${NC}"
echo -e "HTML report: ${BLUE}test-results/html-report/index.html${NC}"
echo -e "JSON results: ${BLUE}test-results/results.json${NC}"
