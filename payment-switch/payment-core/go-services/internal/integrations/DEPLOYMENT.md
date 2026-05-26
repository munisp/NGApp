# Production Deployment Guide

This guide covers deploying the Payment Switch platform with real integrations to TigerBeetle, Mojaloop, Keycloak, and APISIX.

## Prerequisites

### Infrastructure Requirements

1. **TigerBeetle Cluster**
   - Minimum 3 replicas for production
   - Requires `io_uring` kernel support (Linux 5.1+)
   - Recommended: Dedicated NVMe storage for each replica
   - Memory: 8GB+ per replica
   - Network: Low-latency connections between replicas

2. **Mojaloop Hub**
   - Central Ledger Service
   - Account Lookup Service (ALS)
   - Quoting Service
   - ML API Adapter
   - MySQL/PostgreSQL database

3. **Keycloak**
   - Version 22.0+ recommended
   - PostgreSQL database backend
   - Configured realm for payment-switch

4. **APISIX**
   - Version 3.0+ recommended
   - etcd cluster for configuration storage
   - Admin API enabled with secure API key

### Environment Variables

```bash
# Environment
ENVIRONMENT=production

# TigerBeetle
TIGERBEETLE_ADDRESSES=tigerbeetle-0:3000,tigerbeetle-1:3000,tigerbeetle-2:3000
TIGERBEETLE_CLUSTER_ID=0
TIGERBEETLE_READ_TIMEOUT=30s
TIGERBEETLE_WRITE_TIMEOUT=30s

# Mojaloop
MOJALOOP_CENTRAL_LEDGER_URL=http://central-ledger:3001
MOJALOOP_ALS_URL=http://account-lookup-service:4002
MOJALOOP_QUOTING_URL=http://quoting-service:3002
MOJALOOP_ML_API_ADAPTER_URL=http://ml-api-adapter:3000
MOJALOOP_FSP_ID=paymentswitch
MOJALOOP_HUB_NAME=Hub
MOJALOOP_TIMEOUT=30s

# Keycloak
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=payment-switch
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=<secure-password>
KEYCLOAK_CLIENT_ID=admin-cli
KEYCLOAK_CLIENT_SECRET=<client-secret>

# APISIX
APISIX_ADMIN_URL=http://apisix:9180
APISIX_API_KEY=<secure-api-key>

# Health Check
HEALTH_CHECK_INTERVAL=30s
HEALTH_CHECK_TIMEOUT=10s

# Feature Flags
ENABLE_TIGERBEETLE=true
ENABLE_MOJALOOP=true
ENABLE_KEYCLOAK=true
ENABLE_APISIX=true
ENABLE_HEALTH_CHECK=true
SIMULATED_MODE=false
```

## Deployment Steps

### 1. Deploy TigerBeetle Cluster

```yaml
# kubernetes/tigerbeetle-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: tigerbeetle
spec:
  serviceName: tigerbeetle
  replicas: 3
  selector:
    matchLabels:
      app: tigerbeetle
  template:
    metadata:
      labels:
        app: tigerbeetle
    spec:
      containers:
      - name: tigerbeetle
        image: ghcr.io/tigerbeetle/tigerbeetle:latest
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: data
          mountPath: /var/lib/tigerbeetle
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-nvme
      resources:
        requests:
          storage: 100Gi
```

### 2. Deploy Mojaloop Hub

Follow the official Mojaloop deployment guide:
https://docs.mojaloop.io/documentation/deployment-guide/

Key services to deploy:
- central-ledger
- account-lookup-service
- quoting-service
- ml-api-adapter
- central-settlement

### 3. Deploy Keycloak

```yaml
# kubernetes/keycloak-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
spec:
  replicas: 2
  selector:
    matchLabels:
      app: keycloak
  template:
    metadata:
      labels:
        app: keycloak
    spec:
      containers:
      - name: keycloak
        image: quay.io/keycloak/keycloak:22.0
        args: ["start"]
        env:
        - name: KC_DB
          value: postgres
        - name: KC_DB_URL
          value: jdbc:postgresql://postgres:5432/keycloak
        - name: KC_DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: db-username
        - name: KC_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: db-password
        - name: KEYCLOAK_ADMIN
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: admin-username
        - name: KEYCLOAK_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: admin-password
        ports:
        - containerPort: 8080
```

### 4. Deploy APISIX

```yaml
# kubernetes/apisix-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apisix
spec:
  replicas: 3
  selector:
    matchLabels:
      app: apisix
  template:
    metadata:
      labels:
        app: apisix
    spec:
      containers:
      - name: apisix
        image: apache/apisix:3.6.0-debian
        ports:
        - containerPort: 9080  # HTTP
        - containerPort: 9443  # HTTPS
        - containerPort: 9180  # Admin API
        volumeMounts:
        - name: config
          mountPath: /usr/local/apisix/conf/config.yaml
          subPath: config.yaml
      volumes:
      - name: config
        configMap:
          name: apisix-config
```

### 5. Deploy Payment Switch

