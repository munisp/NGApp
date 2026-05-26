# Payment Switch Platform - Complete Deployment Plan

## Overview

Comprehensive deployment plan for the complete payment switch platform using included Docker Compose and Kubernetes configurations with full monitoring stack (Prometheus, Grafana, Jaeger, ELK).

---

## Deployment Architecture

### Infrastructure Layers

**Layer 1: Infrastructure Foundation**
- Kubernetes cluster (multi-node, production-grade)
- Namespace isolation
- Resource quotas and limits
- Network policies

**Layer 2: Data Layer**
- PostgreSQL (relational database)
- TigerBeetle (high-performance ledger)
- Redis (caching and sessions)
- Apache Kafka (event streaming)
- MinIO (object storage for lakehouse)

**Layer 3: Service Mesh & Gateway**
- Istio (service mesh)
- Dapr (distributed application runtime)
- Apache APISIX (API gateway)
- Security policies and rate limiting

**Layer 4: Core Services**
- Payment gateway
- Workflow orchestrator (Temporal)
- Fraud detection
- Settlement service
- POS services
- Onboarding portal

**Layer 5: Integration Services**
- Data integration pipelines
- ERP integration
- Mojaloop integration
- Corporate onboarding
- Notification service

**Layer 6: Monitoring & Observability**
- Prometheus (metrics)
- Grafana (dashboards)
- Jaeger (distributed tracing)
- ELK Stack (logging)
- Kubecost (cost monitoring)
- Wazuh (security monitoring)

---

## Phase 1: Prerequisites & Environment Setup

### 1.1 Infrastructure Requirements

**Kubernetes Cluster:**
- Minimum 3 master nodes (HA)
- Minimum 5 worker nodes
- Node specifications:
  - CPU: 16 cores per node
  - RAM: 64 GB per node
  - Storage: 500 GB SSD per node
- Kubernetes version: 1.28+
- Container runtime: containerd

**Network Requirements:**
- Load balancer (MetalLB or cloud provider)
- Ingress controller (NGINX or Traefik)
- DNS configuration
- TLS certificates (cert-manager)

**Storage:**
- Dynamic volume provisioning
- Storage classes: SSD, HDD
- Persistent volume claims
- Backup solution

### 1.2 Tool Installation

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install Istioctl
curl -L https://istio.io/downloadIstio | sh -
export PATH=$PWD/istio-*/bin:$PATH

# Install Dapr CLI
wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash
```

### 1.3 Extract Archive

```bash
# Extract complete platform archive
tar -xzf payment-switch-complete.tar.gz
cd payment-switch-complete/

# Verify contents
ls -la
# Expected: onboarding-portal, payment-core, sdks, api-wrappers, developer-portal, documentation, diagrams
```

---

## Phase 2: Development Environment (Docker Compose)

### 2.1 Local Development Setup

```bash
cd payment-core/nextgen-payment-switch/

# Review docker-compose.yml
cat docker-compose.yml

# Start all services
docker-compose up -d

# Verify services
docker-compose ps

# View logs
docker-compose logs -f
```

### 2.2 Docker Compose Services

**Core Services:**
- PostgreSQL (port 5432)
- Redis (port 6379)
- Kafka + Zookeeper (ports 9092, 2181)
- TigerBeetle (port 3000)

**Application Services:**
- Payment Gateway (port 8080)
- Workflow Orchestrator (port 8081)
- Fraud Detection (port 8082)
- Settlement Service (port 8083)

**Monitoring:**
- Prometheus (port 9090)
- Grafana (port 3000)
- Jaeger (port 16686)

### 2.3 Onboarding Portal Development

```bash
cd onboarding-portal/web-checkout/

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with database connection and API keys

# Push database schema
pnpm db:push

# Start development server
pnpm dev
# Access at http://localhost:3000
```

---

## Phase 3: Kubernetes Cluster Setup

### 3.1 Create Namespace

```bash
cd payment-core/nextgen-payment-switch/deployment/kubernetes/

# Apply namespace configuration
kubectl apply -f namespace.yaml

