## Runbook: Database Failure

**Severity:** Critical  
**Response Time:** Immediate (< 5 minutes)  
**On-Call:** Database Team + DevOps

### Symptoms

- Application unable to connect to database
- Timeout errors in application logs
- Database container not responding
- High database CPU/memory usage
- Slow query performance

### Impact

- **User Impact:** Complete service outage or severe degradation
- **Business Impact:** Payment processing halted, revenue loss
- **Data Impact:** Potential data loss if not handled properly

### Triage Steps

#### 1. Verify the Issue (2 minutes)

```bash
# Check database container status
docker ps | grep mysql-db
docker ps | grep postgres-db

# Check database logs
docker logs mysql-db --tail=100
docker logs postgres-db --tail=100

# Test database connectivity
docker exec mysql-db mysqladmin ping
docker exec postgres-db pg_isready
```

#### 2. Check Monitoring (1 minute)

- Open Grafana: http://grafana.payment-switch.com
- Check "Database Health" dashboard
- Look for:
  - Connection pool exhaustion
  - Slow queries
  - Disk space issues
  - Memory pressure

#### 3. Assess Severity

**P0 - Critical (Database Down)**
- Database container stopped
- Cannot connect to database
- Corrupted data files

**P1 - High (Severe Degradation)**
- Slow query performance (>5s)
- Connection pool exhausted
- High error rate (>5%)

**P2 - Medium (Performance Issues)**
- Occasional slow queries
- Intermittent connection issues
- High but manageable load

### Resolution Procedures

#### Scenario A: Database Container Stopped

```bash
# Check why container stopped
docker logs mysql-db --tail=200

# Check disk space
df -h

# Restart database container
docker-compose -f docker-compose.unified.yml restart mysql-db

# Wait for database to be ready
sleep 30

# Verify health
docker exec mysql-db mysqladmin ping

# Check application connectivity
curl -f http://localhost:3000/health
```

**If restart fails:**

```bash
# Check for corrupted data files
docker exec mysql-db mysqlcheck --all-databases

# If corrupted, restore from backup
./scripts/restore-database.sh $(date +%Y%m%d)
```

#### Scenario B: Connection Pool Exhausted

```bash
# Check active connections
docker exec mysql-db mysql -e "SHOW PROCESSLIST;"

# Kill long-running queries
docker exec mysql-db mysql -e "
  SELECT CONCAT('KILL ', id, ';') 
  FROM information_schema.processlist 
  WHERE time > 300 AND command != 'Sleep';
"

# Restart application to reset connection pool
docker-compose -f docker-compose.unified.yml restart web-portal

# Monitor connection count
watch -n 5 'docker exec mysql-db mysql -e "SHOW STATUS LIKE \"Threads_connected\";"'
```

#### Scenario C: Slow Query Performance

```bash
# Identify slow queries
docker exec mysql-db mysql -e "
  SELECT * FROM information_schema.processlist 
  WHERE time > 10 
  ORDER BY time DESC;
"

# Check for missing indexes
docker exec mysql-db mysql -e "
  SELECT * FROM sys.schema_unused_indexes;
"

# Analyze query execution plan
docker exec mysql-db mysql -e "
  EXPLAIN SELECT * FROM transactions WHERE status = 'pending';
"

# Add missing index (if identified)
docker exec mysql-db mysql -e "
  CREATE INDEX idx_transactions_status ON transactions(status);
"
```

#### Scenario D: Disk Space Full

```bash
# Check disk usage
df -h

# Find large files
du -h /var/lib/docker/volumes/ | sort -rh | head -20

# Clean up old logs
docker system prune -af --volumes

# Expand disk (if on cloud)
# AWS: Modify EBS volume size
# GCP: Resize persistent disk
# Azure: Expand managed disk

# Purge old data (if appropriate)
docker exec mysql-db mysql -e "
  DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
"
```

#### Scenario E: Database Corruption

```bash
# Stop application to prevent further writes
docker-compose -f docker-compose.unified.yml stop web-portal

# Check for corruption
docker exec mysql-db mysqlcheck --all-databases --check

# Repair corrupted tables
docker exec mysql-db mysqlcheck --all-databases --repair

# If repair fails, restore from backup
./scripts/restore-database.sh $(date +%Y%m%d)

# Verify data integrity
docker exec mysql-db mysql -e "
  SELECT COUNT(*) FROM transactions;
  SELECT COUNT(*) FROM users;
"

# Restart application
docker-compose -f docker-compose.unified.yml start web-portal
```

