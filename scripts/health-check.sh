#!/bin/bash

# Health Check Script for Payment Switch Platform
# Validates all services are running and healthy after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIMEOUT=10
BASE_URL="${BASE_URL:-http://localhost}"
WEB_PORTAL_PORT="${WEB_PORTAL_PORT:-3000}"
API_GATEWAY_PORT="${API_GATEWAY_PORT:-80}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Payment Switch Platform - Health Check               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check HTTP endpoint
check_http() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n "Checking $name... "
    
    if command -v curl &> /dev/null; then
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
        
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            echo -e "${RED}✗ FAILED${NC} (HTTP $response, expected $expected_status)"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ SKIPPED${NC} (curl not installed)"
        return 2
    fi
}

# Function to check Docker container
check_container() {
    local name="$1"
    local container_name="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n "Checking $name container... "
    
    if command -v docker &> /dev/null; then
        if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
            status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null)
            if [ "$status" = "running" ]; then
                echo -e "${GREEN}✓ RUNNING${NC}"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
                return 0
            else
                echo -e "${RED}✗ NOT RUNNING${NC} (status: $status)"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
                return 1
            fi
        else
            echo -e "${RED}✗ NOT FOUND${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ SKIPPED${NC} (Docker not available)"
        return 2
    fi
}

# Function to check database connection
check_database() {
    local name="$1"
    local host="$2"
    local port="$3"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    echo -n "Checking $name database... "
    
    if command -v nc &> /dev/null; then
        if nc -z -w $TIMEOUT "$host" "$port" 2>/dev/null; then
            echo -e "${GREEN}✓ ACCESSIBLE${NC} ($host:$port)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            return 0
        else
            echo -e "${RED}✗ NOT ACCESSIBLE${NC} ($host:$port)"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ SKIPPED${NC} (netcat not installed)"
        return 2
    fi
}

echo -e "${BLUE}[1/4] Checking Docker Containers${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_container "Web Portal" "web-portal"
check_container "MySQL" "mysql-db"
check_container "PostgreSQL" "postgres-db"
check_container "Redis" "redis-cache"
check_container "Kafka" "kafka"
check_container "Nginx Gateway" "nginx-gateway"
check_container "Grafana" "grafana"
check_container "Prometheus" "prometheus"
echo ""

echo -e "${BLUE}[2/4] Checking HTTP Endpoints${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_http "Web Portal" "$BASE_URL:$WEB_PORTAL_PORT" "200"
check_http "API Gateway" "$BASE_URL:$API_GATEWAY_PORT/health" "200"
check_http "Grafana" "$BASE_URL:$GRAFANA_PORT/api/health" "200"
check_http "Prometheus" "$BASE_URL:9090/-/healthy" "200"
echo ""

echo -e "${BLUE}[3/4] Checking Database Connections${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_database "MySQL" "localhost" "3306"
check_database "PostgreSQL" "localhost" "5432"
check_database "Redis" "localhost" "6379"
echo ""

echo -e "${BLUE}[4/4] Checking Service Health${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if tRPC API is responding
check_http "tRPC API" "$BASE_URL:$WEB_PORTAL_PORT/api/trpc/auth.me" "200"

# Check if Prometheus is scraping targets
if command -v curl &> /dev/null; then
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "Checking Prometheus targets... "
    targets=$(curl -s "$BASE_URL:9090/api/v1/targets" 2>/dev/null | grep -o '"health":"up"' | wc -l || echo "0")
    if [ "$targets" -gt 0 ]; then
        echo -e "${GREEN}✓ OK${NC} ($targets targets up)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (no targets up)"
    fi
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Health Check Summary                                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Checks:  $TOTAL_CHECKS"
echo -e "${GREEN}Passed:        $PASSED_CHECKS${NC}"
echo -e "${RED}Failed:        $FAILED_CHECKS${NC}"
echo ""

# Calculate success rate
if [ $TOTAL_CHECKS -gt 0 ]; then
    success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo -e "Success Rate:  ${success_rate}%"
    echo ""
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! Platform is healthy.${NC}"
        exit 0
    elif [ $success_rate -ge 80 ]; then
        echo -e "${YELLOW}⚠ Some checks failed, but platform is mostly operational.${NC}"
        exit 1
    else
        echo -e "${RED}✗ Multiple checks failed! Platform may not be operational.${NC}"
        exit 2
    fi
else
    echo -e "${YELLOW}⚠ No checks were performed.${NC}"
    exit 3
fi
