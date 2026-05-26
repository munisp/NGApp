# Blue-Green Deployment Guide

Complete guide for implementing zero-downtime blue-green deployments for the Payment Switch platform.

## Overview

Blue-green deployment is a release management strategy that reduces downtime and risk by running two identical production environments called **Blue** and **Green**.

**Benefits:**
- Zero downtime deployments
- Instant rollback capability
- Safe testing in production environment
- Reduced deployment risk

## Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │     (Nginx)     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
           ┌────────▼────────┐  ┌────▼─────────────┐
           │  Blue Environment│  │ Green Environment│
           │   (Current)      │  │   (New Version)  │
           │   Version 1.0    │  │   Version 1.1    │
           └──────────────────┘  └──────────────────┘
                    │                      │
           ┌────────┴──────────────────────┴────────┐
           │         Shared Infrastructure          │
           │  MySQL │ PostgreSQL │ Redis │ Kafka   │
           └────────────────────────────────────────┘
```

## Prerequisites

1. **Two identical environments** - Blue and Green
2. **Shared database** - Both environments use same database
3. **Load balancer** - Nginx or cloud load balancer
4. **Health checks** - Automated health verification
5. **Monitoring** - Real-time metrics and alerts

## Setup

### 1. Create Blue Environment (Current Production)

```bash
# docker-compose.blue.yml
version: '3.8'

services:
  web-portal-blue:
    image: ghcr.io/your-org/payment-switch/web-portal:v1.0
    container_name: web-portal-blue
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - payment-switch
```

### 2. Create Green Environment (New Version)

```bash
# docker-compose.green.yml
version: '3.8'

services:
  web-portal-green:
    image: ghcr.io/your-org/payment-switch/web-portal:v1.1
    container_name: web-portal-green
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - payment-switch
```

### 3. Configure Nginx Load Balancer

```nginx
# /etc/nginx/conf.d/payment-switch.conf

upstream backend {
    # Blue environment (active)
    server web-portal-blue:3000 weight=100;
    
    # Green environment (standby)
    # server web-portal-green:3001 weight=0;
}

server {
    listen 80;
    server_name payment-switch.com;
    
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://backend;
    }
}
```

## Deployment Process

### Step 1: Deploy Green Environment

```bash
# Pull new Docker image
docker pull ghcr.io/your-org/payment-switch/web-portal:v1.1

# Start green environment
docker-compose -f docker-compose.green.yml up -d

# Wait for services to be ready
sleep 30
```

### Step 2: Run Database Migrations

```bash
# Run migrations on green environment
docker-compose -f docker-compose.green.yml exec web-portal-green pnpm db:push

# Verify migrations
docker-compose -f docker-compose.green.yml exec web-portal-green pnpm db:verify
```

### Step 3: Health Checks

```bash
# Check green environment health
curl -f http://localhost:3001/health || exit 1

# Run smoke tests
./scripts/smoke-test.sh http://localhost:3001
```

### Step 4: Switch Traffic to Green

```bash
# Update nginx configuration
cat > /etc/nginx/conf.d/payment-switch.conf << 'EOF'
upstream backend {
    # Blue environment (standby)
    server web-portal-blue:3000 weight=0;
    
    # Green environment (active)
    server web-portal-green:3001 weight=100;
}
EOF

# Reload nginx (zero downtime)
nginx -t && nginx -s reload
```

### Step 5: Monitor Green Environment

```bash
# Monitor for 5-10 minutes
watch -n 10 'curl -s http://payment-switch.com/health | jq'

# Check error logs
docker-compose -f docker-compose.green.yml logs -f --tail=100

# Monitor Grafana dashboards
open http://grafana.payment-switch.com
```

### Step 6: Stop Blue Environment

```bash
# Once green is stable, stop blue
docker-compose -f docker-compose.blue.yml down

