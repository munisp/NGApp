#!/bin/bash
# Keycloak Setup Script for KYC/KYB System
# This script configures Keycloak realm, roles, users, and clients

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="kyc-kyb-system"

echo "========================================="
echo "Keycloak Setup for KYC/KYB System"
echo "========================================="
echo "Keycloak URL: $KEYCLOAK_URL"
echo "Realm: $REALM_NAME"
echo ""

# Function to get admin token
get_admin_token() {
    echo "Getting admin token..."
    TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=$ADMIN_USER" \
        -d "password=$ADMIN_PASSWORD" \
        -d 'grant_type=password' \
        -d 'client_id=admin-cli' | jq -r '.access_token')
    
    if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
        echo "Error: Failed to get admin token"
        exit 1
    fi
    echo "Admin token obtained successfully"
}

# Function to create realm
create_realm() {
    echo "Creating realm: $REALM_NAME..."
    curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d @realm-config.json
    echo "Realm created successfully"
}

# Function to create roles
create_roles() {
    echo "Creating roles..."
    
    # System Administrator
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "system_administrator",
            "description": "Full system access for platform administrators"
        }'
    
    # Compliance Officer
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "compliance_officer",
            "description": "Regulatory compliance and AML oversight"
        }'
    
    # KYC Analyst
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "kyc_analyst",
            "description": "Identity verification and document review"
        }'
    
    # Risk Manager
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "risk_manager",
            "description": "Risk assessment and decision making"
        }'
    
    # KYC Operator
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "kyc_operator",
            "description": "Basic operational tasks (read-only)"
        }'
    
    echo "Roles created successfully"
}

# Function to create test users
create_test_users() {
    echo "Creating test users..."
    
    # Admin User
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "admin",
            "email": "admin@insurance.com",
            "firstName": "System",
            "lastName": "Administrator",
            "enabled": true,
            "emailVerified": true,
            "attributes": {
                "organization_id": ["org_insurance_co"]
            },
            "credentials": [{
                "type": "password",
                "value": "admin123",
                "temporary": false
            }],
            "realmRoles": ["system_administrator"]
        }'
    
    # Compliance Officer
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "compliance",
            "email": "compliance@insurance.com",
            "firstName": "Jane",
            "lastName": "Compliance",
            "enabled": true,
            "emailVerified": true,
            "attributes": {
                "organization_id": ["org_insurance_co"]
            },
            "credentials": [{
                "type": "password",
                "value": "compliance123",
                "temporary": false
            }],
            "realmRoles": ["compliance_officer"]
        }'
    
    # KYC Analyst
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "kyc_analyst",
            "email": "kyc@insurance.com",
            "firstName": "John",
            "lastName": "Analyst",
            "enabled": true,
            "emailVerified": true,
            "attributes": {
                "organization_id": ["org_insurance_co"]
            },
            "credentials": [{
                "type": "password",
                "value": "kyc123",
                "temporary": false
            }],
            "realmRoles": ["kyc_analyst"]
        }'
    
    # Risk Manager
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "risk_manager",
            "email": "risk@insurance.com",
            "firstName": "Alice",
            "lastName": "Risk",
            "enabled": true,
            "emailVerified": true,
            "attributes": {
                "organization_id": ["org_insurance_co"]
            },
            "credentials": [{
                "type": "password",
                "value": "risk123",
                "temporary": false
            }],
            "realmRoles": ["risk_manager"]
        }'
    
    # KYC Operator
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "operator",
            "email": "operator@insurance.com",
            "firstName": "Bob",
            "lastName": "Operator",
            "enabled": true,
            "emailVerified": true,
            "attributes": {
                "organization_id": ["org_insurance_co"]
            },
            "credentials": [{
                "type": "password",
                "value": "operator123",
                "temporary": false
            }],
            "realmRoles": ["kyc_operator"]
        }'
    
    echo "Test users created successfully"
}

# Function to create clients
create_clients() {
    echo "Creating clients..."
    
    # Liveness Service Client
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "clientId": "liveness-service",
            "name": "Liveness Detection Service",
            "enabled": true,
            "bearerOnly": true,
            "publicClient": false,
            "serviceAccountsEnabled": true,
            "standardFlowEnabled": true,
            "directAccessGrantsEnabled": true,
            "protocol": "openid-connect"
        }'
    
    # AML Screening Service Client
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "clientId": "aml-screening-service",
            "name": "AML Screening Service",
            "enabled": true,
            "bearerOnly": true,
            "publicClient": false,
            "serviceAccountsEnabled": true,
            "standardFlowEnabled": true,
            "directAccessGrantsEnabled": true,
            "protocol": "openid-connect"
        }'
    
    # Risk Scoring Service Client
    curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "clientId": "risk-scoring-service",
            "name": "Risk Scoring Service",
            "enabled": true,
            "bearerOnly": true,
            "publicClient": false,
            "serviceAccountsEnabled": true,
            "standardFlowEnabled": true,
            "directAccessGrantsEnabled": true,
            "protocol": "openid-connect"
        }'
    
    echo "Clients created successfully"
}

# Main execution
main() {
    get_admin_token
    create_realm
    create_roles
    create_test_users
    create_clients
    
    echo ""
    echo "========================================="
    echo "Keycloak setup completed successfully!"
    echo "========================================="
    echo ""
    echo "Test Users Created:"
    echo "  Admin:           admin / admin123"
    echo "  Compliance:      compliance / compliance123"
    echo "  KYC Analyst:     kyc_analyst / kyc123"
    echo "  Risk Manager:    risk_manager / risk123"
    echo "  KYC Operator:    operator / operator123"
    echo ""
    echo "Realm: $REALM_NAME"
    echo "Keycloak URL: $KEYCLOAK_URL"
    echo ""
}

main
