#!/usr/bin/env bash
# =============================================================================
# Vault Initialization Script — Unified Insurance Platform
# Configures all secret paths, auth methods, and policies for all 54 services
# Run once after Vault cluster is initialized and unsealed
# =============================================================================
set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-https://vault.vault.svc.cluster.local:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"  # Root token from vault operator init

export VAULT_ADDR VAULT_TOKEN VAULT_SKIP_VERIFY=false
export VAULT_CACERT="/vault/tls/ca.crt"

echo "==> Enabling audit logging"
vault audit enable file file_path=/vault/logs/audit.log

echo "==> Enabling secret engines"
vault secrets enable -path=insurance/platform kv-v2
vault secrets enable -path=insurance/infra    kv-v2
vault secrets enable -path=insurance/pki      pki
vault secrets enable -path=insurance/transit  transit
vault secrets enable database

echo "==> Configuring PKI engine for internal CA"
vault secrets tune -max-lease-ttl=87600h insurance/pki
vault write insurance/pki/root/generate/internal \
  common_name="insurance-platform.internal" \
  ttl=87600h
vault write insurance/pki/config/urls \
  issuing_certificates="${VAULT_ADDR}/v1/insurance/pki/ca" \
  crl_distribution_points="${VAULT_ADDR}/v1/insurance/pki/crl"

echo "==> Configuring Transit engine for PII encryption"
vault write insurance/transit/keys/pii-encryption type=aes256-gcm96
vault write insurance/transit/keys/policy-data   type=aes256-gcm96
vault write insurance/transit/keys/claim-data    type=aes256-gcm96
vault write insurance/transit/keys/payment-data  type=aes256-gcm96

echo "==> Configuring database secret engine — PostgreSQL"
vault write database/config/insurance-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="*" \
  connection_url="postgresql://{{username}}:{{password}}@postgres-ha.postgres.svc.cluster.local:5432/insurance?sslmode=require" \
  username="vault-admin" \
  password="${POSTGRES_VAULT_PASSWORD}"

# Dynamic role for each service
for SERVICE in \
  openimis-consumer claims-producer underwriting-risk-integrator \
  unified-analytics etherisc-gif cession-management reinsurance-accounting \
  payment-service insurance-radar customer-portal; do
  vault write database/roles/${SERVICE} \
    db_name=insurance-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"
done

echo "==> Writing platform secrets"
# Kafka
vault kv put insurance/infra/kafka \
  bootstrap_servers="kafka-0.kafka.svc.cluster.local:9092,kafka-1.kafka.svc.cluster.local:9092,kafka-2.kafka.svc.cluster.local:9092" \
  sasl_username="insurance-platform" \
  sasl_password="${KAFKA_SASL_PASSWORD}" \
  ssl_ca_cert_path="/etc/ssl/certs/kafka-ca.crt"

# Redis
vault kv put insurance/infra/redis \
  host="redis-ha.redis.svc.cluster.local" \
  port="6379" \
  password="${REDIS_PASSWORD}" \
  tls_enabled="true"

# Keycloak
vault kv put insurance/infra/keycloak \
  url="https://keycloak.keycloak.svc.cluster.local:8443" \
  realm="insurance" \
  client_id="insurance-platform" \
  client_secret="${KEYCLOAK_CLIENT_SECRET}" \
  admin_username="admin" \
  admin_password="${KEYCLOAK_ADMIN_PASSWORD}"

# TigerBeetle
vault kv put insurance/infra/tigerbeetle \
  cluster_id="0" \
  addresses="tigerbeetle-0.tigerbeetle.svc.cluster.local:3000,tigerbeetle-1.tigerbeetle.svc.cluster.local:3000,tigerbeetle-2.tigerbeetle.svc.cluster.local:3000"

# Temporal
vault kv put insurance/infra/temporal \
  host="temporal-frontend.temporal.svc.cluster.local" \
  port="7233" \
  namespace="insurance-platform" \
  tls_cert_path="/etc/ssl/certs/temporal-client.crt" \
  tls_key_path="/etc/ssl/private/temporal-client.key"

# APISIX
vault kv put insurance/infra/apisix \
  admin_key="${APISIX_ADMIN_KEY}" \
  admin_url="http://apisix-admin.apisix.svc.cluster.local:9180"

# Permify
vault kv put insurance/infra/permify \
  host="permify.permify.svc.cluster.local" \
  port="3476" \
  tenant_id="insurance-platform"

# Dapr
vault kv put insurance/infra/dapr \
  state_store="redis-state" \
  pubsub="kafka-pubsub" \
  secret_store="vault-secret-store"

# OpenIMIS
vault kv put insurance/platform/openimis \
  base_url="${OPENIMIS_BASE_URL}" \
  api_key="${OPENIMIS_API_KEY}" \
  graphql_url="${OPENIMIS_GRAPHQL_URL}"

# Payment service
vault kv put insurance/platform/payment \
  service_wallet_id="${PAYMENT_SERVICE_WALLET_ID}" \
  crypto_currency="${PAYMENT_CRYPTO_CURRENCY:-USDC}" \
  stripe_api_key="${STRIPE_API_KEY}" \
  flutterwave_secret_key="${FLUTTERWAVE_SECRET_KEY}"

# Etherisc
vault kv put insurance/platform/etherisc \
  gif_contract_address="${GIF_CONTRACT_ADDRESS}" \
  rpc_url="${ETHEREUM_RPC_URL}" \
  deployer_private_key="${DEPLOYER_PRIVATE_KEY}"

# Unleash
vault kv put insurance/infra/unleash \
  url="http://unleash.unleash.svc.cluster.local:4242" \
  api_token="${UNLEASH_API_TOKEN}"

echo "==> Enabling Kubernetes auth"
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc.cluster.local:443" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

echo "==> Creating Vault policies for each service"
# Policy template function
create_policy() {
  local SERVICE=$1
  local PATHS=$2
  vault policy write ${SERVICE} - <<EOF
path "insurance/platform/${SERVICE}/*" {
  capabilities = ["read", "list"]
}
path "insurance/infra/*" {
  capabilities = ["read"]
}
path "database/creds/${SERVICE}" {
  capabilities = ["read"]
}
path "insurance/transit/encrypt/pii-encryption" {
  capabilities = ["update"]
}
path "insurance/transit/decrypt/pii-encryption" {
  capabilities = ["update"]
}
${PATHS}
EOF
}

create_policy "openimis-consumer"             ""
create_policy "claims-producer"               ""
create_policy "underwriting-risk-integrator"  ""
create_policy "unified-analytics"             ""
create_policy "etherisc-gif"                  'path "insurance/platform/etherisc/*" { capabilities = ["read"] }'
create_policy "cession-management"            ""
create_policy "reinsurance-accounting"        ""
create_policy "payment-service"               'path "insurance/platform/payment/*" { capabilities = ["read"] }'
create_policy "insurance-radar"               ""
create_policy "customer-portal"               ""

# Admin policy
vault policy write platform-admin - <<'EOF'
path "insurance/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
EOF

echo "==> Binding Kubernetes service accounts to Vault roles"
for SERVICE in \
  openimis-consumer claims-producer underwriting-risk-integrator \
  unified-analytics etherisc-gif cession-management reinsurance-accounting \
  payment-service insurance-radar customer-portal; do
  vault write auth/kubernetes/role/${SERVICE} \
    bound_service_account_names="${SERVICE}" \
    bound_service_account_namespaces="insurance-platform" \
    policies="${SERVICE}" \
    ttl="1h"
done

echo "==> Vault initialization complete"