# Clean up old images
docker image prune -f
```

## Rollback Procedure

If issues are detected in the green environment:

### Immediate Rollback

```bash
# Switch traffic back to blue
cat > /etc/nginx/conf.d/payment-switch.conf << 'EOF'
upstream backend {
    # Blue environment (active)
    server web-portal-blue:3000 weight=100;
    
    # Green environment (standby)
    server web-portal-green:3001 weight=0;
}
EOF

# Reload nginx
nginx -s reload

# Stop green environment
docker-compose -f docker-compose.green.yml down
```

### Database Rollback

If database migrations need to be reverted:

```bash
# Restore database from backup
./scripts/restore-database.sh $(date +%Y%m%d)

# Or run rollback migrations
docker-compose -f docker-compose.blue.yml exec web-portal-blue pnpm db:rollback
```

## Automated Blue-Green Deployment Script

```bash
#!/bin/bash
# deploy-blue-green.sh

set -e

NEW_VERSION="$1"
CURRENT_ENV="blue"
NEW_ENV="green"

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

echo "Starting blue-green deployment: $NEW_VERSION"

# Determine current active environment
if docker ps | grep -q "web-portal-green"; then
    CURRENT_ENV="green"
    NEW_ENV="blue"
fi

echo "Current environment: $CURRENT_ENV"
echo "Deploying to: $NEW_ENV"

# Deploy new version to inactive environment
echo "Deploying $NEW_VERSION to $NEW_ENV..."
docker-compose -f docker-compose.$NEW_ENV.yml down
IMAGE_TAG=$NEW_VERSION docker-compose -f docker-compose.$NEW_ENV.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Run health checks
echo "Running health checks..."
if [ "$NEW_ENV" = "blue" ]; then
    PORT=3000
else
    PORT=3001
fi

if ! curl -f http://localhost:$PORT/health; then
    echo "Health check failed! Aborting deployment."
    docker-compose -f docker-compose.$NEW_ENV.yml down
    exit 1
fi

# Run smoke tests
echo "Running smoke tests..."
if ! ./scripts/smoke-test.sh http://localhost:$PORT; then
    echo "Smoke tests failed! Aborting deployment."
    docker-compose -f docker-compose.$NEW_ENV.yml down
    exit 1
fi

# Switch traffic
echo "Switching traffic to $NEW_ENV..."
if [ "$NEW_ENV" = "blue" ]; then
    sed -i 's/server web-portal-blue:3000 weight=0/server web-portal-blue:3000 weight=100/' /etc/nginx/conf.d/payment-switch.conf
    sed -i 's/server web-portal-green:3001 weight=100/server web-portal-green:3001 weight=0/' /etc/nginx/conf.d/payment-switch.conf
else
    sed -i 's/server web-portal-blue:3000 weight=100/server web-portal-blue:3000 weight=0/' /etc/nginx/conf.d/payment-switch.conf
    sed -i 's/server web-portal-green:3001 weight=0/server web-portal-green:3001 weight=100/' /etc/nginx/conf.d/payment-switch.conf
fi

nginx -s reload

# Monitor for 5 minutes
echo "Monitoring new environment for 5 minutes..."
for i in {1..30}; do
    if ! curl -f http://payment-switch.com/health; then
        echo "Health check failed! Rolling back..."
        # Rollback
        if [ "$NEW_ENV" = "blue" ]; then
            sed -i 's/server web-portal-blue:3000 weight=100/server web-portal-blue:3000 weight=0/' /etc/nginx/conf.d/payment-switch.conf
            sed -i 's/server web-portal-green:3001 weight=0/server web-portal-green:3001 weight=100/' /etc/nginx/conf.d/payment-switch.conf
        else
            sed -i 's/server web-portal-blue:3000 weight=0/server web-portal-blue:3000 weight=100/' /etc/nginx/conf.d/payment-switch.conf
            sed -i 's/server web-portal-green:3001 weight=100/server web-portal-green:3001 weight=0/' /etc/nginx/conf.d/payment-switch.conf
        fi
        nginx -s reload
        exit 1
    fi
    sleep 10
done

