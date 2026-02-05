# Monitoring and Alerting Documentation

This document describes the monitoring and alerting setup for the African Fintech KYC/KYB platform.

## Overview

The platform uses **Prometheus** for metrics collection and **AlertManager** for alert routing and notification.

## Alert Categories

### 1. Platform Health Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| ServiceDown | Critical | 5 minutes | Service has been unavailable for more than 5 minutes |
| HighCPUUsage | Warning | >80% for 10min | CPU usage is consistently high |
| CriticalCPUUsage | Critical | >90% for 5min | CPU usage is critically high |
| HighMemoryUsage | Warning | >85% for 10min | Memory usage is consistently high |
| CriticalMemoryUsage | Critical | >95% for 5min | Memory usage is critically high |
| HighDiskUsage | Warning | >80% for 10min | Disk usage is consistently high |
| CriticalDiskUsage | Critical | >90% for 5min | Disk usage is critically high |

### 2. Application Performance Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| HighAPILatency | Warning | >1s (p95) for 10min | API response time is high |
| CriticalAPILatency | Critical | >3s (p95) for 5min | API response time is critically high |
| HighErrorRate | Warning | >5% for 10min | Error rate is consistently high |
| CriticalErrorRate | Critical | >10% for 5min | Error rate is critically high |
| HighRequestRate | Warning | >1000 req/s for 10min | Request rate is unusually high (potential DDoS) |

### 3. Database Health Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| PostgreSQLDown | Critical | 5 minutes | PostgreSQL database is unavailable |
| HighDatabaseConnections | Warning | >80% of max for 10min | Database connection pool is nearly exhausted |
| SlowDatabaseQueries | Warning | >1s avg for 10min | Database queries are running slowly |

### 4. TigerBeetle Ledger Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| TigerBeetleDown | Critical | 5 minutes | TigerBeetle instance is unavailable |
| LowTigerBeetleTPS | Warning | <100 TPS for 10min | Transaction throughput is below expected |
| TigerBeetleReplicationLag | Warning | >10s for 5min | Replication lag between TigerBeetle replicas |

### 5. Temporal Workflow Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| TemporalDown | Critical | 5 minutes | Temporal server is unavailable |
| HighWorkflowFailureRate | Warning | >5% for 10min | Workflow execution failure rate is high |
| HighWorkflowBacklog | Warning | >100 tasks for 10min | Workflow task queue has significant backlog |

### 6. Kafka Messaging Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| KafkaBrokerDown | Critical | 5 minutes | Kafka broker is not in running state |
| HighKafkaConsumerLag | Warning | >10000 messages for 10min | Consumer is falling behind producers |
| KafkaUnderReplicatedPartitions | Warning | >0 for 10min | Kafka partitions are not fully replicated |

### 7. Wazuh Security Alerts

| Alert Name | Severity | Threshold | Description |
|------------|----------|-----------|-------------|
| WazuhManagerDown | Critical | 5 minutes | Wazuh SIEM manager is unavailable |
| HighSecurityAlerts | Warning | >10/min for 10min | High rate of security alerts |
| UnauthorizedPIIAccess | Critical | >0 for 1min | Unauthorized access to PII data detected |

## Alert Routing

### Notification Channels

| Channel | Severity | Components | Recipients |
|---------|----------|------------|------------|
| PagerDuty | Critical | All | On-call engineer |
| Slack #critical-alerts | Critical | All | DevOps, Security, DBA teams |
| Slack #warnings | Warning | All | DevOps team |
| Slack #security-alerts | All | Security | Security team |
| Slack #database-alerts | All | Database | DBA team |
| Slack #devops-alerts | All | Infrastructure | DevOps team |
| Email | Critical/Warning | Security, Database, Infrastructure | Team-specific emails |

### Alert Grouping

Alerts are grouped by:
- **alertname**: Same alert type
- **cluster**: Same Kubernetes cluster
- **service**: Same service

Grouping reduces notification spam by combining related alerts into a single notification.

### Alert Inhibition

Redundant alerts are suppressed using inhibition rules:
- **Warning alerts** are suppressed if a **critical alert** is firing for the same instance
- **All alerts** for an instance are suppressed if **ServiceDown** is firing

## Alert Response Procedures

### Critical Alerts

