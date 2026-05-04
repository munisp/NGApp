# HashiCorp Vault Access Policy Documentation
## Transaction Processing Service (Payment Gateway)

**Service**: `payment-gateway`  
**Policy Name**: `payment-gateway`  
**Last Updated**: November 3, 2024  
**Security Level**: High (PCI DSS Compliant)

---

## Executive Summary

This document describes the HashiCorp Vault access policy for the Transaction Processing Service (Payment Gateway) microservice in the Next-Generation Payment Switch platform. The policy implements **least-privilege access** principles, granting only the minimum permissions necessary for the service to process payment transactions securely.

The policy has been designed to comply with **PCI DSS requirements** for secure handling of payment card data and follows industry best practices for secrets management and access control.

---

## Policy Overview

The `payment-gateway` policy defines fine-grained access controls for the following categories of secrets:

| Category | Access Level | Justification |
|----------|--------------|---------------|
| Database Credentials | Read-Only | Service needs to connect to PostgreSQL |
| External API Keys | Read-Only | Service integrates with payment processors and fraud detection |
| Encryption Keys | Read-Only | Service encrypts sensitive payment data (PCI DSS requirement) |
| Cache Credentials | Read-Only | Service uses Redis for session management |
| Workflow Credentials | Read-Only | Service orchestrates payment workflows via Temporal |
| Service Authentication | Read-Only | Service authenticates with other microservices |
| Transaction Secrets | Read/Write | Service creates temporary secrets for transaction processing |
| Transit Encryption | Update | Service encrypts/decrypts payment data |
| PKI Certificates | Create/Update | Service requests and manages its own TLS certificates |
| Dynamic DB Credentials | Read | Service requests short-lived database credentials |

---

## Detailed Access Permissions

### 1. Database Credentials (Read-Only)

**Path**: `secret/data/payment-switch/database/postgres`  
**Capabilities**: `["read"]`

The payment-gateway service requires read access to PostgreSQL database credentials to:
- Establish connections to the payment database
- Execute transaction queries
- Store payment records

**Secrets Stored**:
```json
{
  "host": "postgres.payment-switch.svc.cluster.local",
  "port": "5432",
  "database": "paymentdb",
  "username": "payment_gateway_user",
  "password": "<encrypted>",
  "ssl_mode": "require"
}
```

---

### 2. External API Keys (Read-Only)

#### Payment Processor API
**Path**: `secret/data/payment-switch/api-keys/payment-processor`  
**Capabilities**: `["read"]`

Stores API keys for external payment processors (Stripe, PayPal, etc.):
```json
{
  "stripe_api_key": "sk_live_...",
  "stripe_webhook_secret": "whsec_...",
  "paypal_client_id": "...",
  "paypal_client_secret": "..."
}
```

#### Fraud Detection API
**Path**: `secret/data/payment-switch/api-keys/fraud-detection`  
**Capabilities**: `["read"]`

Stores API keys for fraud detection services:
```json
{
  "fraud_api_key": "...",
  "fraud_api_endpoint": "https://fraud-detection.internal"
}
```

#### Notification Service API
**Path**: `secret/data/payment-switch/api-keys/notification`  
**Capabilities**: `["read"]`

Stores API keys for notification services (SMS, email):
```json
{
  "twilio_account_sid": "...",
  "twilio_auth_token": "...",
  "sendgrid_api_key": "..."
}
```

---

### 3. Encryption Keys (Read-Only)

#### Data Encryption Key
**Path**: `secret/data/payment-switch/encryption/data-encryption-key`  
**Capabilities**: `["read"]`

**PCI DSS Requirement**: All sensitive payment data must be encrypted at rest and in transit.

Stores the data encryption key (DEK) for encrypting sensitive payment information:
```json
{
  "key_id": "dek-2024-001",
  "key_value": "<base64-encoded-256-bit-key>",
  "algorithm": "AES-256-GCM",
  "created_at": "2024-01-01T00:00:00Z",
  "rotation_schedule": "90 days"
}
```

#### PAN Tokenization Key
**Path**: `secret/data/payment-switch/encryption/pan-tokenization-key`  
**Capabilities**: `["read"]`

**PCI DSS Requirement**: Primary Account Numbers (PANs) must be tokenized or encrypted.

Stores the key for tokenizing credit card numbers:
```json
{
  "key_id": "pan-token-2024-001",
  "key_value": "<base64-encoded-256-bit-key>",
  "algorithm": "AES-256-SIV",
  "format": "FPE (Format-Preserving Encryption)"
}
```

---

### 4. Redis Cache Credentials (Read-Only)

**Path**: `secret/data/payment-switch/cache/redis`  
**Capabilities**: `["read"]`

Stores Redis credentials for session and cache management:
```json
{
  "host": "redis.payment-switch.svc.cluster.local",
  "port": "6379",
  "password": "<encrypted>",
  "tls_enabled": true,
  "database": "0"
}
```

---

