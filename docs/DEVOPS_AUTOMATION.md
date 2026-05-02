# DevOps Automation Guide

Complete guide for automated operations, CI/CD, monitoring, and incident response for the Payment Switch platform.

## Overview

This guide covers the complete DevOps automation stack including:

- **CI/CD Pipelines** - Automated testing and deployment
- **Auto-Scaling** - Dynamic resource management
- **Monitoring & Alerting** - Proactive issue detection
- **Incident Response** - Automated recovery procedures
- **Disaster Recovery** - Backup and restoration
- **Security Automation** - Continuous security scanning

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Code   │  │  Tests   │  │  Docs    │  │ Configs  │   │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼───────────┼─────────────┼─────────────┼──────────┘
        │           │             │             │
        ▼           ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions CI/CD                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Lint   │  │   Test   │  │  Build   │  │  Deploy  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│     Staging      │      │    Production    │
│   Environment    │      │   Environment    │
├──────────────────┤      ├──────────────────┤
│ • Auto-deploy    │      │ • Manual approve │
│ • Load testing   │      │ • Blue-green     │
│ • Integration    │      │ • Monitoring     │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         └────────────┬────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│   Monitoring     │      │   Alerting       │
│  (Prometheus)    │      │   (Grafana)      │
└──────────────────┘      └──────────────────┘
         │                         │
         └────────────┬────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Incident Response     │
         │  (Automated Recovery)  │
         └────────────────────────┘
```

## CI/CD Pipeline

### Workflow Overview

**On Push/PR:**
1. Code linting and formatting checks
2. TypeScript type checking
3. Unit and integration tests
4. Security scanning (Snyk, Trivy)
5. Build Docker images
6. Push to container registry

**On Merge to `develop`:**
1. Deploy to staging environment
2. Run smoke tests
3. Run load tests
4. Generate performance report

**On Manual Trigger (Production):**
1. Require approval from 2+ reviewers
2. Create database backup
3. Deploy using blue-green strategy
4. Run health checks
5. Monitor for 10 minutes
6. Rollback on failure

### GitHub Actions Workflows

#### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request:

```yaml
jobs:
  - lint: Code quality checks
  - test: Unit and integration tests
  - security: Vulnerability scanning
  - build: Build application
```

**Key Features:**
- Parallel job execution
- Test coverage reporting
- Security vulnerability scanning
- Build artifact caching

#### 2. Docker Build (`.github/workflows/docker-build.yml`)

Builds and pushes Docker images:

```yaml
jobs:
  - build-and-push: Multi-platform builds
  - scan: Security scanning with Trivy
  - sbom: Generate Software Bill of Materials
```

**Key Features:**
- Multi-architecture builds (amd64, arm64)
- Layer caching for faster builds
- Automated vulnerability scanning
- SBOM generation for compliance

#### 3. Staging Deployment (`.github/workflows/deploy-staging.yml`)

Automatically deploys to staging:

```yaml
jobs:
  - deploy: Deploy to staging environment
  - load-test: Run performance tests
```

**Key Features:**
- Automatic deployment on merge
- Health check verification
- Load testing integration
- Performance regression detection

#### 4. Production Deployment (`.github/workflows/deploy-production.yml`)

Manual production deployment with safeguards:

```yaml
jobs:
  - pre-deployment-checks: Verify readiness
  - backup: Create database backup
  - deploy: Blue-green deployment
  - post-deployment: Verification
  - rollback: Automatic rollback on failure
```

**Key Features:**
- Manual approval requirement
- Multiple deployment strategies
- Automatic rollback
- Comprehensive monitoring

### Setting Up CI/CD

#### 1. Configure GitHub Secrets

```bash
# Required secrets
STAGING_SSH_KEY          # SSH key for staging server
STAGING_HOST             # Staging server hostname
STAGING_USER             # SSH username
PRODUCTION_SSH_KEY       # SSH key for production server
PRODUCTION_HOST          # Production server hostname
PRODUCTION_USER          # SSH username
PRODUCTION_APPROVERS     # GitHub usernames for approval
SLACK_WEBHOOK_URL        # Slack notifications
SNYK_TOKEN              # Snyk security scanning
AWS_ACCESS_KEY_ID       # AWS credentials (for S3 backups)
AWS_SECRET_ACCESS_KEY   # AWS credentials
```

#### 2. Enable GitHub Actions

```bash
# In your repository settings:
Settings → Actions → General → Allow all actions
```

#### 3. Configure Branch Protection

```bash
# For main branch:
- Require pull request reviews (2 approvals)
- Require status checks to pass
- Require branches to be up to date
- Include administrators

