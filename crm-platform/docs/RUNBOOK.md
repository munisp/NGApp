# CRM Platform Operations Runbook

## Service Overview

| Service | Port | Language | Dependencies |
|---------|------|----------|-------------|
| crm-api | 8080 | Go | Postgres, Redis, Kafka, Keycloak, Permify |
| semantic-search | 8082 | Rust | OpenSearch |
| workflow-runtime | 8083 | Rust | Temporal |
| sales-agent | 8084 | Python | Redis, Kafka |
| analytics-engine | 8085 | Python | Postgres, Kafka |
| frontend | 3000 | TypeScript/React | crm-api |

## Health Checks

```bash
# Check all services
for port in 8080 8082 8083 8084 8085 3000; do
  curl -s http://localhost:$port/health | jq .
done
```

## Common Incidents

### 1. High API Latency (p95 > 500ms)

**Symptoms:** Slow page loads, timeout errors in frontend
**Dashboard:** Grafana > CRM API Service > Response Latency

**Steps:**
1. Check Postgres connection pool: `SELECT count(*) FROM pg_stat_activity;`
2. Check Redis memory: `redis-cli INFO memory | grep used_memory_human`
3. Check if Kafka consumer lag is high: Grafana > Middleware > Kafka Consumer Lag
4. Scale API horizontally: `kubectl scale deployment crm-api --replicas=5`

### 2. Kafka Consumer Lag Growing

**Symptoms:** Events not processing, stale data in dashboards
**Dashboard:** Grafana > Middleware > Kafka Consumer Lag

**Steps:**
1. Check consumer health: `kafka-consumer-groups.sh --describe --group crm-events`
2. Check for stuck consumers: Look for consumers with no heartbeat
3. Restart consumer group: `kubectl rollout restart deployment crm-api`
4. If persistent: Increase consumer partitions and replicas

### 3. OpenSearch Index Degraded

**Symptoms:** Semantic search returns no results or is slow
**Dashboard:** Grafana > Middleware > OpenSearch Query Latency

**Steps:**
1. Check cluster health: `curl http://opensearch:9200/_cluster/health`
2. Check index status: `curl http://opensearch:9200/_cat/indices?v`
3. Force merge if fragmented: `curl -POST http://opensearch:9200/crm-*/_forcemerge?max_num_segments=1`

### 4. Authentication Failures

**Symptoms:** 401 errors, users unable to login
**Dashboard:** Grafana > Middleware > Keycloak Auth Requests

**Steps:**
1. Check Keycloak status: `curl http://keycloak:8080/health`
2. Check realm config: `curl http://keycloak:8080/admin/realms/crm`
3. Verify Permify policies: Check policy engine logs
4. Clear Redis session cache if stale: `redis-cli DEL "session:*"`

### 5. Database Connection Exhaustion

**Symptoms:** "too many connections" errors, 500s on all endpoints

**Steps:**
1. Check active connections: `SELECT count(*), state FROM pg_stat_activity GROUP BY state;`
2. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '5 minutes';`
3. Increase pool size in config
4. Check for connection leaks in application logs

## Scaling Guidelines

| Load Level | API Replicas | DB Connections | Redis Memory | Kafka Partitions |
|------------|-------------|----------------|--------------|-----------------|
| Low (<100 RPS) | 2 | 20 | 1 GB | 3 |
| Medium (100-500 RPS) | 3-5 | 50 | 4 GB | 6 |
| High (500-2000 RPS) | 5-10 | 100 | 8 GB | 12 |
| Peak (>2000 RPS) | 10+ | 200 | 16 GB | 24 |

## Backup & Recovery

### Database Backup
```bash
pg_dump -h postgres -U crm_user -d crm_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Database Restore
```bash
gunzip < backup_20240101.sql.gz | psql -h postgres -U crm_user -d crm_db
```

### Redis Backup
```bash
redis-cli BGSAVE
cp /data/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

## SLOs

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Availability | 99.9% | < 99.5% |
| p95 Latency | < 200ms | > 500ms |
| Error Rate | < 0.1% | > 1% |
| Search Latency | < 100ms | > 300ms |
| Workflow Completion | 99.5% | < 98% |
