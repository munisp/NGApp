#!/bin/sh
set -e

echo "Initializing Keycloak realm..."

# Wait for Keycloak to be ready
echo "Waiting for Keycloak to be ready..."
until curl -sf http://keycloak:8080/health/ready > /dev/null 2>&1; do
  echo "Waiting for Keycloak..."
  sleep 5
done
echo "Keycloak is ready!"

# Get admin token
echo "Getting admin token..."
ADMIN_TOKEN=$(curl -s -X POST "http://keycloak:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" \
  -d "password=admin_secure_password_2026" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Failed to get admin token"
  exit 1
fi

echo "Admin token obtained"

# Import realm configuration
echo "Importing realm configuration..."
curl -X POST "http://keycloak:8080/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/keycloak/realm-config.json

echo "Keycloak realm initialized successfully!"