# Verify namespace
kubectl get namespaces
```

**namespace.yaml:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: payment-switch
  labels:
    name: payment-switch
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: payment-switch-monitoring
  labels:
    name: payment-switch-monitoring
```

### 3.2 Configure Resource Quotas

```bash
# Apply resource quotas
kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: payment-switch-quota
  namespace: payment-switch
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    persistentvolumeclaims: "50"
    services.loadbalancers: "5"
EOF
```

---

## Phase 4: Install Service Mesh & Gateway

### 4.1 Install Istio

```bash
# Install Istio with production profile
istioctl install --set profile=production -y

# Verify installation
kubectl get pods -n istio-system

# Apply Istio configuration
kubectl apply -f istio-config.yaml
```

### 4.2 Install Dapr

```bash
# Initialize Dapr on Kubernetes
dapr init -k

# Verify Dapr installation
dapr status -k

# Apply Dapr configuration
kubectl apply -f dapr-config.yaml
```

### 4.3 Deploy Apache APISIX Gateway

```bash
# Install APISIX using Helm
helm repo add apisix https://charts.apiseven.com
helm repo update

helm install apisix apisix/apisix \
  --namespace payment-switch \
  --set gateway.type=LoadBalancer \
  --set ingress-controller.enabled=true

# Apply APISIX configurations
kubectl apply -f apisix-deployment.yaml
kubectl apply -f apisix-gateway.yaml
kubectl apply -f apisix-routes.yaml
kubectl apply -f apisix-security-policies.yaml

# Verify APISIX
kubectl get pods -n payment-switch | grep apisix
kubectl get svc -n payment-switch | grep apisix
```

---

## Phase 5: Deploy Data Layer

### 5.1 Deploy PostgreSQL

```bash
# Install PostgreSQL using Helm
helm repo add bitnami https://charts.bitnami.com/bitnami

helm install postgresql bitnami/postgresql \
  --namespace payment-switch \
  --set auth.postgresPassword=<SECURE_PASSWORD> \
  --set primary.persistence.size=100Gi \
  --set primary.resources.requests.memory=8Gi \
  --set primary.resources.requests.cpu=4

# Verify PostgreSQL
kubectl get pods -n payment-switch | grep postgresql
```

### 5.2 Deploy TigerBeetle Ledger

```bash
# Apply TigerBeetle StatefulSet
kubectl apply -f tigerbeetle-statefulset.yaml

# Verify TigerBeetle
kubectl get statefulset -n payment-switch tigerbeetle
kubectl get pods -n payment-switch | grep tigerbeetle
```

### 5.3 Deploy Redis

```bash
# Install Redis using Helm
helm install redis bitnami/redis \
  --namespace payment-switch \
  --set auth.password=<SECURE_PASSWORD> \
  --set master.persistence.size=20Gi \
  --set replica.replicaCount=2

# Verify Redis
kubectl get pods -n payment-switch | grep redis
```

### 5.4 Deploy Apache Kafka

```bash
# Apply Kafka deployment
kubectl apply -f kafka-deployment.yaml

# Verify Kafka
kubectl get pods -n payment-switch | grep kafka
kubectl get svc -n payment-switch | grep kafka
```

### 5.5 Deploy MinIO (Lakehouse Storage)

```bash
# Apply MinIO deployment
kubectl apply -f lakehouse/minio-storage.yaml

# Verify MinIO
kubectl get pods -n payment-switch | grep minio
```

---

## Phase 6: Deploy Core Services

### 6.1 Deploy Temporal Workflow Orchestrator

```bash
# Apply Temporal deployment
kubectl apply -f temporal-deployment.yaml

# Verify Temporal
kubectl get pods -n payment-switch | grep temporal
kubectl get svc -n payment-switch | grep temporal
```

### 6.2 Deploy Payment Gateway

```bash
# Build and push Docker image (if needed)
cd ../../services/payment-gateway/
docker build -t payment-gateway:v1.0 .
docker tag payment-gateway:v1.0 <REGISTRY>/payment-gateway:v1.0
docker push <REGISTRY>/payment-gateway:v1.0

# Apply deployment
cd ../../deployment/kubernetes/
kubectl apply -f optimized-deployments.yaml

# Verify payment gateway
kubectl get pods -n payment-switch | grep payment-gateway
kubectl get svc -n payment-switch | grep payment-gateway
```

