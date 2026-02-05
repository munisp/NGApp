# Staging Environment Guide

Complete guide for deploying and managing the staging environment for the African Fintech Mobile App.

## Overview

The staging environment is a production-like environment used for:
- **Integration testing** - Validate all services work together
- **Load testing** - Test performance under realistic load
- **Security testing** - Validate security controls and monitoring
- **User acceptance testing** - Allow stakeholders to test new features
- **Pre-production validation** - Final checks before production deployment

## Architecture

The staging environment mirrors production with reduced capacity:

| Component | Production | Staging | Difference |
|-----------|------------|---------|------------|
| API Server | 3-20 replicas | 3 replicas | No autoscaling |
| OCR Service | 2 replicas (GPU) | 2 replicas (GPU) | Same |
| Video Liveness | 2 replicas | 2 replicas | Same |
| Facial Recognition | 2 replicas | 2 replicas | Same |
| PostgreSQL | 1 primary + 1 replica | 1 instance | No replication |
| Wazuh Indexer | 3 nodes | 1 node | Reduced cluster |
| Wazuh Manager | 1 replica | 1 replica | Same |
| Wazuh Dashboard | 2 replicas | 1 replica | Reduced |

## Deployment

### Prerequisites

1. **Kubernetes Cluster**
   - Kubernetes 1.27+
   - At least 3 worker nodes
   - GPU support for OCR service
   - 50GB+ available storage

2. **Docker Registry**
   - Access to push images
   - Credentials configured

3. **Tools**
   - kubectl CLI
   - docker CLI
   - openssl

### Quick Start

```bash
# Navigate to scripts directory
cd /home/ubuntu/fintech-mobile-app/scripts

# Deploy staging environment
./deploy-staging.sh

# Or skip image build (use existing images)
./deploy-staging.sh skip-build

# Or skip Wazuh deployment
./deploy-staging.sh skip-wazuh
```

### Custom Configuration

```bash
# Set custom registry and version
REGISTRY=your-registry.io \
VERSION=v1.2.3 \
NAMESPACE=fintech-staging \
./deploy-staging.sh
```

### Step-by-Step Deployment

**1. Create Namespace**
```bash
kubectl create namespace fintech-staging
kubectl label namespace fintech-staging environment=staging
```

**2. Build and Push Images**
```bash
# API Server
cd /home/ubuntu/fintech-mobile-app
docker build -t your-registry.io/fintech-api:latest -f Dockerfile.api .
docker push your-registry.io/fintech-api:latest

# OCR Service
cd /home/ubuntu/python-services/multi-ocr
docker build -t your-registry.io/fintech-ocr:latest .
docker push your-registry.io/fintech-ocr:latest

# Video Liveness
cd /home/ubuntu/python-services/video-liveness
docker build -t your-registry.io/fintech-video-liveness:latest .
docker push your-registry.io/fintech-video-liveness:latest

# Facial Recognition
cd /home/ubuntu/python-services/facial-recognition
docker build -t your-registry.io/fintech-facial-recognition:latest .
docker push your-registry.io/fintech-facial-recognition:latest
```

**3. Create Secrets**
```bash
# Database credentials
kubectl create secret generic database-creds \
  -n fintech-staging \
  --from-literal=username=fintech_user \
  --from-literal=password=$(openssl rand -base64 32) \
  --from-literal=database=fintech_staging

# JWT secret
kubectl create secret generic jwt-secret \
  -n fintech-staging \
  --from-literal=secret=$(openssl rand -base64 64)

# Encryption key
kubectl create secret generic encryption-key \
  -n fintech-staging \
  --from-literal=key=$(openssl rand -base64 32)
```

**4. Deploy Services**
```bash
# Deploy in order
kubectl apply -f k8s/staging/postgres.yaml
kubectl apply -f k8s/staging/ocr-service.yaml
kubectl apply -f k8s/staging/video-liveness.yaml
kubectl apply -f k8s/staging/facial-recognition.yaml
kubectl apply -f k8s/staging/api-server.yaml
```

**5. Verify Deployment**
```bash
# Check all pods are running
kubectl get pods -n fintech-staging

# Check services
kubectl get svc -n fintech-staging

# Get API URL
kubectl get svc api-server -n fintech-staging -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

## Configuration

### Environment Variables

**API Server:**
```yaml
env:
  - name: NODE_ENV
    value: "staging"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: database-url
        key: url
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: jwt-secret
        key: secret
  - name: ENCRYPTION_KEY
    valueFrom:
      secretKeyRef:
        name: encryption-key
        key: key
  - name: OCR_SERVICE_URL
    value: "http://ocr-service:5010"
  - name: VIDEO_LIVENESS_URL
    value: "http://video-liveness:5011"
  - name: FACIAL_RECOGNITION_URL
    value: "http://facial-recognition:5009"
  - name: LOG_LEVEL
    value: "DEBUG"
  - name: ENABLE_DEBUG_LOGS
    value: "true"
