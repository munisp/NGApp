# KYC/KYB System Deployment Guide

## Overview

This guide provides instructions for deploying the complete KYC/KYB system with RBAC using either Docker Compose (local/development) or Kubernetes (production).

## System Components

- **PostgreSQL 14**: Database
- **Redis 7**: Caching and session management
- **Kafka + Zookeeper**: Message broker
- **Keycloak 21**: Authentication (OAuth2/OIDC)
- **Permify**: Authorization (fine-grained permissions)
- **Document Verification Service**: OCR and document validation
- **Liveness Detection Service**: Biometric verification
- **AML Screening Service**: Sanctions and PEP checks
- **Risk Scoring Service**: ML-based risk assessment
- **Nginx**: API Gateway and load balancer

## Prerequisites

### Docker Compose Deployment

- Docker 20.10+
- Docker Compose 2.0+
- 8GB RAM minimum
- 20GB disk space

### Kubernetes Deployment

- Kubernetes 1.24+
- kubectl configured
- 16GB RAM minimum (cluster)
- 50GB disk space
- Ingress controller (nginx-ingress recommended)
- Cert-manager (for TLS certificates)

## Quick Start (Docker Compose)

### One-Command Deployment

```bash
cd /path/to/kyc-kyb-system
./scripts/deploy.sh
```

This script will:
1. Stop existing containers
2. Build Docker images
3. Start infrastructure services (PostgreSQL, Redis, Kafka)
4. Start Keycloak and Permify
5. Initialize realm and permissions
6. Start application services
7. Start Nginx API gateway

### Manual Deployment

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## Quick Start (Kubernetes)

### One-Command Deployment

```bash
cd /path/to/kyc-kyb-system
./scripts/deploy-k8s.sh
```

This script will:
1. Create namespace
2. Create secrets and configmaps
3. Deploy all services
4. Wait for services to be ready
5. Initialize Keycloak and Permify
6. Deploy ingress

### Manual Deployment

```bash
# Create namespace
kubectl apply -f kubernetes/base/namespace.yaml

# Create secrets and configmaps
kubectl apply -f kubernetes/base/secrets.yaml

# Deploy services
kubectl apply -f kubernetes/base/deployments.yaml
kubectl apply -f kubernetes/base/services.yaml

# Deploy ingress
kubectl apply -f kubernetes/base/ingress.yaml

# Check status
kubectl get all -n kyc-kyb-system
```

## Service URLs (Docker Compose)

| Service | URL | Description |
|---------|-----|-------------|
| Keycloak Admin | http://localhost:8080 | Authentication management |
| Permify API | http://localhost:3476 | Authorization API |
| Document Verification | http://localhost:8001 | Document OCR and validation |
| Liveness Detection | http://localhost:8002 | Biometric verification |
| AML Screening | http://localhost:8003 | Sanctions screening |
| Risk Scoring | http://localhost:8004 | Risk assessment |
| API Gateway | http://localhost:80 | Unified API endpoint |

## Default Credentials

### Keycloak Admin

- **Username**: admin
- **Password**: admin_secure_password_2026
- **URL**: http://localhost:8080

### Test Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | system_administrator |
| compliance | compliance123 | compliance_officer |
| kyc_analyst | kyc123 | kyc_analyst |
| risk_manager | risk123 | risk_manager |
| operator | operator123 | kyc_operator |

### Database

- **Host**: localhost:5432
- **Database**: kyc_kyb_system
- **Username**: kyc_admin
- **Password**: kyc_secure_password_2026

### Redis

- **Host**: localhost:6379
- **Password**: redis_secure_password_2026

## Testing the Deployment

### 1. Health Checks

```bash
# Check all services
curl http://localhost:8001/health  # Document Verification
curl http://localhost:8002/health  # Liveness
curl http://localhost:8003/health  # AML Screening
curl http://localhost:8004/health  # Risk Scoring
```

### 2. Get Authentication Token

