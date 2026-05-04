# Docker Deployment Guide - Next-Generation Payment Switch

## Overview

This guide provides step-by-step instructions for deploying the Next-Generation Payment Switch platform using Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 8GB RAM
- At least 20GB free disk space

## Quick Start

### 1. Clone and Navigate

```bash
cd nextgen-payment-switch
```

### 2. Create Environment File

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start All Services

```bash
docker-compose up -d
```

### 4. Verify Deployment

```bash
docker-compose ps
```

All services should show status as "Up" or "Up (healthy)".

## Services Overview

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Payment Gateway | 8001 | http://localhost:8001 | Payment initiation and management |
| Fraud Detection Service | 8002 | http://localhost:8002 | AI-powered fraud detection |
| Settlement Service | 8003 | http://localhost:8003 | Settlement and reconciliation |
| Offline Payments | 8004 | http://localhost:8004 | Offline payment sync |
| Fraud Detection | 8005 | http://localhost:8005 | Rule-based fraud detection |
| PostgreSQL | 5432 | localhost:5432 | Primary database |
| Redis | 6379 | localhost:6379 | Cache and session store |
| Temporal | 7233 | localhost:7233 | Workflow engine |
| Temporal UI | 8080 | http://localhost:8080 | Workflow dashboard |
| Prometheus | 9090 | http://localhost:9090 | Metrics collection |
| Grafana | 3000 | http://localhost:3000 | Monitoring dashboards |
| NGINX | 80 | http://localhost | API Gateway |

## Detailed Deployment Steps

### Step 1: Database Initialization

The PostgreSQL database is automatically initialized with the schema on first startup:

```bash
# Check database logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U payment_user -d payment_switch
```

Verify tables:
```sql
\dt
```

You should see 11 tables:
- participants
- accounts
- transactions
- fraud_checks
- fraud_rules
- settlement_windows
- participant_positions
- settlements
- offline_transactions
- audit_log
- system_events

### Step 2: Service Health Checks

Check health of all services:

```bash
# Payment Gateway
curl http://localhost:8001/api/v1/payments/health

# Fraud Detection Service
curl http://localhost:8002/api/v1/fraud/health

# Settlement Service
curl http://localhost:8003/api/v1/settlement/health

# Offline Payments
curl http://localhost:8004/api/v1/offline/health

# Fraud Detection
curl http://localhost:8005/api/v1/fraud/health
```

All should return `{"status": "healthy"}`.

### Step 3: Test API Endpoints

#### Initiate a Payment

```bash
curl -X POST http://localhost/api/v1/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "MSISDN",
      "identifier": "+1234567890"
    },
    "destination": {
      "type": "MSISDN",
      "identifier": "+0987654321"
    },
    "amount": {
      "currency": "USD",
      "value": "100.00"
    },
    "transactionType": "P2P",
    "channel": "MOBILE"
  }'
```

#### Check Fraud Score

```bash
curl -X POST http://localhost/api/v1/fraud/score \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "txn-123",
    "payer_id": "user-1",
    "payee_id": "user-2",
    "amount": 100.00,
    "currency": "USD",
    "channel": "MOBILE",
    "timestamp": "2024-11-03T12:00:00Z"
  }'
```

### Step 4: Access Monitoring

#### Grafana Dashboard

1. Open http://localhost:3000
2. Login with:
   - Username: `admin`
   - Password: `admin_2024`
3. Navigate to Dashboards → Browse
4. Select "Payment Switch Overview"

#### Prometheus Metrics

1. Open http://localhost:9090
2. Query examples:
   - `fraud_score_latency_seconds` - Fraud detection latency
   - `fraud_detections_total` - Total fraud detections
   - `scoring_requests_total` - Total scoring requests

#### Temporal UI

1. Open http://localhost:8080
2. View workflow executions
3. Monitor payment workflows

## Configuration

### Environment Variables

Edit `.env` file to customize:

```env
# Database
POSTGRES_DB=payment_switch
POSTGRES_USER=payment_user
POSTGRES_PASSWORD=<your-secure-password>

# Redis
REDIS_PASSWORD=<your-secure-password>

# Grafana
GF_SECURITY_ADMIN_PASSWORD=<your-secure-password>

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

### Scaling Services

Scale individual services:

```bash
# Scale fraud detection service to 3 instances
docker-compose up -d --scale fraud-detection-service=3