```

**OCR Service:**
```yaml
env:
  - name: ENVIRONMENT
    value: "staging"
  - name: LOG_LEVEL
    value: "INFO"
  - name: MODEL_CACHE_DIR
    value: "/models"
  - name: MAX_CONCURRENT_REQUESTS
    value: "10"
```

**Video Liveness:**
```yaml
env:
  - name: ENVIRONMENT
    value: "staging"
  - name: LOG_LEVEL
    value: "INFO"
  - name: CONFIDENCE_THRESHOLD
    value: "0.7"
  - name: MAX_VIDEO_SIZE_MB
    value: "50"
```

### Resource Limits

**API Server:**
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "4Gi"
    cpu: "2"
```

**OCR Service (GPU):**
```yaml
resources:
  requests:
    memory: "4Gi"
    cpu: "2"
    nvidia.com/gpu: "1"
  limits:
    memory: "8Gi"
    cpu: "4"
    nvidia.com/gpu: "1"
```

**Video Liveness:**
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "4Gi"
    cpu: "2"
```

**Database:**
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "4Gi"
    cpu: "2"
```

## Testing

### Health Checks

```bash
# Get API URL
API_URL=$(kubectl get svc api-server -n fintech-staging -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test API health
curl http://${API_URL}/health

# Test OCR service
kubectl port-forward -n fintech-staging svc/ocr-service 5010:5010
curl http://localhost:5010/health

# Test video liveness
kubectl port-forward -n fintech-staging svc/video-liveness 5011:5011
curl http://localhost:5011/health

# Test facial recognition
kubectl port-forward -n fintech-staging svc/facial-recognition 5009:5009
curl http://localhost:5009/health
```

### End-to-End Testing

```bash
# Run E2E tests
cd /home/ubuntu/fintech-mobile-app
API_BASE_URL=http://${API_URL} pnpm test kyc-flow.test.ts
```

### Load Testing

```bash
# Run load tests
cd /home/ubuntu/fintech-mobile-app/scripts
./run-load-tests.sh
```

### Security Audit

```bash
# Run security audit
cd /home/ubuntu/fintech-mobile-app/scripts
./run-security-audit.sh
```

## Monitoring

### Logs

```bash
# View API server logs
kubectl logs -n fintech-staging -l app=api-server --tail=100 -f

# View OCR service logs
kubectl logs -n fintech-staging -l app=ocr-service --tail=100 -f

# View video liveness logs
kubectl logs -n fintech-staging -l app=video-liveness --tail=100 -f

# View database logs
kubectl logs -n fintech-staging postgres-0 --tail=100 -f
```

### Metrics

```bash
# Check resource usage
kubectl top pods -n fintech-staging
kubectl top nodes

# Check pod status
kubectl get pods -n fintech-staging -o wide

# Check events
kubectl get events -n fintech-staging --sort-by='.lastTimestamp'
```

### Wazuh Dashboard

```bash
# Get Wazuh Dashboard URL
WAZUH_URL=$(kubectl get ingress wazuh-dashboard-ingress -n fintech-staging -o jsonpath='{.spec.rules[0].host}')
echo "Wazuh Dashboard: https://${WAZUH_URL}"

# Or use port forwarding
kubectl port-forward -n fintech-staging svc/wazuh-dashboard 5601:443

# Access at https://localhost:5601
# Username: admin
# Password: Check /home/ubuntu/python-services/wazuh/wazuh-passwords.txt
```

## Maintenance

### Update Services

```bash
# Update API server
kubectl set image deployment/api-server \
  -n fintech-staging \
  api-server=your-registry.io/fintech-api:v1.2.3

# Rollout status
kubectl rollout status deployment/api-server -n fintech-staging

# Rollback if needed
kubectl rollout undo deployment/api-server -n fintech-staging
```

### Database Backup

```bash
# Create backup
kubectl exec -n fintech-staging postgres-0 -- \
  pg_dump -U fintech_user fintech_staging | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore backup
gunzip -c backup-20260123.sql.gz | \
  kubectl exec -i -n fintech-staging postgres-0 -- \
  psql -U fintech_user -d fintech_staging
```

### Scale Services

```bash
# Scale API server
kubectl scale deployment api-server -n fintech-staging --replicas=5

# Scale OCR service
kubectl scale deployment ocr-service -n fintech-staging --replicas=3
```