### 5. Temporal Workflow Credentials (Read-Only)

**Path**: `secret/data/payment-switch/workflow/temporal`  
**Capabilities**: `["read"]`

Stores credentials for Temporal workflow engine:
```json
{
  "host": "temporal.payment-switch.svc.cluster.local",
  "port": "7233",
  "namespace": "payment-workflows",
  "tls_cert": "<base64-encoded-cert>",
  "tls_key": "<base64-encoded-key>"
}
```

---

### 6. Service-to-Service Authentication (Read-Only)

#### JWT Signing Key
**Path**: `secret/data/payment-switch/auth/jwt-signing-key`  
**Capabilities**: `["read"]`

Stores the JWT signing key for service-to-service authentication:
```json
{
  "key_id": "jwt-signing-2024-001",
  "algorithm": "RS256",
  "private_key": "<PEM-encoded-RSA-private-key>",
  "public_key": "<PEM-encoded-RSA-public-key>",
  "expiration": "15m"
}
```

#### mTLS Certificates
**Path**: `secret/data/payment-switch/tls/payment-gateway`  
**Capabilities**: `["read"]`

Stores mTLS certificates (if not using cert-manager):
```json
{
  "cert": "<PEM-encoded-certificate>",
  "key": "<PEM-encoded-private-key>",
  "ca_cert": "<PEM-encoded-CA-certificate>",
  "expiration": "2025-01-01T00:00:00Z"
}
```

---

### 7. Transaction Metadata (Read/Write)

**Path**: `secret/data/payment-switch/transactions/*`  
**Capabilities**: `["create", "read", "update", "delete"]`

**Justification**: The payment-gateway service needs to create temporary secrets for transaction processing, such as:
- One-time payment tokens
- Session keys for 3D Secure authentication
- Temporary encryption keys for specific transactions

**Example**:
```json
{
  "transaction_id": "txn_abc123",
  "one_time_token": "ott_xyz789",
  "session_key": "<base64-encoded-key>",
  "expires_at": "2024-11-03T21:30:00Z"
}
```

**Lifecycle**: These secrets are automatically deleted after transaction completion or expiration.

---

### 8. Audit and Logging (Read-Only)

**Path**: `secret/data/payment-switch/logging/elk-credentials`  
**Capabilities**: `["read"]`

Stores credentials for the ELK Stack logging service:
```json
{
  "elasticsearch_url": "https://elasticsearch.logging.svc.cluster.local:9200",
  "username": "payment_gateway_logger",
  "password": "<encrypted>",
  "index_pattern": "payment-gateway-*"
}
```

---

## Explicit Denials (Defense in Depth)

The policy explicitly denies access to sensitive paths to prevent privilege escalation:

### Other Services' Secrets
```hcl
path "secret/data/payment-switch/services/fraud-detection/*" {
  capabilities = ["deny"]
}

path "secret/data/payment-switch/services/settlement/*" {
  capabilities = ["deny"]
}
```

### Master Encryption Keys
```hcl
path "secret/data/payment-switch/master-keys/*" {
  capabilities = ["deny"]
}
```

### Admin Credentials
```hcl
path "secret/data/payment-switch/admin/*" {
  capabilities = ["deny"]
}
```

### Vault Root Tokens
```hcl
path "auth/token/create-root" {
  capabilities = ["deny"]
}
```

---

## Advanced Features

### Transit Engine (Encryption-as-a-Service)

The payment-gateway service can use Vault's Transit engine for encryption/decryption operations without directly accessing encryption keys:

**Encrypt Payment Data**:
```hcl
path "transit/encrypt/payment-data" {
  capabilities = ["update"]
}
```

**Decrypt Payment Data**:
```hcl
path "transit/decrypt/payment-data" {
  capabilities = ["update"]
}
```

**Generate Data Keys** (for envelope encryption):
```hcl
path "transit/datakey/plaintext/payment-data" {
  capabilities = ["update"]
}
```

**Example Usage**:
```bash
# Encrypt credit card number
vault write transit/encrypt/payment-data plaintext=$(base64 <<< "4111111111111111")

# Decrypt credit card number
vault write transit/decrypt/payment-data ciphertext="vault:v1:..."
```

---

### PKI Engine (Certificate Management)

The payment-gateway service can request and manage its own TLS certificates:

**Issue New Certificate**:
```hcl
path "pki/issue/payment-gateway" {
  capabilities = ["create", "update"]
}
```

**Revoke Certificate**:
```hcl
path "pki/revoke" {
  capabilities = ["update"]
}
```

**Example Usage**:
```bash
# Request new certificate
vault write pki/issue/payment-gateway \
  common_name=payment-gateway.payment-switch.svc.cluster.local \
  ttl=720h
```

---

### Dynamic Database Credentials

The payment-gateway service can request short-lived database credentials:

**Request Dynamic Credentials**:
```hcl
path "database/creds/payment-gateway-role" {
  capabilities = ["read"]
}
```