### 6.3 Deploy Fraud Detection Service

```bash
# Apply fraud detection deployment
kubectl apply -f fraud-detection-service.yaml

# Verify fraud detection
kubectl get pods -n payment-switch | grep fraud-detection
```

### 6.4 Deploy Go Ledger Service

```bash
# Apply Go ledger service
kubectl apply -f go-ledger-service.yaml

# Verify Go ledger
kubectl get pods -n payment-switch | grep go-ledger
```

### 6.5 Deploy Workflow Orchestrator

```bash
# Apply workflow orchestrator
kubectl apply -f workflow-orchestrator.yaml

# Verify workflow orchestrator
kubectl get pods -n payment-switch | grep workflow-orchestrator
```

---

## Phase 7: Deploy Integration Services

### 7.1 Deploy Data Integration Services

```bash
# Apply data integration deployments
kubectl apply -f data-integration/data-integration-services.yaml

# Verify data integration
kubectl get pods -n payment-switch | grep data-integration
```

### 7.2 Deploy Mojaloop Integration

```bash
# Apply Mojaloop deployment
kubectl apply -f mojaloop-deployment.yaml

# Verify Mojaloop
kubectl get pods -n payment-switch | grep mojaloop
```

### 7.3 Deploy POS Services

```bash
# Apply POS deployments
kubectl apply -f pos-system/pos-deployments.yaml
kubectl apply -f pos-service

# Verify POS services
kubectl get pods -n payment-switch | grep pos
```

### 7.4 Deploy Additional Services

```bash
# Notification service
kubectl apply -f notification-service/deployment.yaml
kubectl apply -f notification-service/service.yaml

# Batch processing
kubectl apply -f batch-processing-service/deployment.yaml
kubectl apply -f batch-processing-service/service.yaml

# QR code service
kubectl apply -f qr-code-service/deployment.yaml
kubectl apply -f qr-code-service/service.yaml

# Corporate onboarding
kubectl apply -f corporate-onboarding-service/

# ERP integration
kubectl apply -f erp-integration-service/

# Approval workflow
kubectl apply -f approval-workflow-service/

# Invoicing
kubectl apply -f invoicing-service/

# Payroll
kubectl apply -f payroll-service/

# P2P
kubectl apply -f p2p-service/

# Social graph
kubectl apply -f social-graph-service/

# Subscription
kubectl apply -f subscription-service/

# Advanced analytics
kubectl apply -f advanced-analytics-service/

# Verify all services
kubectl get pods -n payment-switch
```

---

## Phase 8: Deploy Lakehouse & Analytics

### 8.1 Deploy Apache Flink (Streaming)

```bash
# Apply Flink deployment
kubectl apply -f lakehouse/flink-streaming.yaml

# Verify Flink
kubectl get pods -n payment-switch | grep flink
```

### 8.2 Deploy Apache Spark (Batch)

```bash
# Apply Spark deployment
kubectl apply -f lakehouse/spark-batch.yaml

# Verify Spark
kubectl get pods -n payment-switch | grep spark
```

### 8.3 Deploy Ray (Distributed ML)

```bash
# Apply Ray deployment
kubectl apply -f lakehouse/ray-distributed.yaml

# Verify Ray
kubectl get pods -n payment-switch | grep ray
```

---

## Phase 9: Deploy Monitoring Stack

### 9.1 Deploy Prometheus

```bash
# Apply Prometheus deployment
kubectl apply -f monitoring/prometheus.yaml

# Verify Prometheus
kubectl get pods -n payment-switch-monitoring | grep prometheus
kubectl get svc -n payment-switch-monitoring | grep prometheus

# Access Prometheus UI
kubectl port-forward -n payment-switch-monitoring svc/prometheus 9090:9090
# Open http://localhost:9090
```

### 9.2 Deploy Grafana