```bash
curl -X POST "http://localhost:8080/realms/kyc-kyb-system/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=kyc_analyst" \
  -d "password=kyc123" \
  -d "grant_type=password" \
  -d "client_id=liveness-service"
```

### 3. Test Protected Endpoint

```bash
# Replace TOKEN with the access_token from step 2
curl -X POST "http://localhost:8002/api/v1/liveness/check" \
  -H "Authorization: Bearer TOKEN" \
  -F "customer_id=CUST-001" \
  -F "liveness_type=passive" \
  -F "file=@selfie.jpg"
```

### 4. Run Integration Tests

```bash
cd security/tests
python rbac_integration_test.py
```

## Monitoring

### Docker Compose

```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f liveness-service

# Check resource usage
docker stats
```

### Kubernetes

```bash
# View logs
kubectl logs -f -l app=liveness -n kyc-kyb-system

# Check resource usage
kubectl top pods -n kyc-kyb-system

# Check events
kubectl get events -n kyc-kyb-system --sort-by='.lastTimestamp'
```

## Scaling

### Docker Compose

```bash
# Scale a service
docker-compose up -d --scale liveness-service=3
```

### Kubernetes

```bash
# Scale deployment
kubectl scale deployment liveness --replicas=5 -n kyc-kyb-system

# Enable autoscaling
kubectl autoscale deployment liveness \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n kyc-kyb-system
```

## Backup and Restore

### PostgreSQL Backup

```bash
# Docker Compose
docker-compose exec postgres pg_dump -U kyc_admin kyc_kyb_system > backup.sql

# Kubernetes
kubectl exec -n kyc-kyb-system postgres-0 -- pg_dump -U kyc_admin kyc_kyb_system > backup.sql
```

### PostgreSQL Restore

```bash
# Docker Compose
docker-compose exec -T postgres psql -U kyc_admin kyc_kyb_system < backup.sql

# Kubernetes
kubectl exec -i -n kyc-kyb-system postgres-0 -- psql -U kyc_admin kyc_kyb_system < backup.sql
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]

# Rebuild and restart
docker-compose up -d --build [service-name]
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U kyc_admin -d kyc_kyb_system -c "SELECT 1"
```

### Keycloak Not Accessible

```bash
# Check Keycloak logs
docker-compose logs keycloak

# Wait for Keycloak to be ready
curl -sf http://localhost:8080/health/ready

# Restart Keycloak
docker-compose restart keycloak
```

### Permission Denied Errors

```bash
# Check RBAC middleware logs
docker-compose logs liveness-service | grep -i "permission"

# Verify token is valid
# Decode JWT at https://jwt.io

# Check Permify is running
curl http://localhost:3476/healthz
```

## Stopping the System

### Docker Compose

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Kubernetes

```bash
# Delete all resources
kubectl delete namespace kyc-kyb-system

# Or delete specific resources
kubectl delete -f kubernetes/base/
```

## Production Considerations

### Security

1. **Change default passwords** in `kubernetes/base/secrets.yaml`
2. **Enable TLS** for all services
3. **Configure firewall** rules
4. **Enable audit logging**
5. **Set up monitoring** (Prometheus + Grafana)
6. **Configure backup** automation

### Performance

1. **Increase replicas** for high availability
2. **Configure resource limits** appropriately
3. **Enable horizontal pod autoscaling**
4. **Use persistent volumes** for stateful services
5. **Configure caching** strategies

### Compliance

1. **Enable audit logs** for all API calls
2. **Configure log retention** policies
3. **Set up compliance monitoring**
4. **Regular security audits**
5. **Data encryption** at rest and in transit

## Support

For issues or questions:
- Check logs: `docker-compose logs` or `kubectl logs`
- Run health checks: `curl http://localhost:8001/health`
- Review documentation: `/docs`
- Contact: devops@insurance.com

## License

Proprietary - Insurance Company 2026