# For develop branch:
- Require pull request reviews (1 approval)
- Require status checks to pass
```

## Auto-Scaling

### Kubernetes Auto-Scaling

#### Horizontal Pod Autoscaler (HPA)

Automatically scales pods based on metrics:

```yaml
# kubernetes/base/web-portal-deployment.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-portal-hpa
spec:
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Scaling Behavior:**
- Scale up: Aggressive (double pods every 30s)
- Scale down: Conservative (50% reduction every 60s)
- Stabilization: 5-minute window before scaling down

#### Vertical Pod Autoscaler (VPA)

Automatically adjusts resource requests:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-portal-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-portal
  updatePolicy:
    updateMode: "Auto"
```

### Docker Swarm Auto-Scaling

#### Service Scaling

```yaml
# docker-swarm-stack.yml
services:
  web-portal:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 512M
```

#### Manual Scaling

```bash
# Scale up
docker service scale payment-switch_web-portal=5

# Scale down
docker service scale payment-switch_web-portal=2

# Auto-scale based on metrics (requires external tool)
# Use Orbiter or Docker Swarm Autoscaler
```

### Cloud Provider Auto-Scaling

#### AWS Auto Scaling

```bash
# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name payment-switch-asg \
  --launch-template LaunchTemplateName=payment-switch-template \
  --min-size 3 \
  --max-size 20 \
  --desired-capacity 5 \
  --target-group-arns arn:aws:elasticloadbalancing:... \
  --health-check-type ELB \
  --health-check-grace-period 300

# Create scaling policy
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name payment-switch-asg \
  --policy-name scale-up-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration file://scaling-config.json
```

## Monitoring & Alerting

### Prometheus Configuration

```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
  - static_configs:
    - targets:
      - alertmanager:9093

rule_files:
  - "alerts/*.yml"

scrape_configs:
  - job_name: 'web-portal'
    static_configs:
    - targets: ['web-portal:3000']
  
  - job_name: 'mysql'
    static_configs:
    - targets: ['mysql-exporter:9104']
  
  - job_name: 'redis'
    static_configs:
    - targets: ['redis-exporter:9121']
```

### Alert Rules

```yaml
# monitoring/prometheus/alerts/critical.yml
groups:
- name: critical
  rules:
  - alert: ServiceDown
    expr: up == 0
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
  
  - alert: DatabaseDown
    expr: mysql_up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
```

### Grafana Dashboards

Pre-configured dashboards:

1. **System Overview** - Overall health and performance
2. **Application Metrics** - Request rate, response time, errors
3. **Database Performance** - Queries, connections, slow queries
4. **Infrastructure** - CPU, memory, disk, network
5. **Business Metrics** - Transactions, revenue, user activity

### Alert Channels

#### Email Notifications

```yaml
# monitoring/grafana/provisioning/alerting/notification-channels.yaml
notifiers:
  - name: email-alerts
    type: email
    settings:
      addresses: "ops@payment-switch.com;oncall@payment-switch.com"
      autoResolve: true
```

#### Slack Notifications

```yaml
notifiers:
  - name: slack-alerts
    type: slack
    settings:
      url: "${SLACK_WEBHOOK_URL}"
      recipient: "#alerts"
      username: "Grafana"
      icon_emoji: ":grafana:"
```

## Automated Recovery

### Self-Healing Mechanisms

#### 1. Container Restart Policies

```yaml
# docker-compose.unified.yml
services:
  web-portal:
    restart: unless-stopped
    deploy:
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

#### 2. Health Check Based Recovery

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

#### 3. Automated Rollback

```bash
# scripts/auto-rollback.sh
#!/bin/bash

# Monitor health for 5 minutes after deployment
for i in {1..30}; do
  if ! curl -f http://localhost:3000/health; then
    echo "Health check failed, rolling back..."
    ./scripts/rollback-deployment.sh
    exit 1
  fi
  sleep 10
done
```

