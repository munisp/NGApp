# Master Deployment Guide
**African Fintech Mobile App - Production Deployment**

**Document Version:** 1.0  
**Last Updated:** January 23, 2026  
**Target Environment:** Production (On-Premise + Cloud)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Validation](#post-deployment-validation)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Related Documentation](#related-documentation)

---

## Overview

This master guide consolidates all deployment procedures for the African Fintech Mobile App platform. The system consists of:

- **Mobile Application**: React Native app (iOS/Android) with Expo
- **Backend API**: Node.js + tRPC + PostgreSQL
- **AI Services**: OLMOCR, GOT-OCR2.0, Video Liveness Detection
- **Security**: Wazuh SIEM, MFA, encryption at rest/transit
- **Infrastructure**: Kubernetes (on-premise) or cloud-native

**Deployment Models:**
- **On-Premise**: Full Kubernetes deployment on OpenStack or bare metal
- **Hybrid**: Kubernetes + managed cloud services (RDS, S3)
- **Cloud-Native**: Fully managed services (EKS, RDS, S3, etc.)

---

## Prerequisites

### Hardware Requirements

**Minimum Production Cluster:**

| Component | Specification | Quantity | Purpose |
|-----------|---------------|----------|---------|
| **Control Plane Nodes** | 4 CPU, 8GB RAM, 100GB SSD | 3 | Kubernetes masters |
| **Worker Nodes** | 8 CPU, 16GB RAM, 200GB SSD | 5 | Application workloads |
| **GPU Nodes** | 8 CPU, 32GB RAM, 1x NVIDIA T4/V100 | 2 | OCR services |
| **Database Server** | 16 CPU, 64GB RAM, 1TB NVMe SSD | 2 | PostgreSQL primary + replica |
| **Storage Server** | 8 CPU, 16GB RAM, 10TB HDD | 2 | S3-compatible storage (MinIO) |
| **SIEM Server** | 8 CPU, 32GB RAM, 2TB SSD | 3 | Wazuh manager + indexer |

**Network Requirements:**
- **Bandwidth**: Minimum 1 Gbps internal, 100 Mbps external
- **Latency**: < 10ms between nodes
- **Firewall**: Ports 80, 443, 3000, 5432, 6379, 9200, 1514, 1515

### Software Requirements

**Operating System:**
- Ubuntu 22.04 LTS or RHEL 8+
- Kernel 5.15+ (for eBPF support)

**Container Runtime:**
- containerd 1.6+ or Docker 24+
- NVIDIA Container Toolkit (for GPU nodes)

**Kubernetes:**
- Kubernetes 1.28+
- kubectl 1.28+
- Helm 3.12+

**Database:**
- PostgreSQL 15+
- Redis 7+

**Monitoring:**
- Prometheus 2.45+
- Grafana 10+

### Access Requirements

**Credentials Needed:**
- Kubernetes cluster admin access
- Database superuser credentials
- S3/MinIO access keys
- SSL/TLS certificates
- OAuth client credentials (optional)
- SMTP credentials (for email notifications)
- Wazuh API credentials

**Accounts Needed:**
- Docker registry account (for pulling images)
- DNS management access
- SSL certificate authority access

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │   CDN   │
                    │ Cloudflare │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │  Load   │
                    │ Balancer│
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │  API    │     │  API    │     │  API    │
   │ Server  │     │ Server  │     │ Server  │
   │  Pod    │     │  Pod    │     │  Pod    │
   └────┬────┘     └────┬────┘     └────┬────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
   │ OLMOCR  │     │GOT-OCR  │     │  Video  │
   │ Service │     │ Service │     │Liveness │
   │ (GPU)   │     │ (GPU)   │     │ Service │
   └────┬────┘     └────┬────┘     └────┬────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ┌────▼────┐
                    │ Redis   │
                    │ Cache   │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │PostgreSQL│
                    │ Primary │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │PostgreSQL│
                    │ Replica │
                    └─────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Security & Monitoring                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Wazuh   │  │  Wazuh   │  │  Wazuh   │  │Prometheus│       │
│  │ Manager  │  │ Indexer  │  │Dashboard │  │ Grafana  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

| Component | Technology | Replicas | Resources | Storage |
|-----------|------------|----------|-----------|---------|
| **API Server** | Node.js 22 + tRPC | 3-5 | 2 CPU, 4GB RAM | Stateless |
| **Database** | PostgreSQL 15 | 2 (primary + replica) | 8 CPU, 32GB RAM | 500GB SSD |
| **Redis Cache** | Redis 7 | 3 (cluster) | 2 CPU, 4GB RAM | 10GB SSD |
| **OLMOCR** | Python + PyTorch | 2 | 4 CPU, 16GB RAM, 1 GPU | 50GB SSD |
| **GOT-OCR2.0** | Python + PyTorch | 2 | 4 CPU, 16GB RAM, 1 GPU | 50GB SSD |
| **Video Liveness** | Python + OpenCV | 2 | 4 CPU, 8GB RAM | 20GB SSD |
| **Wazuh Manager** | Wazuh 4.7 | 1 | 4 CPU, 8GB RAM | 100GB SSD |
| **Wazuh Indexer** | OpenSearch | 3 | 4 CPU, 16GB RAM | 500GB SSD |
| **Wazuh Dashboard** | Kibana | 1 | 2 CPU, 4GB RAM | 10GB SSD |
| **MinIO** | S3-compatible storage | 4 | 4 CPU, 8GB RAM | 5TB HDD |

---

## Deployment Steps

### Step 1: Prepare Infrastructure

**1.1 Provision Kubernetes Cluster**

```bash
# For on-premise deployment with kubeadm
./scripts/deploy-staging.sh --mode on-premise --cluster-init

# For cloud deployment (EKS example)
./scripts/deploy-staging.sh --mode cloud --provider aws
```

**1.2 Install Required Components**

```bash
# Install NVIDIA GPU Operator (for GPU nodes)
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/gpu-operator/master/deployments/gpu-operator.yaml

# Install cert-manager (for SSL certificates)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install ingress-nginx
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

**1.3 Configure Storage**

```bash
# Deploy MinIO for S3-compatible storage
kubectl apply -f /home/ubuntu/python-services/multi-ocr/k8s/minio-deployment.yaml

# Or configure cloud storage
# AWS: Create S3 buckets
# Azure: Create Blob Storage containers
# GCP: Create Cloud Storage buckets
```

### Step 2: Deploy Database

**2.1 Deploy PostgreSQL**

```bash
# Create namespace
kubectl create namespace production

# Deploy PostgreSQL with replication
kubectl apply -f /home/ubuntu/fintech-mobile-app/k8s/postgresql-statefulset.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgresql --timeout=300s
```

**2.2 Initialize Database**

```bash
# Run database migrations
cd /home/ubuntu/fintech-mobile-app
pnpm db:push

# Verify database schema
kubectl exec -it postgresql-0 -- psql -U postgres -d fintech -c "\dt"
```

**2.3 Deploy Redis**

```bash
# Deploy Redis cluster
kubectl apply -f /home/ubuntu/fintech-mobile-app/k8s/redis-deployment.yaml

# Verify Redis is running
kubectl exec -it redis-0 -- redis-cli ping
```

### Step 3: Deploy AI Services

**3.1 Deploy OLMOCR Service**

```bash
# Deploy OLMOCR with GPU support
kubectl apply -f /home/ubuntu/python-services/multi-ocr/k8s/olmocr-deployment.yaml

# Wait for service to be ready
kubectl wait --for=condition=ready pod -l app=olmocr --timeout=600s

# Test OLMOCR service
curl -X POST http://olmocr-service:5010/health
```

**3.2 Deploy GOT-OCR2.0 Service**

```bash
# Deploy GOT-OCR2.0 with GPU support
kubectl apply -f /home/ubuntu/python-services/multi-ocr/k8s/got-ocr2-deployment.yaml

# Wait for service to be ready
kubectl wait --for=condition=ready pod -l app=got-ocr2 --timeout=600s

# Test GOT-OCR2.0 service
curl -X POST http://got-ocr2-service:5009/health
```

**3.3 Deploy Video Liveness Service**

```bash
# Deploy video liveness detection
kubectl apply -f /home/ubuntu/python-services/video-liveness/k8s/deployment.yaml

# Wait for service to be ready
kubectl wait --for=condition=ready pod -l app=video-liveness --timeout=300s

# Test video liveness service
curl -X POST http://video-liveness-service:5011/health
```

**3.4 Deploy Multi-OCR Router**

```bash
# Deploy multi-OCR router (load balancer for OCR services)
kubectl apply -f /home/ubuntu/python-services/multi-ocr/k8s/multi-ocr-router-deployment.yaml

# Verify router can reach all OCR services
kubectl logs -f deployment/multi-ocr-router
```

### Step 4: Deploy Wazuh SIEM

**4.1 Deploy Wazuh Indexer**

```bash
# Deploy OpenSearch for Wazuh
kubectl apply -f /home/ubuntu/python-services/wazuh/k8s/wazuh-indexer-statefulset.yaml

# Wait for indexer to be ready
kubectl wait --for=condition=ready pod -l app=wazuh-indexer --timeout=600s
```

**4.2 Deploy Wazuh Manager**

```bash
# Deploy Wazuh manager
kubectl apply -f /home/ubuntu/python-services/wazuh/k8s/wazuh-manager-deployment.yaml

# Wait for manager to be ready
kubectl wait --for=condition=ready pod -l app=wazuh-manager --timeout=300s

# Copy custom KYC rules
kubectl cp /home/ubuntu/python-services/wazuh/rules/kyc-rules.xml \
  wazuh-manager-0:/var/ossec/etc/rules/kyc-rules.xml

# Restart Wazuh manager to load rules
kubectl exec -it wazuh-manager-0 -- /var/ossec/bin/wazuh-control restart
```

**4.3 Deploy Wazuh Dashboard**

```bash
# Deploy Wazuh dashboard (Kibana)
kubectl apply -f /home/ubuntu/python-services/wazuh/k8s/wazuh-dashboard-deployment.yaml

# Wait for dashboard to be ready
kubectl wait --for=condition=ready pod -l app=wazuh-dashboard --timeout=300s
```

**4.4 Deploy Wazuh Agents**

```bash
# Deploy Wazuh agents on all nodes
kubectl apply -f /home/ubuntu/python-services/wazuh/k8s/wazuh-agent-daemonset.yaml

# Verify agents are connected
kubectl exec -it wazuh-manager-0 -- /var/ossec/bin/agent_control -l
```

### Step 5: Deploy Backend API

**5.1 Create Secrets**

```bash
# Create database credentials secret
kubectl create secret generic db-credentials \
  --from-literal=username=postgres \
  --from-literal=password=<DB_PASSWORD> \
  --from-literal=database=fintech

# Create JWT secret
kubectl create secret generic jwt-secret \
  --from-literal=secret=<JWT_SECRET>

# Create S3 credentials
kubectl create secret generic s3-credentials \
  --from-literal=access-key=<S3_ACCESS_KEY> \
  --from-literal=secret-key=<S3_SECRET_KEY>
```

**5.2 Deploy API Server**

```bash
# Deploy API server
kubectl apply -f /home/ubuntu/fintech-mobile-app/k8s/api-server-deployment.yaml

# Wait for API to be ready
kubectl wait --for=condition=ready pod -l app=api-server --timeout=300s

# Test API health
curl -X GET http://api-server-service:3000/health
```

**5.3 Configure Ingress**

```bash
# Deploy ingress for API
kubectl apply -f /home/ubuntu/fintech-mobile-app/k8s/ingress.yaml

# Verify ingress is configured
kubectl get ingress -n production
```

### Step 6: Deploy Monitoring

**6.1 Deploy Prometheus**

```bash
# Install Prometheus using Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

# Verify Prometheus is running
kubectl get pods -n monitoring
```

**6.2 Deploy Grafana Dashboards**

```bash
# Import custom dashboards
kubectl apply -f /home/ubuntu/fintech-mobile-app/k8s/grafana-dashboards.yaml

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### Step 7: Configure DNS and SSL

**7.1 Update DNS Records**

```bash
# Point domain to load balancer
# api.africanfintech.com -> <LOAD_BALANCER_IP>
# wazuh.africanfintech.com -> <WAZUH_DASHBOARD_IP>

# Verify DNS propagation
dig api.africanfintech.com
```

**7.2 Configure SSL Certificates**

```bash
# Using cert-manager with Let's Encrypt
kubectl apply -f /home/ubuntu/fintech-mobile-app/k8s/certificate.yaml

# Or manually upload certificates
kubectl create secret tls api-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem
```

### Step 8: Deploy Mobile App

**8.1 Build Mobile App**

```bash
cd /home/ubuntu/fintech-mobile-app

# Update API endpoint in app.config.ts
# Update app name and branding

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

**8.2 Submit to App Stores**

```bash
# Submit to Apple App Store
eas submit --platform ios

# Submit to Google Play Store
eas submit --platform android
```

---

## Post-Deployment Validation

### Validation Checklist

**Infrastructure:**
- [ ] All Kubernetes nodes are healthy
- [ ] All pods are running and ready
- [ ] Persistent volumes are bound
- [ ] Network policies are enforced

**Database:**
- [ ] PostgreSQL primary is running
- [ ] PostgreSQL replica is synchronized
- [ ] Database migrations completed
- [ ] Backup jobs are scheduled

**AI Services:**
- [ ] OLMOCR service responds to health checks
- [ ] GOT-OCR2.0 service responds to health checks
- [ ] Video liveness service responds to health checks
- [ ] GPU resources are allocated

**Security:**
- [ ] Wazuh manager is running
- [ ] Wazuh agents are connected
- [ ] Custom KYC rules are loaded
- [ ] SSL certificates are valid
- [ ] MFA is enabled for admin accounts

**API:**
- [ ] API server responds to health checks
- [ ] Authentication endpoints work
- [ ] KYC submission endpoints work
- [ ] Transaction endpoints work

**Monitoring:**
- [ ] Prometheus is scraping metrics
- [ ] Grafana dashboards are accessible
- [ ] Alerts are configured
- [ ] Log aggregation is working

### Automated Validation

```bash
# Run automated validation script
cd /home/ubuntu/fintech-mobile-app
./scripts/validate-deployment.sh

# Expected output:
# ✓ Kubernetes cluster healthy
# ✓ Database accessible
# ✓ Redis cache operational
# ✓ OCR services responding
# ✓ API server healthy
# ✓ Wazuh SIEM operational
# ✓ SSL certificates valid
# ✓ Monitoring active
```

### Manual Testing

**Test KYC Flow:**
1. Register new user via mobile app
2. Complete video liveness verification
3. Upload ID document (passport or driver's license)
4. Verify OCR extraction is accurate
5. Check admin dashboard for KYC submission
6. Approve KYC submission
7. Verify user receives approval notification

**Test Security:**
1. Attempt login with invalid credentials (should fail)
2. Enable MFA for admin account
3. Verify MFA is required for admin login
4. Check Wazuh dashboard for login attempts
5. Verify PII access is logged

**Test Performance:**
1. Run load test script (see load-test.py)
2. Monitor API response times
3. Check database query performance
4. Verify OCR service latency
5. Ensure system remains stable under load

---

## Monitoring and Maintenance

### Daily Tasks

- Review Wazuh alerts for security incidents
- Check system resource usage (CPU, memory, disk)
- Verify backup jobs completed successfully
- Monitor API error rates and response times

### Weekly Tasks

- Review Grafana dashboards for trends
- Test backup restore procedure
- Update security patches
- Review access logs for anomalies

### Monthly Tasks

- Conduct security audit
- Review and rotate credentials
- Test disaster recovery procedures
- Update documentation

### Quarterly Tasks

- Conduct full DR drill
- Review and update security policies
- Perform penetration testing
- Review vendor contracts and SLAs

---

## Troubleshooting

### Common Issues

**Issue: Pods stuck in Pending state**

```bash
# Check node resources
kubectl describe nodes

# Check pod events
kubectl describe pod <POD_NAME>

# Common causes:
# - Insufficient CPU/memory
# - No nodes with GPU
# - Persistent volume not available
```

**Issue: Database connection errors**

```bash
# Check database pod status
kubectl get pods -l app=postgresql

# Check database logs
kubectl logs -f postgresql-0

# Test database connectivity
kubectl exec -it api-server-xxx -- nc -zv postgresql-service 5432

# Common causes:
# - Database not ready
# - Incorrect credentials
# - Network policy blocking connection
```

**Issue: OCR service timeout**

```bash
# Check OCR service logs
kubectl logs -f deployment/olmocr

# Check GPU allocation
kubectl describe node <GPU_NODE>

# Test OCR service directly
curl -X POST http://olmocr-service:5010/health

# Common causes:
# - GPU not available
# - Model not loaded
# - Insufficient memory
```

**Issue: Wazuh agents not connecting**

```bash
# Check Wazuh manager logs
kubectl logs -f wazuh-manager-0

# Check agent status
kubectl exec -it wazuh-manager-0 -- /var/ossec/bin/agent_control -l

# Restart agent
kubectl delete pod <AGENT_POD>

# Common causes:
# - Incorrect manager IP
# - Firewall blocking ports 1514/1515
# - Agent key not registered
```

### Emergency Procedures

**Complete Service Outage:**
1. Activate incident response plan
2. Check infrastructure status (Kubernetes, network)
3. Failover to DR site if primary site is down
4. Notify customers via status page
5. Provide hourly updates

**Database Corruption:**
1. Stop application writes to database
2. Take database offline
3. Restore from last known good backup
4. Apply transaction logs to minimize data loss
5. Verify data integrity before bringing online

**Security Breach:**
1. Activate incident response plan
2. Isolate affected systems
3. Preserve evidence for forensics
4. Notify DPO and legal counsel
5. Follow data breach notification procedures

---

## Related Documentation

### Deployment Documentation

- [Multi-OCR Deployment Guide](MULTI_OCR_DEPLOYMENT.md)
- [Wazuh On-Premise Deployment Guide](WAZUH_ONPREMISE_DEPLOYMENT.md)
- [Staging Environment Setup](STAGING_ENVIRONMENT.md)
- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)

### Security Documentation

- [Information Security Policy](docs/INFORMATION_SECURITY_POLICY.md)
- [Access Control Policy](docs/ACCESS_CONTROL_POLICY.md)
- [Data Protection Policy](docs/DATA_PROTECTION_POLICY.md)
- [Incident Response Plan](docs/INCIDENT_RESPONSE_PLAN.md)

### Operations Documentation

- [Business Continuity & Disaster Recovery Plan](docs/BUSINESS_CONTINUITY_DISASTER_RECOVERY_PLAN.md)
- [Production Readiness Report](PRODUCTION_READINESS_REPORT.md)
- [Load Testing Guide](scripts/run-load-tests.sh)
- [Security Audit Guide](scripts/run-security-audit.sh)

### Development Documentation

- [README.md](README.md) - Mobile app development guide
- [server/README.md](server/README.md) - Backend API documentation
- [design.md](design.md) - Mobile app design specifications

---

## Support

**For deployment assistance:**

**DevOps Team**  
Email: devops@africanfintech.com  
Slack: #devops

**For security issues:**

**Security Team**  
Email: security@africanfintech.com  
Emergency Hotline: [To be assigned] (24/7)

**For general inquiries:**

**Support**  
Email: support@africanfintech.com  
Website: https://africanfintech.com/support

---

**Document Version:** 1.0  
**Last Updated:** January 23, 2026  
**Next Review:** April 23, 2026