```bash
# Apply Grafana deployment
kubectl apply -f monitoring/grafana.yaml

# Verify Grafana
kubectl get pods -n payment-switch-monitoring | grep grafana
kubectl get svc -n payment-switch-monitoring | grep grafana

# Get Grafana admin password
kubectl get secret -n payment-switch-monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode

# Access Grafana UI
kubectl port-forward -n payment-switch-monitoring svc/grafana 3000:3000
# Open http://localhost:3000
# Login: admin / <password from above>
```

### 9.3 Deploy Jaeger (Distributed Tracing)

```bash
# Install Jaeger Operator
kubectl create namespace observability
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.51.0/jaeger-operator.yaml -n observability

# Apply Jaeger instance
kubectl apply -f - <<EOF
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: jaeger
  namespace: payment-switch-monitoring
spec:
  strategy: production
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
EOF

# Verify Jaeger
kubectl get pods -n payment-switch-monitoring | grep jaeger

# Access Jaeger UI
kubectl port-forward -n payment-switch-monitoring svc/jaeger-query 16686:16686
# Open http://localhost:16686
```

### 9.4 Deploy ELK Stack (Logging)

```bash
# Install Elasticsearch
helm repo add elastic https://helm.elastic.co

helm install elasticsearch elastic/elasticsearch \
  --namespace payment-switch-monitoring \
  --set replicas=3 \
  --set resources.requests.memory=4Gi

# Install Logstash
helm install logstash elastic/logstash \
  --namespace payment-switch-monitoring

# Install Kibana
helm install kibana elastic/kibana \
  --namespace payment-switch-monitoring

# Install Filebeat (log shipper)
helm install filebeat elastic/filebeat \
  --namespace payment-switch-monitoring

# Verify ELK Stack
kubectl get pods -n payment-switch-monitoring | grep -E "(elasticsearch|logstash|kibana|filebeat)"

# Access Kibana UI
kubectl port-forward -n payment-switch-monitoring svc/kibana-kibana 5601:5601
# Open http://localhost:5601
```

### 9.5 Deploy Kubecost (Cost Monitoring)

```bash
# Apply Kubecost deployment
kubectl apply -f monitoring/kubecost.yaml

# Verify Kubecost
kubectl get pods -n payment-switch-monitoring | grep kubecost

# Access Kubecost UI
kubectl port-forward -n payment-switch-monitoring svc/kubecost 9090:9090
# Open http://localhost:9090
```

### 9.6 Configure Alerting

```bash
# Apply alerting configuration
kubectl apply -f monitoring/alerting.yaml

# Verify alerting
kubectl get pods -n payment-switch-monitoring | grep alert
```

---

## Phase 10: Deploy Security Monitoring

### 10.1 Deploy Wazuh

```bash
# Apply Wazuh deployment
kubectl apply -f security/wazuh.yaml

# Verify Wazuh
kubectl get pods -n payment-switch-monitoring | grep wazuh
```

### 10.2 Deploy OpenCTI (Threat Intelligence)

```bash
# Apply OpenCTI deployment
kubectl apply -f security/opencti.yaml

# Verify OpenCTI
kubectl get pods -n payment-switch-monitoring | grep opencti
```

### 10.3 Configure Security Exporters

```bash
# Apply security exporters
kubectl apply -f security/security-exporters.yaml
kubectl apply -f security/security-alerts-dashboards.yaml

# Verify security monitoring
kubectl get pods -n payment-switch-monitoring | grep security
```

### 10.4 Apply OpenAppSec

```bash
# Apply OpenAppSec security
kubectl apply -f openappsec-security.yaml

# Verify OpenAppSec
kubectl get pods -n payment-switch | grep openappsec
```

---

## Phase 11: Deploy Onboarding Portal

### 11.1 Build Onboarding Portal Docker Image

```bash
cd ../../../onboarding-portal/web-checkout/

# Build production image
docker build -t onboarding-portal:v1.0 .

# Tag and push to registry
docker tag onboarding-portal:v1.0 <REGISTRY>/onboarding-portal:v1.0
docker push <REGISTRY>/onboarding-portal:v1.0
```

### 11.2 Create Kubernetes Deployment