### Circuit Breaker Pattern

```typescript
// Implement in application code
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(externalServiceCall, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

breaker.fallback(() => cachedResponse);
```

## Disaster Recovery

### Automated Backups

#### Database Backups

```bash
# Cron schedule
0 2 * * * /opt/payment-switch/scripts/backup-database.sh
0 */6 * * * /opt/payment-switch/scripts/backup-database.sh --incremental
```

#### Configuration Backups

```bash
# scripts/backup-configs.sh
#!/bin/bash

tar -czf /opt/payment-switch/backups/configs-$(date +%Y%m%d).tar.gz \
  /opt/payment-switch/docker-compose.*.yml \
  /opt/payment-switch/.env \
  /opt/payment-switch/monitoring/
```

### Backup Verification

```bash
# scripts/verify-backups.sh
#!/bin/bash

# Test restore in isolated environment
docker-compose -f docker-compose.test.yml up -d
./scripts/restore-database.sh $(date +%Y%m%d)
# Run verification queries
docker-compose -f docker-compose.test.yml down
```

### Recovery Time Objectives (RTO)

- **Database Failure:** < 15 minutes
- **Service Outage:** < 5 minutes
- **Complete Disaster:** < 4 hours

### Recovery Point Objectives (RPO)

- **Critical Data:** < 1 hour
- **User Data:** < 6 hours
- **Logs/Analytics:** < 24 hours

## Security Automation

### Automated Security Scanning

#### 1. Dependency Scanning

```bash
# Run on every commit
pnpm audit --audit-level=high
snyk test --severity-threshold=high
```

#### 2. Container Scanning

```bash
# Scan Docker images
trivy image ghcr.io/your-org/payment-switch/web-portal:latest
```

#### 3. Code Scanning

```bash
# Static code analysis
semgrep --config=auto .
```

### Automated Secret Rotation

```bash
# scripts/rotate-secrets.sh
#!/bin/bash

# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)

# Update in environment
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env

# Restart services
docker-compose -f docker-compose.unified.yml restart web-portal

# Notify team
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"JWT secret rotated successfully"}'
```

## Best Practices

### 1. Infrastructure as Code

- Store all configuration in version control
- Use declarative configuration (YAML)
- Review changes through pull requests
- Test infrastructure changes in staging

### 2. Immutable Infrastructure

- Never modify running containers
- Deploy new versions, don't patch
- Use blue-green deployments
- Maintain rollback capability

### 3. Observability

- Log everything (structured logging)
- Instrument code with metrics
- Trace requests across services
- Monitor business metrics

### 4. Security

- Scan dependencies regularly
- Rotate secrets automatically
- Use least privilege access
- Enable audit logging

### 5. Automation

- Automate repetitive tasks
- Use runbooks for incidents
- Implement self-healing
- Test disaster recovery

## Maintenance Tasks

### Daily

- [ ] Review monitoring dashboards
- [ ] Check backup status
- [ ] Review security alerts
- [ ] Monitor error rates

### Weekly

- [ ] Review performance trends
- [ ] Update dependencies
- [ ] Review access logs
- [ ] Test disaster recovery

### Monthly

- [ ] Conduct security audit
- [ ] Review and update runbooks
- [ ] Capacity planning review
- [ ] Chaos engineering exercises

## Troubleshooting

### Common Issues

**Issue: CI/CD pipeline failing**
```bash
# Check workflow logs
gh run list --workflow=ci.yml
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id> --failed
```

**Issue: Auto-scaling not working**
```bash
# Check HPA status
kubectl get hpa
kubectl describe hpa web-portal-hpa

# Check metrics server
kubectl top nodes
kubectl top pods
```

**Issue: Alerts not firing**
```bash
# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Check alert rules
curl http://prometheus:9090/api/v1/rules

# Test alert
curl -X POST http://alertmanager:9093/api/v1/alerts \
  -d '[{"labels":{"alertname":"test"}}]'
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

## Related Documentation

- [Blue-Green Deployment Guide](./BLUE_GREEN_DEPLOYMENT.md)
- [Load Testing Guide](../load-tests/LOAD_TESTING_EXECUTION_GUIDE.md)
- [API Testing Guide](./API_TESTING_GUIDE.md)
- [Runbooks](./runbooks/)
