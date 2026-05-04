# Payment Switch Runbooks & SLOs
# Recommendation #23: Runbooks & SLOs

This directory contains operational runbooks and SLO definitions for the Payment Switch platform.

## Table of Contents

1. [Service Level Objectives (SLOs)](#service-level-objectives)
2. [Incident Response](#incident-response)
3. [Common Issues & Resolutions](#common-issues--resolutions)
4. [Deployment Procedures](#deployment-procedures)
5. [Monitoring & Alerting](#monitoring--alerting)

---

## Service Level Objectives

### API Availability SLO

| Metric | Target | Window | Error Budget |
|--------|--------|--------|--------------|
| API Availability | 99.9% | 30 days | 43.2 minutes/month |

**Definition**: Percentage of successful HTTP responses (status < 500) to total requests.

**Measurement Query**:
```promql
sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
```

**Alert Thresholds**:
- Warning: < 99.95% (1-hour window)
- Critical: < 99.9% (1-hour window)

---

### API Latency SLO

| Metric | Target | Window | Percentile |
|--------|--------|--------|------------|
| API Latency P99 | < 500ms | 30 days | 99th |

**Definition**: 99th percentile of HTTP request latency should be under 500ms.

**Measurement Query**:
```promql
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Alert Thresholds**:
- Warning: P99 > 400ms (5-minute window)
- Critical: P99 > 500ms (5-minute window)

---

### Transaction Success Rate SLO

| Metric | Target | Window | Error Budget |
|--------|--------|--------|--------------|
| Transaction Success | 99.5% | 30 days | 0.5% failures |

**Definition**: Percentage of transactions that complete successfully.

**Measurement Query**:
```promql
sum(rate(transactions_total{status="completed"}[5m])) / sum(rate(transactions_total[5m])) * 100
```

**Alert Thresholds**:
- Warning: < 99.7% (15-minute window)
- Critical: < 99.5% (15-minute window)

---

### Provisioning Success Rate SLO

| Metric | Target | Window |
|--------|--------|--------|
| Provisioning Success | 95% | 7 days |

**Definition**: Percentage of participant provisioning workflows that complete successfully.

**Measurement Query**:
```promql
sum(rate(provisioning_completed_total[1h])) / sum(rate(provisioning_started_total[1h])) * 100
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| SEV1 | Critical - Service down | 15 minutes | Complete API outage, data loss |
| SEV2 | Major - Degraded service | 30 minutes | High error rate, slow responses |
| SEV3 | Minor - Limited impact | 4 hours | Single feature broken |
| SEV4 | Low - Minimal impact | 24 hours | UI glitch, minor bug |

### Incident Response Procedure

1. **Detection**: Alert fires or user reports issue
2. **Triage**: Determine severity level
3. **Communication**: Notify stakeholders via appropriate channel
4. **Investigation**: Identify root cause
5. **Mitigation**: Apply temporary fix if needed
6. **Resolution**: Implement permanent fix
7. **Post-mortem**: Document lessons learned

### On-Call Escalation

```
Level 1: On-call engineer (15 min response)
    ↓
Level 2: Team lead (30 min response)
    ↓
Level 3: Engineering manager (1 hour response)
    ↓
Level 4: VP Engineering (2 hour response)
```

---

## Common Issues & Resolutions

### Issue: High API Latency

**Symptoms**:
- P99 latency > 500ms
- Slow dashboard loading
- Timeout errors

**Investigation Steps**:
1. Check database query performance
2. Review recent deployments
3. Check external service health (Mojaloop, Keycloak)
4. Review resource utilization (CPU, memory)

**Resolution**:
```bash
# Check database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Restart connection pool if needed
kubectl rollout restart deployment/api-server
```

---

### Issue: Transaction Failures

**Symptoms**:
- Transaction success rate dropping
- Error messages in logs
- User complaints

**Investigation Steps**:
1. Check Mojaloop connectivity
2. Review transaction error logs
3. Verify participant account balances
4. Check for rate limiting

**Resolution**:
```bash
# Check Mojaloop health
curl -s https://mojaloop-central-ledger/health | jq .

# Review recent transaction errors
kubectl logs -l app=transaction-service --since=1h | grep ERROR

# Check participant status
psql -c "SELECT id, name, status FROM participants WHERE status != 'active';"
```

---

### Issue: Provisioning Failures

**Symptoms**:
- Provisioning stuck in "processing"
- Keycloak/APISIX errors
- Incomplete participant setup

**Investigation Steps**:
1. Check provisioning saga state
2. Verify Keycloak connectivity
3. Verify APISIX admin API access
4. Review provisioning logs

**Resolution**:
```bash
# Check provisioning status
psql -c "SELECT id, status, current_step, error FROM provisioning_sagas WHERE status = 'failed';"

# Retry failed provisioning
curl -X POST https://api/admin/provisioning/{id}/retry

# Manual Keycloak client creation (if needed)
curl -X POST https://keycloak/admin/realms/payment-switch/clients \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"clientId": "participant-xxx", "enabled": true}'
```

---

### Issue: Authentication Failures

**Symptoms**:
- Users unable to login
- 401/403 errors
- Token validation failures

**Investigation Steps**:
1. Check Keycloak health
2. Verify JWT signing keys
3. Review token expiration settings
4. Check clock synchronization

**Resolution**:
```bash
# Check Keycloak health
curl -s https://keycloak/health | jq .

# Verify JWKS endpoint
curl -s https://keycloak/realms/payment-switch/protocol/openid-connect/certs | jq .

# Force token refresh
kubectl rollout restart deployment/auth-service
```

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All CI checks passing
- [ ] Code review approved
- [ ] Database migrations tested
- [ ] Feature flags configured
- [ ] Rollback plan documented
- [ ] Monitoring dashboards ready

### Deployment Steps

1. **Prepare**:
   ```bash
   # Tag release
   git tag -a v1.x.x -m "Release v1.x.x"
   git push origin v1.x.x
   ```

2. **Deploy to Staging**:
   ```bash
   kubectl apply -f k8s/staging/
   kubectl rollout status deployment/api-server -n staging
   ```

3. **Verify Staging**:
   ```bash
   # Run smoke tests
   npm run test:smoke -- --env=staging
   
   # Check metrics
   curl -s https://staging.api/metrics | grep http_requests
   ```

4. **Deploy to Production**:
   ```bash
   kubectl apply -f k8s/production/
   kubectl rollout status deployment/api-server -n production
   ```

5. **Post-Deployment Verification**:
   ```bash
   # Verify health
   curl -s https://api/health | jq .
   
   # Check error rate
   # Monitor for 15 minutes
   ```

### Rollback Procedure

```bash
# Immediate rollback
kubectl rollout undo deployment/api-server -n production

# Rollback to specific revision
kubectl rollout undo deployment/api-server --to-revision=X -n production

# Verify rollback
kubectl rollout status deployment/api-server -n production
```

---

## Monitoring & Alerting

### Key Dashboards

| Dashboard | Purpose | URL |
|-----------|---------|-----|
| API Overview | Request rates, latency, errors | /grafana/d/api-overview |
| Transaction Monitor | Transaction success/failure rates | /grafana/d/transactions |
| Provisioning Status | Provisioning workflow status | /grafana/d/provisioning |
| Infrastructure | CPU, memory, disk usage | /grafana/d/infrastructure |

### Alert Routing

| Alert Type | Channel | Escalation |
|------------|---------|------------|
| SEV1 | PagerDuty + Slack #incidents | Immediate |
| SEV2 | PagerDuty + Slack #incidents | 15 min |
| SEV3 | Slack #alerts | 1 hour |
| SEV4 | Slack #alerts | Next business day |

### Key Metrics to Monitor

1. **API Health**:
   - Request rate (requests/second)
   - Error rate (5xx responses)
   - Latency (P50, P95, P99)

2. **Transaction Health**:
   - Transaction volume
   - Success rate
   - Processing time

3. **Infrastructure**:
   - CPU utilization
   - Memory usage
   - Disk I/O
   - Network throughput

4. **External Dependencies**:
   - Mojaloop health
   - Keycloak health
   - APISIX health
   - Database connections

---

## Contact Information

| Role | Contact |
|------|---------|
| On-Call Engineer | oncall@payment-switch.io |
| Engineering Lead | eng-lead@payment-switch.io |
| Security Team | security@payment-switch.io |
| Operations | ops@payment-switch.io |