### Rollback Procedure

If database changes caused the issue:

```bash
# Restore from latest backup
./scripts/restore-database.sh

# Or restore from specific backup
./scripts/restore-database.sh 20240115

# Verify restoration
docker exec mysql-db mysql -e "SELECT VERSION();"
docker exec mysql-db mysql -e "SHOW DATABASES;"

# Restart application
docker-compose -f docker-compose.unified.yml restart web-portal
```

### Communication

#### Initial Alert (Within 5 minutes)

**Slack #incidents:**
```
🚨 DATABASE OUTAGE - P0
Status: Investigating
Impact: Payment processing down
ETA: TBD
Incident Commander: @oncall-dba
```

#### Status Updates (Every 15 minutes)

```
📊 UPDATE - Database Incident
Status: [Investigating/Mitigating/Resolved]
Actions Taken: [List actions]
Next Steps: [List next steps]
ETA: [Updated ETA]
```

#### Resolution Notification

```
✅ RESOLVED - Database Incident
Duration: [X minutes]
Root Cause: [Brief description]
Resolution: [What was done]
Follow-up: [Post-mortem scheduled]
```

### Post-Incident

#### Immediate Actions (Within 1 hour)

1. **Document timeline** in incident log
2. **Collect logs** and metrics
3. **Verify full recovery**
4. **Update status page**

#### Follow-up Actions (Within 24 hours)

1. **Schedule post-mortem** meeting
2. **Create action items** for prevention
3. **Update runbook** with lessons learned
4. **Review monitoring** and alerts

#### Post-Mortem Template

```markdown
# Database Failure Post-Mortem

## Incident Summary
- **Date:** YYYY-MM-DD
- **Duration:** X minutes
- **Severity:** P0
- **Impact:** [User impact description]

## Timeline
- HH:MM - Alert triggered
- HH:MM - Incident declared
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Service restored
- HH:MM - Incident closed

## Root Cause
[Detailed explanation of what caused the issue]

## Resolution
[What was done to resolve the issue]

## Prevention
[Action items to prevent recurrence]

## Lessons Learned
[What we learned from this incident]
```

### Prevention Measures

#### Monitoring

```yaml
# Prometheus alert rules
- alert: DatabaseDown
  expr: mysql_up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Database is down"

- alert: HighDatabaseConnections
  expr: mysql_global_status_threads_connected > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High number of database connections"

- alert: SlowQueries
  expr: rate(mysql_global_status_slow_queries[5m]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High rate of slow queries"
```

#### Automated Backups

```bash
# Cron job for daily backups
0 2 * * * /opt/payment-switch/scripts/backup-database.sh

# Cron job for hourly backups (critical data)
0 * * * * /opt/payment-switch/scripts/backup-database.sh --incremental
```

#### Health Checks

```bash
# Add to monitoring
*/5 * * * * /opt/payment-switch/scripts/database-health-check.sh
```

### Escalation

**Level 1:** On-call DevOps (0-15 minutes)
- Initial triage
- Basic troubleshooting
- Restart services

**Level 2:** Database Team (15-30 minutes)
- Advanced troubleshooting
- Query optimization
- Schema changes

**Level 3:** Senior Engineering (30+ minutes)
- Architectural decisions
- Major changes
- Vendor support

**Emergency Contact:**
- DevOps On-Call: [Phone]
- Database Team Lead: [Phone]
- CTO: [Phone]

### Tools & Resources

- **Grafana:** http://grafana.payment-switch.com
- **Prometheus:** http://prometheus.payment-switch.com
- **Database Admin:** http://adminer.payment-switch.com
- **Logs:** `docker logs mysql-db`
- **Backups:** `/opt/payment-switch/backups`

### Related Runbooks

- [Service Outage](./service-outage.md)
- [Performance Degradation](./performance-degradation.md)
- [Data Corruption](./data-corruption.md)
- [Disaster Recovery](./disaster-recovery.md)
