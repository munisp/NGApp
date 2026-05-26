#!/bin/bash
# Payment Switch Platform - Kubernetes Deployment Verification Script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

NAMESPACE="${NAMESPACE:-payment-switch}"
TESTS_PASSED=0
TESTS_FAILED=0

# Check pod status
check_pods() {
    log_info "Checking pod status..."
    
    local pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for pod in $pods; do
        local status=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        local ready=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
        
        if [ "$status" == "Running" ] && [ "$ready" == "True" ]; then
            log_pass "Pod $pod is running and ready"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            log_fail "Pod $pod is not ready (status: $status, ready: $ready)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    done
}

# Check deployments
check_deployments() {
    log_info "Checking deployment status..."
    
    local deployments=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        local available=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}')
        local desired=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        
        if [ "${available:-0}" == "${desired:-1}" ]; then
            log_pass "Deployment $deployment: $available/$desired replicas available"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            log_fail "Deployment $deployment: ${available:-0}/${desired:-1} replicas available"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    done
}

# Check services
check_services() {
    log_info "Checking service endpoints..."
    
    local services=$(kubectl get services -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for service in $services; do
        local endpoints=$(kubectl get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
        
        if [ -n "$endpoints" ]; then
            log_pass "Service $service has endpoints"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            log_warn "Service $service has no endpoints (may be expected for some services)"
        fi
    done
}

# Check health endpoints
check_health_endpoints() {
    log_info "Checking health endpoints..."
    
    # Get APISIX service IP
    local apisix_ip=$(kubectl get svc apisix -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [ -z "$apisix_ip" ]; then
        # Try NodePort
        apisix_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
        local apisix_port=$(kubectl get svc apisix -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}' 2>/dev/null || echo "80")
        apisix_ip="${apisix_ip}:${apisix_port}"
    fi
    
    if [ -n "$apisix_ip" ]; then
        log_info "Testing health endpoints via APISIX at $apisix_ip"
        
        # Test various health endpoints
        local endpoints=(
            "/health"
            "/api/health"
            "/api/v1/health"
        )
        
        for endpoint in "${endpoints[@]}"; do
            local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${apisix_ip}${endpoint}" 2>/dev/null || echo "000")
            
            if [ "$response" == "200" ]; then
                log_pass "Health endpoint $endpoint returned 200"
                TESTS_PASSED=$((TESTS_PASSED + 1))
            else
                log_warn "Health endpoint $endpoint returned $response"
            fi
        done
    else
        log_warn "Could not determine APISIX endpoint for health checks"
    fi
}

# Check persistent volumes
check_persistent_volumes() {
    log_info "Checking persistent volume claims..."
    
    local pvcs=$(kubectl get pvc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$pvcs" ]; then
        for pvc in $pvcs; do
            local status=$(kubectl get pvc "$pvc" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
            
            if [ "$status" == "Bound" ]; then
                log_pass "PVC $pvc is bound"
                TESTS_PASSED=$((TESTS_PASSED + 1))
            else
                log_fail "PVC $pvc is not bound (status: $status)"
                TESTS_FAILED=$((TESTS_FAILED + 1))
            fi
        done
    else
        log_info "No PVCs found in namespace"
    fi
}

# Check network policies
check_network_policies() {
    log_info "Checking network policies..."
    
    local policies=$(kubectl get networkpolicies -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$policies" ]; then
        for policy in $policies; do
            log_pass "Network policy $policy is applied"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        done
    else
        log_warn "No network policies found - consider adding network policies for production"
    fi
}

# Check secrets
check_secrets() {
    log_info "Checking secrets..."
    
    local required_secrets=(
        "postgres-credentials"
        "redis-credentials"
        "jwt-secret"
    )
    
    for secret in "${required_secrets[@]}"; do
        if kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            log_pass "Secret $secret exists"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            log_warn "Secret $secret not found (may need to be created)"
        fi
    done
}

# Check resource usage
check_resources() {
    log_info "Checking resource usage..."
    
    echo ""
    kubectl top pods -n "$NAMESPACE" 2>/dev/null || log_warn "Metrics server not available"
    echo ""
}

# Main verification
main() {
    echo "=============================================="
    echo "Payment Switch Platform - Kubernetes Verify"
    echo "=============================================="
    echo ""
    
    log_info "Namespace: $NAMESPACE"
    echo ""
    
    check_deployments
    echo ""
    
    check_pods
    echo ""
    
    check_services
    echo ""
    
    check_persistent_volumes
    echo ""
    
    check_network_policies
    echo ""
    
    check_secrets
    echo ""
    
    check_health_endpoints
    echo ""
    
    check_resources
    
    echo "=============================================="
    echo "Verification Results"
    echo "=============================================="
    echo ""
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -gt 0 ]; then
        log_error "Some verifications failed. Check the output above for details."
        exit 1
    else
        log_info "All verifications passed!"
        exit 0
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace|-n)
            export NAMESPACE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --namespace, -n     Kubernetes namespace (default: payment-switch)"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