# Stop old environment
echo "Stopping old environment: $CURRENT_ENV"
docker-compose -f docker-compose.$CURRENT_ENV.yml down

echo "Deployment completed successfully!"
echo "Active environment: $NEW_ENV"
echo "Version: $NEW_VERSION"
```

## Canary Deployment (Advanced)

Gradually shift traffic from blue to green:

```nginx
upstream backend {
    # Blue environment (90% traffic)
    server web-portal-blue:3000 weight=90;
    
    # Green environment (10% traffic)
    server web-portal-green:3001 weight=10;
}
```

**Gradual rollout:**
1. Start: 100% blue, 0% green
2. Canary: 90% blue, 10% green (monitor for 10 minutes)
3. Half: 50% blue, 50% green (monitor for 10 minutes)
4. Final: 0% blue, 100% green

## Database Considerations

### Backward Compatible Migrations

Always ensure database changes are backward compatible:

```sql
-- ✅ Good: Add nullable column
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;

-- ❌ Bad: Add required column (breaks blue environment)
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NOT NULL;

-- ✅ Good: Two-phase approach
-- Phase 1: Add nullable column
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
-- Deploy green, switch traffic
-- Phase 2: Make column required
ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NOT NULL;
```

### Schema Version Tracking

```sql
CREATE TABLE schema_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(100),
    description TEXT
);
```

## Monitoring During Deployment

### Key Metrics to Watch

1. **Response Time** - Should remain consistent
2. **Error Rate** - Should not increase
3. **Request Rate** - Should remain stable
4. **Database Connections** - Should not spike
5. **Memory Usage** - Should not increase significantly
6. **CPU Usage** - Should remain within normal range

### Grafana Alerts

Set up alerts for deployment monitoring:

```yaml
- alert: HighErrorRateDuringDeployment
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected during deployment"
```

## Best Practices

1. **Always run health checks** before switching traffic
2. **Monitor for at least 5 minutes** after switching
3. **Keep blue environment running** until green is proven stable
4. **Automate rollback** for quick recovery
5. **Use feature flags** for risky changes
6. **Test in staging** before production
7. **Communicate with team** during deployment
8. **Document any issues** for future reference

## Troubleshooting

### Issue: Health checks failing on green

```bash
# Check logs
docker-compose -f docker-compose.green.yml logs

# Check environment variables
docker-compose -f docker-compose.green.yml exec web-portal-green env

# Test database connection
docker-compose -f docker-compose.green.yml exec web-portal-green pnpm db:test
```

### Issue: Database migration failed

```bash
# Check migration status
docker-compose -f docker-compose.green.yml exec web-portal-green pnpm db:status

# Rollback migration
docker-compose -f docker-compose.green.yml exec web-portal-green pnpm db:rollback

# Restore from backup
./scripts/restore-database.sh
```

### Issue: Performance degradation after switch

```bash
# Check resource usage
docker stats

# Check database queries
docker-compose -f docker-compose.green.yml exec web-portal-green pnpm db:slow-queries

# Rollback immediately
./scripts/rollback-deployment.sh
```

## Checklist

Before deployment:
- [ ] New version tested in staging
- [ ] Database migrations reviewed
- [ ] Rollback plan prepared
- [ ] Team notified
- [ ] Monitoring dashboards open
- [ ] On-call engineer available

During deployment:
- [ ] Green environment deployed
- [ ] Health checks passed
- [ ] Smoke tests passed
- [ ] Traffic switched to green
- [ ] Monitoring for 5-10 minutes
- [ ] No errors or performance issues

After deployment:
- [ ] Blue environment stopped
- [ ] Deployment documented
- [ ] Team notified of success
- [ ] Metrics reviewed
- [ ] Lessons learned recorded

## Resources

- [Blue-Green Deployment Pattern](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Zero Downtime Deployments](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/)
- [Database Migration Best Practices](https://www.brunton-spall.co.uk/post/2014/05/06/database-migrations-done-right/)