### Restart Services

```bash
# Restart API server
kubectl rollout restart deployment/api-server -n fintech-staging

# Restart all services
kubectl rollout restart deployment -n fintech-staging
```

## Cleanup

### Delete Staging Environment

```bash
# Delete namespace (removes all resources)
kubectl delete namespace fintech-staging

# Or delete individual services
kubectl delete deployment --all -n fintech-staging
kubectl delete statefulset --all -n fintech-staging
kubectl delete service --all -n fintech-staging
kubectl delete pvc --all -n fintech-staging
```

### Clean Up Images

```bash
# Remove local images
docker rmi your-registry.io/fintech-api:latest
docker rmi your-registry.io/fintech-ocr:latest
docker rmi your-registry.io/fintech-video-liveness:latest
docker rmi your-registry.io/fintech-facial-recognition:latest
```

## Troubleshooting

### Common Issues

**1. Pods Not Starting**
```bash
# Check pod status
kubectl describe pod <pod-name> -n fintech-staging

# Check logs
kubectl logs <pod-name> -n fintech-staging --previous

# Check events
kubectl get events -n fintech-staging --field-selector involvedObject.name=<pod-name>
```

**2. Service Not Accessible**
```bash
# Check service endpoints
kubectl get endpoints -n fintech-staging

# Check network policies
kubectl get networkpolicies -n fintech-staging

# Test from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n fintech-staging -- \
  curl http://api-server:3000/health
```

**3. Database Connection Issues**
```bash
# Test database connectivity
kubectl run -it --rm psql --image=postgres:15-alpine --restart=Never -n fintech-staging -- \
  psql -h postgres -U fintech_user -d fintech_staging

# Check database logs
kubectl logs -n fintech-staging postgres-0

# Check database secret
kubectl get secret database-creds -n fintech-staging -o yaml
```

**4. GPU Not Available**
```bash
# Check GPU nodes
kubectl get nodes -o json | jq '.items[].status.capacity."nvidia.com/gpu"'

# Check GPU pod allocation
kubectl describe node <gpu-node-name> | grep nvidia.com/gpu

# Verify NVIDIA device plugin
kubectl get pods -n kube-system | grep nvidia
```

**5. Out of Memory**
```bash
# Check memory usage
kubectl top pods -n fintech-staging

# Increase memory limits
kubectl edit deployment <deployment-name> -n fintech-staging

# Or restart pod
kubectl delete pod <pod-name> -n fintech-staging
```

## Best Practices

### Development Workflow

1. **Local Development** → Test on local machine
2. **Staging Deployment** → Deploy to staging environment
3. **Integration Testing** → Run E2E tests
4. **Load Testing** → Validate performance
5. **Security Audit** → Check security controls
6. **UAT** → User acceptance testing
7. **Production Deployment** → Deploy to production

### Staging vs Production Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| **Data** | Test data | Real user data |
| **Scale** | Reduced capacity | Full capacity |
| **Monitoring** | Debug logging | Info logging |
| **Backups** | Daily | Hourly |
| **SSL** | Self-signed or Let's Encrypt | Commercial CA |
| **Domain** | staging.yourcompany.com | api.yourcompany.com |
| **Costs** | ~30% of production | 100% |

### Security Considerations

- **Use separate credentials** for staging and production
- **Encrypt secrets** using Kubernetes secrets or external secret managers
- **Restrict access** to staging environment (VPN, IP whitelist)
- **Monitor security events** with Wazuh SIEM
- **Rotate credentials** regularly
- **Use test data** only (no real PII)

## Cost Estimation

### Monthly Costs (AWS)

| Component | Instance Type | Monthly Cost |
|-----------|---------------|--------------|
| API Servers (3x) | t3.large | $150 |
| OCR Servers (2x) | p3.2xlarge | $3,000 |
| Video Liveness (2x) | t3.large | $100 |
| Facial Recognition (2x) | t3.large | $100 |
| Database | db.t3.large | $150 |
| Storage (100GB) | EBS gp3 | $10 |
| Load Balancer | ALB | $25 |
| **Total** | - | **~$3,535/month** |

### Cost Optimization

- **Use spot instances** for non-critical services
- **Schedule downtime** during off-hours (nights, weekends)
- **Share GPU instances** between OCR and other services
- **Use smaller database** instance (db.t3.medium)
- **Reduce storage** to 50GB

**Optimized Cost:** ~$2,000/month

## Support

For issues and questions:
- Documentation: https://docs.yourcompany.com
- Email: staging-support@yourcompany.com
- Slack: #fintech-staging

---

**Last Updated:** January 23, 2026
**Version:** 1.0.0
