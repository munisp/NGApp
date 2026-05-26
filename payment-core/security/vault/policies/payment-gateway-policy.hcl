# HashiCorp Vault Policy: payment-gateway
# Service: Transaction Processing Service (Payment Gateway)
# Purpose: Least-privilege access for payment transaction processing
# Last Updated: 2024-11-03

# =============================================================================
# Database Credentials
# =============================================================================
# Read-only access to PostgreSQL database credentials
path "secret/data/payment-switch/database/postgres" {
  capabilities = ["read"]
}

# =============================================================================
# External API Keys
# =============================================================================
# Read-only access to payment processor API keys
path "secret/data/payment-switch/api-keys/payment-processor" {
  capabilities = ["read"]
}

# Read-only access to fraud detection API keys
path "secret/data/payment-switch/api-keys/fraud-detection" {
  capabilities = ["read"]
}

# Read-only access to notification service API keys
path "secret/data/payment-switch/api-keys/notification" {
  capabilities = ["read"]
}

# =============================================================================
# Encryption Keys
# =============================================================================
# Read-only access to data encryption keys for PCI DSS compliance
path "secret/data/payment-switch/encryption/data-encryption-key" {
  capabilities = ["read"]
}

# Read-only access to PAN (Primary Account Number) tokenization keys
path "secret/data/payment-switch/encryption/pan-tokenization-key" {
  capabilities = ["read"]
}

# =============================================================================
# Redis Credentials
# =============================================================================
# Read-only access to Redis cache credentials
path "secret/data/payment-switch/cache/redis" {
  capabilities = ["read"]
}

# =============================================================================
# Temporal Workflow Credentials
# =============================================================================
# Read-only access to Temporal workflow engine credentials
path "secret/data/payment-switch/workflow/temporal" {
  capabilities = ["read"]
}

# =============================================================================
# Service-to-Service Authentication
# =============================================================================
# Read-only access to JWT signing keys for service authentication
path "secret/data/payment-switch/auth/jwt-signing-key" {
  capabilities = ["read"]
}

# Read-only access to mTLS certificates (if not using cert-manager)
path "secret/data/payment-switch/tls/payment-gateway" {
  capabilities = ["read"]
}

# =============================================================================
# Transaction Metadata
# =============================================================================
# Read/write access to transaction-specific temporary secrets
# (e.g., one-time tokens, session keys)
path "secret/data/payment-switch/transactions/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# =============================================================================
# Audit and Logging
# =============================================================================
# Read-only access to logging service credentials
path "secret/data/payment-switch/logging/elk-credentials" {
  capabilities = ["read"]
}

# =============================================================================
# DENIED PATHS (Explicit Denials for Defense in Depth)
# =============================================================================
# Deny access to other services' secrets
path "secret/data/payment-switch/services/fraud-detection/*" {
  capabilities = ["deny"]
}

path "secret/data/payment-switch/services/settlement/*" {
  capabilities = ["deny"]
}

path "secret/data/payment-switch/services/offline-payments/*" {
  capabilities = ["deny"]
}

# Deny access to master encryption keys (only key management service should access)
path "secret/data/payment-switch/master-keys/*" {
  capabilities = ["deny"]
}

# Deny access to admin credentials
path "secret/data/payment-switch/admin/*" {
  capabilities = ["deny"]
}

# Deny access to Vault root tokens
path "auth/token/create-root" {
  capabilities = ["deny"]
}

# =============================================================================
# Token Management
# =============================================================================
# Allow the service to renew its own token
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow the service to lookup its own token
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Deny the service from creating new tokens
path "auth/token/create" {
  capabilities = ["deny"]
}

# =============================================================================
# Metadata Access
# =============================================================================
# Allow listing of accessible secret paths (for discovery)
path "secret/metadata/payment-switch/database/*" {
  capabilities = ["list"]
}

path "secret/metadata/payment-switch/api-keys/*" {
  capabilities = ["list"]
}

path "secret/metadata/payment-switch/encryption/*" {
  capabilities = ["list"]
}

# =============================================================================
# Transit Engine (for encryption-as-a-service)
# =============================================================================
# Allow encryption and decryption operations for sensitive data
path "transit/encrypt/payment-data" {
  capabilities = ["update"]
}

path "transit/decrypt/payment-data" {
  capabilities = ["update"]
}

# Allow data key generation for envelope encryption
path "transit/datakey/plaintext/payment-data" {
  capabilities = ["update"]
}

# Deny key rotation (only admin should rotate keys)
path "transit/keys/payment-data/rotate" {
  capabilities = ["deny"]
}

# =============================================================================
# PKI Engine (for certificate management)
# =============================================================================
# Allow the service to request new certificates
path "pki/issue/payment-gateway" {
  capabilities = ["create", "update"]
}

# Allow the service to revoke its own certificates
path "pki/revoke" {
  capabilities = ["update"]
}

# =============================================================================
# Dynamic Database Credentials
# =============================================================================
# Allow the service to request dynamic database credentials
path "database/creds/payment-gateway-role" {
  capabilities = ["read"]
}

# =============================================================================
# Policy Summary
# =============================================================================
# This policy grants the payment-gateway service:
# 
# READ ACCESS:
# - Database credentials (PostgreSQL)
# - External API keys (payment processor, fraud detection, notification)
# - Encryption keys (data encryption, PAN tokenization)
# - Cache credentials (Redis)
# - Workflow credentials (Temporal)
# - Service authentication keys (JWT, mTLS)
# - Logging credentials (ELK Stack)
#
# READ/WRITE ACCESS:
# - Transaction-specific temporary secrets
# - Transit encryption/decryption operations
# - PKI certificate issuance and revocation
# - Dynamic database credentials
#
# DENIED ACCESS:
# - Other services' secrets
# - Master encryption keys
# - Admin credentials
# - Vault root tokens
# - Token creation
# - Key rotation
#
# This follows the principle of least privilege, granting only the minimum
# permissions necessary for the payment-gateway service to function.
