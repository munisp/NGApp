## Runbook: Service Outage

**Severity:** Critical  
**Response Time:** Immediate (< 5 minutes)  
**On-Call:** DevOps + Platform Team

### Symptoms

- Application not responding (HTTP 502/503/504)
- Health check endpoints failing
- High error rate in logs
- Container restarts or crashes
- Load balancer reporting backend down

### Impact

- **User Impact:** Unable to access platform, payment processing halted
- **Business Impact:** Revenue loss, SLA breach, reputation damage
- **Data Impact:** Potential transaction failures, data inconsistency

### Triage Steps

#### 1. Verify the Outage (2 minutes)

```bash
# Check service status
docker ps -a | grep web-portal

# Check health endpoint
curl -f http://localhost:3000/health

# Check from external
curl -f https://payment-switch.com/health

# Check load balancer
docker logs nginx-gateway --tail=50
```

#### 2. Check Monitoring (1 minute)

- Open Grafana: http://grafana.payment-switch.com
- Check "System Overview" dashboard
- Look for:
  - CPU/Memory spikes
  - Network issues
  - Container restarts
  - Error rate increases

#### 3. Assess Scope

**Complete Outage:**
- All services down
- No response from any endpoint
- Load balancer cannot reach backends

**Partial Outage:**
- Some endpoints failing
- Intermittent errors
- Degraded performance

**Regional Outage:**
- Specific geographic region affected
- CDN or DNS issues
- ISP routing problems

### Resolution Procedures

#### Scenario A: Container Crashed

```bash
# Check container status
docker ps -a | grep web-portal

# Check why it crashed
docker logs web-portal --tail=200

# Check resource usage
docker stats --no-stream

# Restart container
docker-compose -f docker-compose.unified.yml restart web-portal

# Monitor restart
watch -n 2 'docker ps | grep web-portal'

# Verify health
sleep 30
curl -f http://localhost:3000/health
```

**If restart fails repeatedly:**

```bash
# Check for OOM (Out of Memory)
dmesg | grep -i "out of memory"

# Check disk space
df -h

# Check for port conflicts
netstat -tulpn | grep 3000

# Increase resources
docker-compose -f docker-compose.unified.yml up -d --scale web-portal=2
```

#### Scenario B: High CPU/Memory Usage

```bash
# Identify resource hog
docker stats

# Check application metrics
curl http://localhost:3000/metrics

# Profile application
docker exec web-portal node --prof

# Restart with resource limits
docker-compose -f docker-compose.unified.yml up -d \
  --memory 2g --cpus 2 web-portal

# Scale horizontally
docker-compose -f docker-compose.unified.yml up -d --scale web-portal=3
```

#### Scenario C: Network Issues

```bash
# Check network connectivity
docker network ls
docker network inspect payment-switch-network

# Test inter-service communication
docker exec web-portal ping mysql-db
docker exec web-portal ping redis-cache

# Check DNS resolution
docker exec web-portal nslookup mysql-db

# Restart network
docker network disconnect payment-switch-network web-portal
docker network connect payment-switch-network web-portal
```

#### Scenario D: Load Balancer Issues

```bash
# Check nginx status
docker ps | grep nginx-gateway

# Check nginx logs
docker logs nginx-gateway --tail=100

# Test nginx configuration
docker exec nginx-gateway nginx -t

# Reload nginx
docker exec nginx-gateway nginx -s reload

# Restart nginx
docker-compose -f docker-compose.unified.yml restart nginx-gateway
```

#### Scenario E: Dependency Failure

```bash
# Check all dependencies
docker-compose -f docker-compose.unified.yml ps

# Check database
docker exec mysql-db mysqladmin ping

# Check Redis
docker exec redis-cache redis-cli ping

# Check Kafka
docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Restart failed dependencies
docker-compose -f docker-compose.unified.yml restart mysql-db redis-cache
```

### Quick Recovery Actions

#### Immediate Mitigation (< 5 minutes)

```bash
# 1. Enable maintenance mode
curl -X POST http://localhost:3000/api/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "message": "Scheduled maintenance"}'

# 2. Restart all services
docker-compose -f docker-compose.unified.yml restart

# 3. Scale up replicas
docker-compose -f docker-compose.unified.yml up -d --scale web-portal=5

# 4. Clear caches
docker exec redis-cache redis-cli FLUSHALL
```

#### Rollback to Previous Version

```bash
# Check current version
docker ps --format "{{.Image}}" | grep web-portal

# Rollback to previous version
docker-compose -f docker-compose.unified.yml down
IMAGE_TAG=v1.0.0 docker-compose -f docker-compose.unified.yml up -d

# Verify rollback
curl -f http://localhost:3000/health
```

#### Enable Failover

```bash
# Switch to backup region (if multi-region)
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://failover-to-backup.json

# Or use blue-green deployment
./scripts/deploy-blue-green.sh rollback
```

### Communication

#### Initial Alert (Within 2 minutes)