```yaml
# kubernetes/payment-switch-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-switch
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payment-switch
  template:
    metadata:
      labels:
        app: payment-switch
    spec:
      containers:
      - name: payment-switch
        image: payment-switch:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: payment-switch-config
        - secretRef:
            name: payment-switch-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Verification

### 1. Check Health Status

```bash
# Check overall health
curl http://payment-switch:8080/api/v1/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "tigerbeetle": {"status": "healthy", "latency_ms": 5},
    "mojaloop": {"status": "healthy", "latency_ms": 15},
    "keycloak": {"status": "healthy", "latency_ms": 10},
    "apisix": {"status": "healthy", "latency_ms": 3}
  }
}
```

### 2. Test Provisioning

```bash
# Provision a test participant
curl -X POST http://payment-switch:8080/api/v1/provisioning/participants \
  -H "Content-Type: application/json" \
  -d '{
    "participant_id": "test-bank",
    "participant_name": "Test Bank",
    "admin_email": "admin@testbank.com",
    "admin_password": "SecurePassword123!",
    "currency": "USD",
    "backend_host": "test-bank-backend",
    "backend_port": 8080,
    "mode": "production"
  }'

# Expected response:
{
  "participant_id": "test-bank",
  "status": "completed",
  "external_ids": {
    "keycloak_client_uuid": "abc123...",
    "apisix_upstream_id": "/apisix/upstreams/test-bank-upstream",
    "tigerbeetle_account_id": "12345678",
    "mojaloop_fsp_id": "test-bank"
  },
  "credentials": {
    "keycloak_client_id": "test-bank-client",
    "keycloak_client_secret": "...",
    "apisix_consumer_key": "test-bank-api-key"
  }
}
```

### 3. Verify External Resources

```bash
# Verify Keycloak client
curl -X GET "http://keycloak:8080/admin/realms/payment-switch/clients?clientId=test-bank-client" \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN"

# Verify APISIX route
curl -X GET "http://apisix:9180/apisix/admin/routes/test-bank-api" \
  -H "X-API-KEY: $APISIX_API_KEY"

# Verify TigerBeetle account (via payment-switch API)
curl http://payment-switch:8080/api/v1/accounts/12345678
```

## Monitoring

### Prometheus Metrics

The integration manager exposes Prometheus metrics at `/metrics`:

- `integration_health_check_duration_seconds` - Health check latency
- `integration_health_status` - Current health status (1=healthy, 0=unhealthy)
- `provisioning_duration_seconds` - Provisioning operation duration
- `provisioning_success_total` - Successful provisioning count
- `provisioning_failure_total` - Failed provisioning count

### Alerting Rules

```yaml
groups:
- name: payment-switch-integrations
  rules:
  - alert: TigerBeetleUnhealthy
    expr: integration_health_status{service="tigerbeetle"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: TigerBeetle is unhealthy
      
  - alert: MojaloopUnhealthy
    expr: integration_health_status{service="mojaloop"} == 0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: Mojaloop is unhealthy
      
  - alert: ProvisioningFailureRate
    expr: rate(provisioning_failure_total[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High provisioning failure rate
```

## Troubleshooting

### TigerBeetle Connection Issues

1. Check kernel supports io_uring: `cat /proc/sys/kernel/io_uring_disabled`
2. Verify network connectivity: `nc -zv tigerbeetle 3000`
3. Check TigerBeetle logs: `kubectl logs -l app=tigerbeetle`

### Mojaloop Integration Issues

1. Verify Central Ledger health: `curl http://central-ledger:3001/health`
2. Check participant registration: `curl http://central-ledger:3001/participants`
3. Verify ALS connectivity: `curl http://account-lookup-service:4002/health`

### Keycloak Issues

1. Check Keycloak health: `curl http://keycloak:8080/health/ready`
2. Verify realm exists: Check Keycloak admin console
3. Test token endpoint: `curl -X POST http://keycloak:8080/realms/payment-switch/protocol/openid-connect/token`

### APISIX Issues

1. Check APISIX status: `curl http://apisix:9180/apisix/status`
2. Verify etcd connectivity: Check APISIX logs
3. Test route: `curl http://apisix:9080/api/v1/health`

## Security Considerations

1. **Secrets Management**: Use Kubernetes secrets or external secrets manager (Vault, AWS Secrets Manager)
2. **Network Policies**: Restrict traffic between services
3. **TLS**: Enable TLS for all external communications
4. **API Keys**: Rotate API keys regularly
5. **Audit Logging**: Enable audit logging for all provisioning operations

## Rollback Procedure

If provisioning fails partway through:

1. The orchestrator automatically attempts rollback for production mode
2. Manual cleanup may be required for:
   - TigerBeetle accounts (cannot be deleted, only disabled)
   - Mojaloop participants (require manual removal)

```bash
# Manual cleanup commands
# Delete Keycloak resources
curl -X DELETE "http://keycloak:8080/admin/realms/payment-switch/users/$USER_ID" \
  -H "Authorization: Bearer $KEYCLOAK_TOKEN"

# Delete APISIX resources
curl -X DELETE "http://apisix:9180/apisix/admin/routes/$ROUTE_ID" \
  -H "X-API-KEY: $APISIX_API_KEY"
curl -X DELETE "http://apisix:9180/apisix/admin/upstreams/$UPSTREAM_ID" \
  -H "X-API-KEY: $APISIX_API_KEY"
```