```bash
# Create deployment manifest
cat > onboarding-portal-deployment.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: onboarding-portal
  namespace: payment-switch
spec:
  replicas: 3
  selector:
    matchLabels:
      app: onboarding-portal
  template:
    metadata:
      labels:
        app: onboarding-portal
    spec:
      containers:
      - name: onboarding-portal
        image: <REGISTRY>/onboarding-portal:v1.0
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: onboarding-portal-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: onboarding-portal-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
---
apiVersion: v1
kind: Service
metadata:
  name: onboarding-portal
  namespace: payment-switch
spec:
  selector:
    app: onboarding-portal
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
EOF

# Apply deployment
kubectl apply -f onboarding-portal-deployment.yaml

# Verify deployment
kubectl get pods -n payment-switch | grep onboarding-portal
kubectl get svc -n payment-switch | grep onboarding-portal
```

### 11.3 Configure Secrets

```bash
# Create secrets
kubectl create secret generic onboarding-portal-secrets \
  --namespace payment-switch \
  --from-literal=database-url='postgresql://user:password@postgresql:5432/onboarding' \
  --from-literal=jwt-secret='<SECURE_JWT_SECRET>' \
  --from-literal=oauth-client-id='<OAUTH_CLIENT_ID>' \
  --from-literal=oauth-client-secret='<OAUTH_CLIENT_SECRET>'
```

---

## Phase 12: Configure Ingress & DNS

### 12.1 Install Cert-Manager

```bash
# Install cert-manager for TLS certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify cert-manager
kubectl get pods -n cert-manager
```

### 12.2 Configure Ingress

```bash
# Create ingress manifest
cat > ingress.yaml <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payment-switch-ingress
  namespace: payment-switch
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - portal.paymentswitch.example.com
    - api.paymentswitch.example.com
    - grafana.paymentswitch.example.com
    secretName: payment-switch-tls
  rules:
  - host: portal.paymentswitch.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: onboarding-portal
            port:
              number: 80
  - host: api.paymentswitch.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: apisix-gateway
            port:
              number: 80
  - host: grafana.paymentswitch.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 3000
EOF

# Apply ingress
kubectl apply -f ingress.yaml
```

### 12.3 Configure DNS

```bash
# Get ingress external IP
kubectl get ingress -n payment-switch payment-switch-ingress

# Add DNS records:
# portal.paymentswitch.example.com -> <INGRESS_IP>
# api.paymentswitch.example.com -> <INGRESS_IP>
# grafana.paymentswitch.example.com -> <INGRESS_IP>
```

---

## Phase 13: Verification & Testing

### 13.1 Verify All Deployments

```bash
# Check all pods
kubectl get pods -n payment-switch
kubectl get pods -n payment-switch-monitoring

# Check all services
kubectl get svc -n payment-switch
kubectl get svc -n payment-switch-monitoring

# Check ingress
kubectl get ingress -n payment-switch
```

### 13.2 Health Checks

```bash
# Check APISIX gateway
curl https://api.paymentswitch.example.com/health

# Check onboarding portal
curl https://portal.paymentswitch.example.com/health

# Check Prometheus
curl http://prometheus:9090/-/healthy

# Check Grafana
curl http://grafana:3000/api/health
```

### 13.3 Test Payment Flow

```bash
# Test payment transaction
curl -X POST https://api.paymentswitch.example.com/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_KEY>" \
  -d '{
    "amount": 100.00,
    "currency": "USD",
    "method": "card",
    "card": {
      "number": "4111111111111111",
      "expiry": "12/25",
      "cvv": "123"
    }
  }'
```

### 13.4 Verify Monitoring

```bash
# Access Grafana dashboards
# Open https://grafana.paymentswitch.example.com
# Login and verify dashboards

# Access Jaeger tracing
kubectl port-forward -n payment-switch-monitoring svc/jaeger-query 16686:16686
# Open http://localhost:16686

# Access Kibana logs
kubectl port-forward -n payment-switch-monitoring svc/kibana-kibana 5601:5601
# Open http://localhost:5601
```

---

## Phase 14: Backup & Disaster Recovery

### 14.1 Configure Velero (Backup)