1. **Acknowledge** the alert in PagerDuty
2. **Investigate** the root cause using:
   - Grafana dashboards
   - Kubernetes logs: `kubectl logs <pod-name>`
   - Service health endpoints
3. **Mitigate** the issue:
   - Restart failed services
   - Scale up resources if needed
   - Rollback recent deployments if necessary
4. **Document** the incident in the incident log
5. **Resolve** the alert once the issue is fixed

### Warning Alerts

1. **Review** the alert in Slack
2. **Monitor** the situation to see if it resolves automatically
3. **Investigate** if the alert persists for more than 30 minutes
4. **Take action** if the issue is trending worse
5. **Document** any actions taken

### Security Alerts

1. **Immediately investigate** any unauthorized PII access
2. **Review** Wazuh dashboard for alert details
3. **Check** audit logs for suspicious activity
4. **Notify** security team and management
5. **Follow** incident response plan if breach is confirmed

## Monitoring Dashboards

### Grafana Dashboards

1. **Platform Health Dashboard**: Overall system health and resource usage
2. **Temporal Workflows Dashboard**: Workflow execution metrics and task queues
3. **Kafka Metrics Dashboard**: Message throughput, consumer lag, and broker health

Access dashboards at: `https://grafana.example.com`

### Prometheus Metrics

Access Prometheus at: `https://prometheus.example.com`

Query examples:
```promql
# CPU usage by instance
100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# API latency (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
(rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100
```

## Alert Testing

### Manual Alert Testing

Test alerts manually using `amtool`:

```bash
# Send test alert
amtool alert add alertname="TestAlert" severity="warning" instance="test-instance"

# Check alert status
amtool alert query

# Silence alert
amtool silence add alertname="TestAlert" --duration=1h
```

### Automated Alert Testing

Run alert tests as part of CI/CD:

```bash
# Test alert rules syntax
promtool check rules /etc/prometheus/alert-rules.yml

# Test AlertManager config
amtool check-config /etc/alertmanager/alertmanager.yml
```

## Alert Tuning

### Adjusting Thresholds

Edit `/home/ubuntu/prometheus-alertmanager/alert-rules.yml`:

```yaml
# Example: Adjust CPU threshold from 80% to 85%
- alert: HighCPUUsage
  expr: (100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) > 85
  for: 10m
```

Reload Prometheus configuration:

```bash
kubectl exec -it prometheus-0 -- kill -HUP 1
```

### Silencing Alerts

Silence alerts during maintenance windows:

```bash
# Silence all alerts for instance during maintenance
amtool silence add instance="prod-server-1" --duration=2h --comment="Scheduled maintenance"

# Silence specific alert
amtool silence add alertname="HighCPUUsage" instance="prod-server-1" --duration=1h
```

## Troubleshooting

### Alerts Not Firing

1. Check Prometheus is scraping targets: `https://prometheus.example.com/targets`
2. Verify alert rules are loaded: `https://prometheus.example.com/rules`
3. Check AlertManager is receiving alerts: `https://alertmanager.example.com`
4. Review Prometheus logs: `kubectl logs prometheus-0`

### Notifications Not Received

1. Check AlertManager configuration: `amtool check-config`
2. Verify Slack webhook URL is correct
3. Test Slack webhook manually:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test alert"}' \
     https://hooks.slack.com/services/YOUR_WEBHOOK_URL
   ```
4. Review AlertManager logs: `kubectl logs alertmanager-0`

### False Positive Alerts

1. Adjust alert thresholds in `alert-rules.yml`
2. Increase `for` duration to reduce flapping
3. Add inhibition rules to suppress redundant alerts
4. Silence alerts during known maintenance windows

## Best Practices

1. **Review alerts weekly**: Adjust thresholds based on actual system behavior
2. **Document incidents**: Keep incident log for post-mortem analysis
3. **Test alert routing**: Regularly test notification channels
4. **Tune alert sensitivity**: Balance between false positives and missed issues
5. **Use runbooks**: Create runbooks for common alert scenarios
6. **Monitor alert fatigue**: Track alert volume and resolution times

## Support

For issues with monitoring and alerting:
- Prometheus Docs: https://prometheus.io/docs/
- AlertManager Docs: https://prometheus.io/docs/alerting/latest/alertmanager/
- Grafana Docs: https://grafana.com/docs/
- Contact DevOps team: devops@example.com
