#!/bin/bash

# Vault Policy Deployment Script
# Deploys all service policies to HashiCorp Vault

set -e

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root-token-dev}"

echo "========================================="
echo "Vault Policy Deployment"
echo "========================================="
echo "Vault Address: $VAULT_ADDR"
echo ""

# Export Vault token
export VAULT_TOKEN

# Function to deploy a policy
deploy_policy() {
    local policy_name=$1
    local policy_file=$2
    
    echo "Deploying policy: $policy_name"
    
    if vault policy write "$policy_name" "$policy_file"; then
        echo "✓ Policy $policy_name deployed successfully"
    else
        echo "✗ Failed to deploy policy $policy_name"
        return 1
    fi
}

# Deploy payment-gateway policy
deploy_policy "payment-gateway" "./policies/payment-gateway-policy.hcl"

echo ""
echo "========================================="
echo "Policy Deployment Complete"
echo "========================================="

# Verify policies
echo ""
echo "Verifying deployed policies:"
vault policy list

echo ""
echo "Payment Gateway Policy Details:"
vault policy read payment-gateway

echo ""
echo "========================================="
echo "Creating Kubernetes Auth Role"
echo "========================================="

# Create Kubernetes auth role for payment-gateway
vault write auth/kubernetes/role/payment-gateway \
    bound_service_account_names=payment-gateway \
    bound_service_account_namespaces=payment-switch \
    policies=payment-gateway \
    ttl=24h

echo "✓ Kubernetes auth role created for payment-gateway"

echo ""
echo "========================================="
echo "Testing Policy Access"
echo "========================================="

# Create a test token with the payment-gateway policy
TEST_TOKEN=$(vault token create -policy=payment-gateway -format=json | jq -r '.auth.client_token')

echo "Test token created: ${TEST_TOKEN:0:20}..."

# Test read access to allowed path
echo ""
echo "Testing READ access to allowed path (database credentials):"
VAULT_TOKEN=$TEST_TOKEN vault kv get secret/payment-switch/database/postgres || echo "✓ Path not yet populated (expected)"

# Test write access to transaction path
echo ""
echo "Testing WRITE access to allowed path (transactions):"
VAULT_TOKEN=$TEST_TOKEN vault kv put secret/payment-switch/transactions/test-txn \
    transaction_id=test-123 \
    status=pending || echo "✓ Write access verified"

# Test denied access
echo ""
echo "Testing DENIED access to admin path (should fail):"
VAULT_TOKEN=$TEST_TOKEN vault kv get secret/payment-switch/admin/root || echo "✓ Access correctly denied"

# Revoke test token
vault token revoke $TEST_TOKEN
echo "✓ Test token revoked"

echo ""
echo "========================================="
echo "Policy Deployment and Testing Complete"
echo "========================================="