```bash
# Install Velero
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts

helm install velero vmware-tanzu/velero \
  --namespace velero \
  --create-namespace \
  --set configuration.backupStorageLocation.bucket=payment-switch-backups \
  --set configuration.backupStorageLocation.config.region=us-east-1

# Create backup schedule
velero schedule create payment-switch-daily \
  --schedule="0 2 * * *" \
  --include-namespaces payment-switch,payment-switch-monitoring
```

### 14.2 Database Backups

```bash
# PostgreSQL backup
kubectl exec -n payment-switch postgresql-0 -- \
  pg_dump -U postgres onboarding > backup-$(date +%Y%m%d).sql

# TigerBeetle backup
kubectl exec -n payment-switch tigerbeetle-0 -- \
  tigerbeetle backup /data/ledger > backup-ledger-$(date +%Y%m%d).dat
```

---

## Phase 15: Scaling & Optimization

### 15.1 Configure Horizontal Pod Autoscaling

```bash
# Payment gateway autoscaling
kubectl autoscale deployment payment-gateway \
  --namespace payment-switch \
  --cpu-percent=70 \
  --min=3 \
  --max=20

# Onboarding portal autoscaling
kubectl autoscale deployment onboarding-portal \
  --namespace payment-switch \
  --cpu-percent=70 \
  --min=3 \
  --max=10
```

### 15.2 Configure Cluster Autoscaling

```bash
# Enable cluster autoscaler (cloud-specific)
# AWS EKS example:
eksctl create cluster \
  --name payment-switch \
  --managed \
  --asg-access \
  --enable-cluster-autoscaler
```

---

## Monitoring Dashboard Access

### Production URLs

- **Onboarding Portal**: https://portal.paymentswitch.example.com
- **API Gateway**: https://api.paymentswitch.example.com
- **Grafana**: https://grafana.paymentswitch.example.com
- **Prometheus**: http://prometheus.payment-switch-monitoring:9090 (internal)
- **Jaeger**: Port-forward to access
- **Kibana**: Port-forward to access

### Default Credentials

**Grafana:**
- Username: admin
- Password: Retrieved from secret

**Kibana:**
- Username: elastic
- Password: Retrieved from secret

---

## Troubleshooting

### Common Issues

**Pods not starting:**
```bash
kubectl describe pod <POD_NAME> -n payment-switch
kubectl logs <POD_NAME> -n payment-switch
```

**Service connectivity:**
```bash
kubectl exec -it <POD_NAME> -n payment-switch -- curl http://<SERVICE_NAME>
```

**Database connection:**
```bash
kubectl exec -it postgresql-0 -n payment-switch -- psql -U postgres
```

**Check resource usage:**
```bash
kubectl top nodes
kubectl top pods -n payment-switch
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor Grafana dashboards
- Check alert notifications
- Review Kibana logs

**Weekly:**
- Review resource utilization
- Check backup status
- Update security patches

**Monthly:**
- Review and optimize costs
- Update dependencies
- Conduct security audits

---

## Rollback Procedures

### Rollback Deployment

```bash
# View deployment history
kubectl rollout history deployment/<DEPLOYMENT_NAME> -n payment-switch

# Rollback to previous version
kubectl rollout undo deployment/<DEPLOYMENT_NAME> -n payment-switch

# Rollback to specific revision
kubectl rollout undo deployment/<DEPLOYMENT_NAME> -n payment-switch --to-revision=2
```

### Restore from Backup

```bash
# List backups
velero backup get

# Restore from backup
velero restore create --from-backup payment-switch-daily-<DATE>
```

---

## Security Checklist

- [ ] TLS certificates configured
- [ ] Secrets encrypted at rest
- [ ] Network policies applied
- [ ] RBAC configured
- [ ] Pod security policies enabled
- [ ] Image scanning enabled
- [ ] Audit logging enabled
- [ ] Security monitoring active

---

## Performance Benchmarks

**Expected Performance:**
- Payment API: < 200ms (p95)
- Transaction throughput: 10,000+ TPS
- Ledger performance: 1,000,000+ TPS
- Database queries: < 50ms (p95)
- Uptime: 99.99%

---

**Deployment Plan Version**: 1.0  
**Last Updated**: November 4, 2024  
**Author**: Payment Switch Engineering Team
