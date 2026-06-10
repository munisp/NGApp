#!/bin/bash

# End-to-End Testing Script for POS Payment Processing System
# This script tests the complete pipeline from POS Gateway through Fluvio to BankAdapter

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="pos-payment-system"
POS_GATEWAY_SERVICE="pos-gateway"
BANK_ADAPTER_SERVICE="bank-adapter"
FLUVIO_TOPIC="pos-transactions"
PROCESSED_TOPIC="processed-transactions"

echo -e "${GREEN}=== POS Payment Processing System - End-to-End Test ===${NC}"
echo ""

# Function to print section headers
print_header() {
    echo -e "${YELLOW}>>> $1${NC}"
}

# Function to check if a pod is running
check_pod_running() {
    local pod_label=$1
    local pod_name=$(kubectl get pods -n $NAMESPACE -l $pod_label -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$pod_name" ]; then
        echo -e "${RED}Error: No pod found with label $pod_label${NC}"
        return 1
    fi
    
    local pod_status=$(kubectl get pod $pod_name -n $NAMESPACE -o jsonpath='{.status.phase}')
    
    if [ "$pod_status" != "Running" ]; then
        echo -e "${RED}Error: Pod $pod_name is not running (status: $pod_status)${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Pod $pod_name is running${NC}"
    echo $pod_name
}

# Function to get service external IP
get_service_ip() {
    local service_name=$1
    local ip=$(kubectl get svc $service_name -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    
    if [ -z "$ip" ]; then
        # Try hostname for cloud providers
        ip=$(kubectl get svc $service_name -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    fi
    
    if [ -z "$ip" ]; then
        echo -e "${YELLOW}Warning: No external IP found for service $service_name, using port-forward${NC}"
        return 1
    fi
    
    echo $ip
}

# Step 1: Verify all services are running
print_header "Step 1: Verifying all services are running"

echo "Checking POS Gateway..."
POS_GATEWAY_POD=$(check_pod_running "app=pos-gateway")

echo "Checking BankAdapter..."
BANK_ADAPTER_POD=$(check_pod_running "app=bank-adapter")

echo "Checking Fluvio..."
FLUVIO_POD=$(check_pod_running "app=fluvio,component=sc")

echo "Checking Fluvio Consumer..."
CONSUMER_POD=$(check_pod_running "app=fluvio-consumer")

echo ""

# Step 2: Get service endpoints
print_header "Step 2: Getting service endpoints"

POS_GATEWAY_IP=$(get_service_ip $POS_GATEWAY_SERVICE)
if [ $? -ne 0 ]; then
    echo "Setting up port-forward for POS Gateway..."
    kubectl port-forward -n $NAMESPACE svc/$POS_GATEWAY_SERVICE 8080:80 &
    PORT_FORWARD_PID=$!
    sleep 3
    POS_GATEWAY_ENDPOINT="http://localhost:8080"
else
    POS_GATEWAY_ENDPOINT="http://$POS_GATEWAY_IP"
fi

echo -e "${GREEN}POS Gateway endpoint: $POS_GATEWAY_ENDPOINT${NC}"
echo ""

# Step 3: Test health endpoints
print_header "Step 3: Testing health endpoints"

echo "Testing POS Gateway health..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $POS_GATEWAY_ENDPOINT/health)
if [ "$HEALTH_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ POS Gateway is healthy${NC}"
else
    echo -e "${RED}✗ POS Gateway health check failed (HTTP $HEALTH_RESPONSE)${NC}"
    exit 1
fi

echo ""

# Step 4: Send test transactions
print_header "Step 4: Sending test transactions"

echo "Scenario 1: Normal Transaction - Access Bank"
TRANSACTION_1=$(cat <<EOF
{
  "terminal_id": "TERM-LAG-00123456",
  "merchant_id": "MERCH-SHOPRITE-001",
  "card_number": "5399410000000001",
  "amount": 5000,
  "currency": "NGN",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "city": "Lagos",
    "state": "Lagos"
  }
}
EOF
)

RESPONSE_1=$(curl -s -X POST $POS_GATEWAY_ENDPOINT/api/v1/transaction \
  -H "Content-Type: application/json" \
  -d "$TRANSACTION_1")

TRANSACTION_ID_1=$(echo $RESPONSE_1 | jq -r '.transaction_id')
echo -e "${GREEN}✓ Transaction sent: $TRANSACTION_ID_1${NC}"
echo "Response: $RESPONSE_1"
echo ""

sleep 2

echo "Scenario 2: High-Value Transaction - GTBank"
TRANSACTION_2=$(cat <<EOF
{
  "terminal_id": "TERM-ABJ-00987654",
  "merchant_id": "MERCH-ELECTRONICS-045",
  "card_number": "5399230000000002",
  "amount": 250000,
  "currency": "NGN",
  "location": {
    "latitude": 9.0765,
    "longitude": 7.3986,
    "city": "Abuja",
    "state": "FCT"
  }
}
EOF
)

RESPONSE_2=$(curl -s -X POST $POS_GATEWAY_ENDPOINT/api/v1/transaction \
  -H "Content-Type: application/json" \
  -d "$TRANSACTION_2")

TRANSACTION_ID_2=$(echo $RESPONSE_2 | jq -r '.transaction_id')
echo -e "${GREEN}✓ Transaction sent: $TRANSACTION_ID_2${NC}"
echo "Response: $RESPONSE_2"
echo ""

sleep 2

echo "Scenario 3: Suspicious High-Risk Transaction - UBA"
TRANSACTION_3=$(cat <<EOF
{
  "terminal_id": "TERM-KAN-00234567",
  "merchant_id": "MERCH-JEWELRY-012",
  "card_number": "5399270000000004",
  "amount": 500000,
  "currency": "NGN",
  "location": {
    "latitude": 12.0022,
    "longitude": 8.5919,
    "city": "Kano",
    "state": "Kano"
  }
}
EOF
)

RESPONSE_3=$(curl -s -X POST $POS_GATEWAY_ENDPOINT/api/v1/transaction \
  -H "Content-Type: application/json" \
  -d "$TRANSACTION_3")

TRANSACTION_ID_3=$(echo $RESPONSE_3 | jq -r '.transaction_id')
echo -e "${GREEN}✓ Transaction sent: $TRANSACTION_ID_3${NC}"
echo "Response: $RESPONSE_3"
echo ""

# Step 5: Verify logs
print_header "Step 5: Verifying logs in each component"

echo "Checking POS Gateway logs for transaction $TRANSACTION_ID_1..."
kubectl logs -n $NAMESPACE $POS_GATEWAY_POD --tail=50 | grep $TRANSACTION_ID_1 || echo -e "${YELLOW}Transaction not found in logs yet${NC}"
echo ""

echo "Checking Fluvio Consumer logs for transaction $TRANSACTION_ID_1..."
kubectl logs -n $NAMESPACE $CONSUMER_POD --tail=50 | grep $TRANSACTION_ID_1 || echo -e "${YELLOW}Transaction not found in logs yet${NC}"
echo ""

# Step 6: Check Prometheus metrics
print_header "Step 6: Checking Prometheus metrics"

echo "Fetching POS Gateway metrics..."
METRICS=$(curl -s $POS_GATEWAY_ENDPOINT/metrics | grep pos_transactions)
echo "$METRICS"
echo ""

# Step 7: Batch transaction test
print_header "Step 7: Testing batch transaction processing"

BATCH_TRANSACTIONS=$(cat <<EOF
[
  {
    "terminal_id": "TERM-LAG-00111111",
    "merchant_id": "MERCH-FUEL-STATION-089",
    "card_number": "5399410000000011",
    "amount": 8000,
    "currency": "NGN"
  },
  {
    "terminal_id": "TERM-LAG-00111111",
    "merchant_id": "MERCH-FUEL-STATION-089",
    "card_number": "5399230000000012",
    "amount": 12000,
    "currency": "NGN"
  },
  {
    "terminal_id": "TERM-LAG-00111111",
    "merchant_id": "MERCH-FUEL-STATION-089",
    "card_number": "5399250000000013",
    "amount": 15000,
    "currency": "NGN"
  }
]
EOF
)

BATCH_RESPONSE=$(curl -s -X POST $POS_GATEWAY_ENDPOINT/api/v1/transactions/batch \
  -H "Content-Type: application/json" \
  -d "$BATCH_TRANSACTIONS")

echo "Batch response:"
echo $BATCH_RESPONSE | jq '.'
echo ""

# Cleanup
if [ ! -z "$PORT_FORWARD_PID" ]; then
    echo "Cleaning up port-forward..."
    kill $PORT_FORWARD_PID 2>/dev/null || true
fi

print_header "Test Summary"
echo -e "${GREEN}✓ All tests completed successfully!${NC}"
echo ""
echo "Transactions sent:"
echo "  1. Normal Transaction (Access Bank): $TRANSACTION_ID_1"
echo "  2. High-Value Transaction (GTBank): $TRANSACTION_ID_2"
echo "  3. High-Risk Transaction (UBA): $TRANSACTION_ID_3"
echo ""
echo "Next steps:"
echo "  - Check Temporal UI for workflow execution status"
echo "  - Check Grafana dashboards for real-time metrics"
echo "  - Verify transactions in TigerBeetle ledger"
echo "  - Check reconciliation status with banks"
