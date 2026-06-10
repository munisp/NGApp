# Mojaloop Operations Runbook

## Table of Contents
1. [Service Health Checks](#service-health-checks)
2. [Transfer Issues](#transfer-issues)
3. [TigerBeetle Operations](#tigerbeetle-operations)
4. [Reconciliation Failures](#reconciliation-failures)
5. [Incident Response](#incident-response)
6. [Disaster Recovery](#disaster-recovery)

---

## Service Health Checks

### Check All Services Status
```bash
kubectl get pods -n payment-switch -l app.kubernetes.io/component=mojaloop
kubectl get pods -n payment-switch -l app=tigerbeetle
```

### Check Service Logs
```bash
# Mojaloop Go Service
kubectl logs -n payment-switch -l app=mojaloop-go-service --tail=100

# TigerBeetle
kubectl logs -n payment-switch -l app=tigerbeetle --tail=100

# Central Ledger
kubectl logs -n payment-switch -l app=central-ledger --tail=100
```

### Health Endpoints
```bash
# Mojaloop Go Service
curl http://mojaloop-go-service.payment-switch.svc.cluster.local:8080/health

# Check readiness
curl http://mojaloop-go-service.payment-switch.svc.cluster.local:8080/ready
```

---

## Transfer Issues

### Stuck Transfer Investigation

**Symptoms:** Transfer remains in RESERVED state for more than 30 seconds

**Investigation Steps:**

1. Check transfer status in database:
```sql
SELECT transfer_id, state, created_at, expiration, error_code
FROM mojaloop_transfers
WHERE state = 'RESERVED'
AND created_at < NOW() - INTERVAL '30 seconds';
```

2. Check TigerBeetle for pending transfer:
```bash
# Get transfer details from TigerBeetle
curl -X POST http://mojaloop-go-service:8080/api/v1/transfers/lookup \
  -H "Content-Type: application/json" \
  -d '{"transferId": "<TRANSFER_ID>"}'
```

3. Check for network issues between services:
```bash
kubectl exec -n payment-switch -it <mojaloop-pod> -- \
  curl -v http://tigerbeetle.payment-switch.svc.cluster.local:3000/health
```

**Resolution:**

Option A - Timeout the transfer (if expired):
```bash
curl -X POST http://mojaloop-go-service:8080/api/v1/mojaloop/transfers/abort \
  -H "Content-Type: application/json" \
  -d '{"transferId": "<TRANSFER_ID>", "errorCode": "5100", "errorDescription": "Manual timeout"}'
```

Option B - Force reconciliation:
```bash
curl -X POST http://mojaloop-go-service:8080/api/v1/admin/reconcile \
  -H "Content-Type: application/json" \
  -d '{"transferId": "<TRANSFER_ID>"}'
```

### Transfer Failure Investigation

**Symptoms:** Transfer fails with error code

**Common Error Codes:**
- `3100` - Payer FSP insufficient liquidity
- `3200` - Payee FSP rejected
- `4100` - Payer rejected transaction
- `5100` - Payee rejected transaction
- `5200` - Transfer expired

**Investigation Steps:**

1. Check transfer error details:
```sql
SELECT transfer_id, error_code, error_description, state
FROM mojaloop_transfers
WHERE transfer_id = '<TRANSFER_ID>';
```

2. Check participant positions:
```bash
curl "http://mojaloop-go-service:8080/api/v1/mojaloop/participants/position?fspId=<FSP_ID>"
```

3. Check audit log:
```sql
SELECT * FROM audit_log
WHERE resource_id = '<TRANSFER_ID>'
ORDER BY timestamp DESC;
```

---

## TigerBeetle Operations

### Check TigerBeetle Cluster Health
```bash
# Check pod status
kubectl get pods -n payment-switch -l app=tigerbeetle

# Check cluster status
kubectl exec -n payment-switch tigerbeetle-0 -- tigerbeetle status
```

### Account Balance Check
```bash
curl -X POST http://mojaloop-go-service:8080/api/v1/accounts/lookup \
  -H "Content-Type: application/json" \
  -d '{"accountIds": [<ACCOUNT_ID>]}'
```

### Manual Transfer Void (Emergency)

**WARNING:** Only use in emergency situations with approval from on-call lead

```bash
curl -X POST http://mojaloop-go-service:8080/api/v1/admin/void-transfer \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -d '{"transferId": "<TRANSFER_ID>", "reason": "Emergency void - ticket #XXX"}'
```

---

## Reconciliation Failures

### Check Reconciliation Status
```bash
curl http://mojaloop-go-service:8080/api/v1/admin/reconciliation/status
```

### Investigate Balance Drift

1. Get drift details:
```sql
SELECT fsp_id, tb_balance, expected_balance, drift
FROM reconciliation_results
WHERE abs(drift) > 100
ORDER BY timestamp DESC
LIMIT 10;
```

2. Compare TigerBeetle vs calculated balance:
```bash
# Get TigerBeetle balance
curl -X POST http://mojaloop-go-service:8080/api/v1/accounts/lookup \
  -d '{"accountIds": [<TB_ACCOUNT_ID>]}'

# Calculate expected from transfers
psql -c "
SELECT 
  SUM(CASE WHEN payee_fsp = '<FSP_ID>' THEN amount ELSE 0 END) -
  SUM(CASE WHEN payer_fsp = '<FSP_ID>' THEN amount ELSE 0 END) as expected
FROM mojaloop_transfers
WHERE state = 'COMMITTED';
"
```

3. Find missing/duplicate transfers:
```sql
-- Transfers in DB but not in TigerBeetle
SELECT transfer_id FROM mojaloop_transfers
WHERE state = 'COMMITTED'
AND tigerbeetle_id NOT IN (
  SELECT id FROM tigerbeetle_transfers_snapshot
);
```

### Force Reconciliation
```bash
curl -X POST http://mojaloop-go-service:8080/api/v1/admin/reconciliation/run \
  -H "X-Admin-Token: <ADMIN_TOKEN>"
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 | Critical - Money at risk | 15 min | Stuck funds, double-posting, TigerBeetle down |
| P2 | High - Service degraded | 1 hour | High error rate, latency spike |
| P3 | Medium - Partial impact | 4 hours | Single FSP issues, non-critical service down |
| P4 | Low - Minor issue | 24 hours | Dashboard issues, log errors |

### P1 Incident Checklist

1. **Acknowledge** - Claim incident in PagerDuty
2. **Assess** - Determine scope and impact
3. **Communicate** - Update status page, notify stakeholders
4. **Mitigate** - Stop the bleeding (pause transfers if needed)
5. **Resolve** - Fix root cause
6. **Document** - Create incident report

### Emergency Transfer Pause

**WARNING:** This stops all transfers. Use only for P1 incidents.

```bash
# Pause all transfers
kubectl scale deployment mojaloop-go-service -n payment-switch --replicas=0

# Resume transfers
kubectl scale deployment mojaloop-go-service -n payment-switch --replicas=3
```

### Rollback Deployment

```bash
# Check deployment history
kubectl rollout history deployment/mojaloop-go-service -n payment-switch

# Rollback to previous version
kubectl rollout undo deployment/mojaloop-go-service -n payment-switch

# Rollback to specific revision
kubectl rollout undo deployment/mojaloop-go-service -n payment-switch --to-revision=<N>
```

---

## Disaster Recovery

### TigerBeetle Backup

Backups are taken automatically every 6 hours. Manual backup:

```bash
# Trigger manual backup
kubectl exec -n payment-switch tigerbeetle-0 -- \
  tigerbeetle backup --output /backup/tigerbeetle-$(date +%Y%m%d-%H%M%S).backup

# Copy backup to S3
kubectl exec -n payment-switch tigerbeetle-0 -- \
  aws s3 cp /backup/tigerbeetle-*.backup s3://payment-switch-backups/tigerbeetle/
```

### TigerBeetle Restore

**WARNING:** This will overwrite current data. Ensure all transfers are stopped.

```bash
# Stop TigerBeetle
kubectl scale statefulset tigerbeetle -n payment-switch --replicas=0

# Download backup
aws s3 cp s3://payment-switch-backups/tigerbeetle/<BACKUP_FILE> /tmp/

# Restore
kubectl exec -n payment-switch tigerbeetle-0 -- \
  tigerbeetle restore --input /tmp/<BACKUP_FILE>

# Start TigerBeetle
kubectl scale statefulset tigerbeetle -n payment-switch --replicas=3
```

### PostgreSQL Backup

```bash
# Manual backup
kubectl exec -n payment-switch postgres-0 -- \
  pg_dump -U mojaloop mojaloop_transfers > /backup/mojaloop-$(date +%Y%m%d-%H%M%S).sql

# Copy to S3
kubectl cp payment-switch/postgres-0:/backup/mojaloop-*.sql /tmp/
aws s3 cp /tmp/mojaloop-*.sql s3://payment-switch-backups/postgres/
```

### Full Disaster Recovery Procedure

1. **Assess damage** - Determine what needs recovery
2. **Notify stakeholders** - Update status page
3. **Stop all services** - Prevent further data corruption
4. **Restore TigerBeetle** - Primary source of truth
5. **Restore PostgreSQL** - Operational metadata
6. **Run reconciliation** - Verify data consistency
7. **Gradual restart** - Start services one by one
8. **Verify** - Run conformance tests
9. **Resume operations** - Enable traffic

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| On-Call Primary | Rotating | PagerDuty |
| On-Call Secondary | Rotating | PagerDuty |
| Engineering Lead | TBD | Slack #mojaloop-oncall |
| Platform Team | TBD | Slack #platform |

---

## Appendix: Useful Commands

### Database Queries

```sql
-- Transfer volume by hour
SELECT date_trunc('hour', created_at) as hour, count(*), sum(amount)
FROM mojaloop_transfers
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1 ORDER BY 1;

-- Error rate by FSP
SELECT payer_fsp, 
  count(*) filter (where state = 'ABORTED') as errors,
  count(*) as total,
  round(100.0 * count(*) filter (where state = 'ABORTED') / count(*), 2) as error_rate
FROM mojaloop_transfers
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1 ORDER BY error_rate DESC;

-- Stuck transfers
SELECT * FROM mojaloop_transfers
WHERE state = 'RESERVED' AND created_at < NOW() - INTERVAL '5 minutes';
```

### Prometheus Queries

```promql
# Transfer success rate
100 * (1 - sum(rate(mojaloop_transfer_errors_total[5m])) / sum(rate(mojaloop_transfer_requests_total[5m])))

# p99 latency
histogram_quantile(0.99, sum(rate(mojaloop_transfer_duration_seconds_bucket[5m])) by (le))

# Error budget burn rate
sum(rate(mojaloop_transfer_errors_total[1h])) / sum(rate(mojaloop_transfer_requests_total[1h])) / 0.001
```