**Slack #incidents:**
```
🚨 SERVICE OUTAGE - P0
Status: Investigating
Impact: Platform unavailable
Affected: All users
ETA: Investigating
Incident Commander: @oncall-devops
War Room: #incident-YYYYMMDD-HHMM
```

**Status Page:**
```
🔴 Major Outage
We are currently experiencing a service outage.
Our team is investigating and working on a resolution.
Updates will be posted every 15 minutes.
```

#### Status Updates (Every 10 minutes)

```
📊 UPDATE #1 - Service Outage
Time: [HH:MM]
Status: [Investigating/Identified/Mitigating]
Root Cause: [If known]
Actions: [What we're doing]
ETA: [Updated estimate]
```

#### Resolution Notification

```
✅ RESOLVED - Service Outage
Duration: [X minutes]
Root Cause: [Brief description]
Resolution: [What was done]
Impact: [User impact summary]
Follow-up: Post-mortem scheduled for [date/time]
```

### Monitoring During Recovery

```bash
# Monitor error rate
watch -n 5 'curl -s http://localhost:3000/metrics | grep error_rate'

# Monitor response time
watch -n 5 'curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health'

# Monitor active connections
watch -n 5 'netstat -an | grep :3000 | wc -l'

# Monitor container health
watch -n 5 'docker ps --format "table {{.Names}}\t{{.Status}}"'
```

### Verification Checklist

After mitigation:

- [ ] All containers running and healthy
- [ ] Health checks passing
- [ ] Error rate back to normal (<0.1%)
- [ ] Response times acceptable (<100ms p95)
- [ ] Database connections stable
- [ ] No memory leaks detected
- [ ] Load balancer routing correctly
- [ ] External monitoring confirms recovery
- [ ] Sample transactions processed successfully
- [ ] Monitoring dashboards green

### Post-Incident Actions

#### Immediate (Within 1 hour)

1. **Update status page** to "All Systems Operational"
2. **Send customer communication** about resolution
3. **Document timeline** in incident log
4. **Collect logs** and metrics for analysis
5. **Schedule post-mortem** meeting

#### Follow-up (Within 24 hours)

1. **Conduct post-mortem** with all stakeholders
2. **Identify root cause** and contributing factors
3. **Create action items** for prevention
4. **Update runbooks** with lessons learned
5. **Review and improve** monitoring/alerting

#### Long-term (Within 1 week)

1. **Implement preventive measures**
2. **Improve monitoring coverage**
3. **Enhance automation**
4. **Update disaster recovery plan**
5. **Conduct chaos engineering** exercises

### Prevention Measures

#### Monitoring Alerts

```yaml
# Prometheus alert rules
- alert: ServiceDown
  expr: up{job="web-portal"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Service {{ $labels.instance }} is down"

- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate: {{ $value }}%"

- alert: HighResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High response time: {{ $value }}s"
```

#### Automated Recovery

```bash
# Systemd service for auto-restart
cat > /etc/systemd/system/payment-switch.service << 'EOF'
[Unit]
Description=Payment Switch Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/payment-switch
ExecStart=/usr/local/bin/docker-compose -f docker-compose.unified.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.unified.yml down
Restart=on-failure
RestartSec=30s

[Install]
WantedBy=multi-user.target
EOF

systemctl enable payment-switch
systemctl start payment-switch
```

#### Circuit Breaker

```typescript
// Implement circuit breaker for external services
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

const breaker = new CircuitBreaker(externalServiceCall, options);

breaker.fallback(() => ({
  status: 'degraded',
  message: 'Service temporarily unavailable'
}));
```

### Escalation Path

**Level 1: On-Call DevOps (0-10 minutes)**
- Initial response
- Basic troubleshooting
- Service restarts

**Level 2: Platform Team (10-20 minutes)**
- Advanced troubleshooting
- Code-level debugging
- Configuration changes

**Level 3: Engineering Leadership (20-30 minutes)**
- Architectural decisions
- Major rollbacks
- Vendor escalation

**Level 4: Executive (30+ minutes)**
- Customer communication
- Business decisions
- PR/media response

### Contact Information

**On-Call Rotation:**
- Primary: [Phone/Slack]
- Secondary: [Phone/Slack]
- Manager: [Phone/Slack]

**Vendor Support:**
- Cloud Provider: [Support URL/Phone]
- Database: [Support URL/Phone]
- CDN: [Support URL/Phone]

### Tools & Resources

- **Monitoring:** http://grafana.payment-switch.com
- **Logs:** `docker-compose logs -f`
- **Metrics:** http://prometheus.payment-switch.com
- **Status Page:** https://status.payment-switch.com
- **Runbooks:** /opt/payment-switch/docs/runbooks/

### Related Runbooks

- [Database Failure](./database-failure.md)
- [Performance Degradation](./performance-degradation.md)
- [Security Incident](./security-incident.md)
- [Disaster Recovery](./disaster-recovery.md)