**Example Usage**:
```bash
# Request dynamic credentials (valid for 1 hour)
vault read database/creds/payment-gateway-role
```

**Output**:
```json
{
  "username": "v-payment-gateway-abc123",
  "password": "A1b2C3d4E5f6...",
  "lease_duration": 3600
}
```

---

## Token Management

The payment-gateway service can manage its own authentication token:

**Renew Token**:
```hcl
path "auth/token/renew-self" {
  capabilities = ["update"]
}
```

**Lookup Token**:
```hcl
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
```

**Denied: Create New Tokens**:
```hcl
path "auth/token/create" {
  capabilities = ["deny"]
}
```

---

## Kubernetes Integration

The payment-gateway service authenticates to Vault using Kubernetes service account:

**Kubernetes Auth Role**:
```bash
vault write auth/kubernetes/role/payment-gateway \
    bound_service_account_names=payment-gateway \
    bound_service_account_namespaces=payment-switch \
    policies=payment-gateway \
    ttl=24h
```

**Service Account Configuration**:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: payment-gateway
  namespace: payment-switch
```

**Pod Annotation for Vault Agent Injection**:
```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "payment-gateway"
  vault.hashicorp.com/agent-inject-secret-database: "secret/data/payment-switch/database/postgres"
```

---

## Security Best Practices

### 1. Least Privilege
The policy grants only the minimum permissions necessary for the service to function. No wildcard permissions are used except for transaction-specific paths.

### 2. Explicit Denials
Sensitive paths are explicitly denied to prevent privilege escalation, even if future policy changes accidentally grant broader access.

### 3. Audit Logging
All Vault access is logged to the audit log for compliance and security monitoring.

### 4. Token TTL
Service tokens have a 24-hour TTL and must be renewed regularly to maintain access.

### 5. Dynamic Credentials
Where possible, the service uses dynamic credentials (database, certificates) that are automatically rotated.

### 6. Encryption-as-a-Service
The service uses Vault's Transit engine for encryption/decryption, ensuring encryption keys never leave Vault.

---

## Compliance

This policy supports compliance with the following standards:

| Standard | Requirement | Implementation |
|----------|-------------|----------------|
| **PCI DSS 3.2.1** | Requirement 3: Protect stored cardholder data | Encryption keys stored in Vault, Transit engine for encryption |
| **PCI DSS 3.2.1** | Requirement 7: Restrict access by business need to know | Least-privilege access, explicit denials |
| **PCI DSS 3.2.1** | Requirement 8: Identify and authenticate access | Kubernetes service account authentication |
| **PCI DSS 3.2.1** | Requirement 10: Track and monitor all access | Vault audit logging enabled |
| **SOC 2 Type II** | Access Control | Role-based access control, least privilege |
| **GDPR** | Data Protection | Encryption of personal data, access controls |

---

## Deployment

To deploy this policy to Vault:

```bash
# Navigate to the security directory
cd /home/ubuntu/nextgen-payment-switch/security/vault

# Deploy the policy
./deploy-policies.sh
```

The deployment script will:
1. Upload the policy to Vault
2. Create the Kubernetes auth role
3. Test the policy permissions
4. Verify access controls

---

## Testing

To verify the policy is working correctly:

```bash
# Create a test token with the payment-gateway policy
TEST_TOKEN=$(vault token create -policy=payment-gateway -format=json | jq -r '.auth.client_token')

# Test read access (should succeed)
VAULT_TOKEN=$TEST_TOKEN vault kv get secret/payment-switch/database/postgres

# Test denied access (should fail)
VAULT_TOKEN=$TEST_TOKEN vault kv get secret/payment-switch/admin/root

# Revoke test token
vault token revoke $TEST_TOKEN
```

---

## Monitoring and Auditing

All access to Vault by the payment-gateway service is logged in the Vault audit log:

```bash
# View audit log
vault audit list

# Example audit log entry
{
  "time": "2024-11-03T21:00:00Z",
  "type": "response",
  "auth": {
    "token_policies": ["payment-gateway"],
    "metadata": {
      "service_account_name": "payment-gateway",
      "service_account_namespace": "payment-switch"
    }
  },
  "request": {
    "operation": "read",
    "path": "secret/data/payment-switch/database/postgres"
  },
  "response": {
    "status": 200
  }
}
```

---

## Conclusion

The `payment-gateway` Vault policy implements a secure, least-privilege access model that:

✅ Grants only necessary permissions  
✅ Explicitly denies sensitive paths  
✅ Supports PCI DSS compliance  
✅ Enables dynamic credential management  
✅ Provides encryption-as-a-service  
✅ Integrates with Kubernetes authentication  
✅ Maintains comprehensive audit logs  

This policy ensures that the Transaction Processing Service can securely access the secrets it needs while preventing unauthorized access to sensitive data.

---

**Document Version**: 1.0  
**Last Updated**: November 3, 2024  
**Author**: Manus AI  
**Classification**: Internal Use Only