# Scale payment gateway to 5 instances
docker-compose up -d --scale payment-gateway=5
```

### Resource Limits

Edit `docker-compose.yml` to add resource limits:

```yaml
services:
  payment-gateway:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f payment-gateway

# Last 100 lines
docker-compose logs --tail=100 fraud-detection-service
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart payment-gateway
```

### Stop Services

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop fraud-detection-service
```

### Update Services

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Backup Database

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U payment_user payment_switch > backup_$(date +%Y%m%d).sql

# Restore from backup
docker-compose exec -T postgres psql -U payment_user payment_switch < backup_20241103.sql
```

### Clean Up

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   docker-compose logs <service-name>
   ```

2. Check dependencies:
   ```bash
   docker-compose ps
   ```

3. Verify network:
   ```bash
   docker network ls
   docker network inspect nextgen-payment-switch_payment-network
   ```

### Database Connection Issues

1. Check PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Test connection:
   ```bash
   docker-compose exec postgres pg_isready -U payment_user
   ```

3. Check database logs:
   ```bash
   docker-compose logs postgres
   ```

### High Memory Usage

1. Check resource usage:
   ```bash
   docker stats
   ```

2. Reduce service replicas:
   ```bash
   docker-compose up -d --scale fraud-detection-service=1
   ```

3. Add memory limits in `docker-compose.yml`

### Port Conflicts

If ports are already in use, edit `docker-compose.yml` to change port mappings:

```yaml
ports:
  - "8081:8001"  # Changed from 8001:8001
```

## Production Considerations

### Security

1. **Change Default Passwords**: Update all passwords in `.env`
2. **Enable TLS**: Configure NGINX with SSL certificates
3. **Network Isolation**: Use Docker networks for service isolation
4. **Secrets Management**: Use Docker secrets or external vault

### High Availability

1. **Database Replication**: Set up PostgreSQL streaming replication
2. **Redis Cluster**: Deploy Redis in cluster mode
3. **Load Balancing**: Use multiple NGINX instances with external load balancer
4. **Service Redundancy**: Run multiple instances of each service

### Monitoring

1. **Alerts**: Configure Prometheus alerting rules
2. **Log Aggregation**: Integrate with ELK stack or similar
3. **Distributed Tracing**: Add Jaeger or Zipkin
4. **Uptime Monitoring**: Use external monitoring service

### Performance

1. **Database Tuning**: Optimize PostgreSQL configuration
2. **Connection Pooling**: Configure PgBouncer
3. **Caching**: Tune Redis cache policies
4. **Resource Allocation**: Adjust CPU and memory limits

## API Documentation

Once deployed, access interactive API documentation:

- Payment Gateway: http://localhost:8001/docs
- Fraud Detection Service: http://localhost:8002/docs
- Settlement Service: http://localhost:8003/docs
- Offline Payments: http://localhost:8004/docs
- Fraud Detection: http://localhost:8005/docs

## Support

For issues and questions:
- Check logs: `docker-compose logs`
- Review documentation: `docs/` directory
- Check service health: Health check endpoints

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX (Port 80)                      │
│                      API Gateway & Load Balancer             │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┬──────────┬──────────┬──────────┐
    │                 │          │          │          │
┌───▼────┐  ┌────────▼───┐  ┌──▼────┐  ┌──▼────┐  ┌─▼─────┐
│Payment │  │Fraud       │  │Settle │  │Offline│  │Fraud  │
│Gateway │  │Detection   │  │ment   │  │Payment│  │Detect │
│:8001   │  │Service     │  │:8003  │  │:8004  │  │:8005  │
└───┬────┘  │:8002       │  └───┬───┘  └───┬───┘  └───┬───┘
    │       └──────┬─────┘      │          │          │
    │              │            │          │          │
    └──────┬───────┴────────────┴──────────┴──────────┘
           │
    ┌──────┴──────┬──────────┬──────────┐
    │             │          │          │
┌───▼────┐  ┌────▼────┐  ┌──▼────┐  ┌─▼─────────┐
│Postgres│  │Redis    │  │Temporal│  │Prometheus │
│:5432   │  │:6379    │  │:7233   │  │:9090      │
└────────┘  └─────────┘  └────────┘  └───────────┘
                                           │
                                      ┌────▼────┐
                                      │Grafana  │
                                      │:3000    │
                                      └─────────┘
```

## Next Steps

1. Configure production environment variables
2. Set up SSL/TLS certificates
3. Configure backup and disaster recovery
4. Set up monitoring alerts
5. Perform load testing
6. Review security hardening checklist
