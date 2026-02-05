# African Fintech Mobile App - Production Deployment Guide

Complete guide for deploying the African Fintech Mobile App with KYC, multi-OCR, video liveness, and Wazuh SIEM to production.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Infrastructure Setup](#infrastructure-setup)
5. [Service Deployment](#service-deployment)
6. [Mobile App Deployment](#mobile-app-deployment)
7. [Security Configuration](#security-configuration)
8. [Monitoring and Observability](#monitoring-and-observability)
9. [Disaster Recovery](#disaster-recovery)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### System Components

| Component | Description | Technology | Port |
|-----------|-------------|------------|------|
| **Mobile App** | React Native mobile application | Expo SDK 54, React 19 | - |
| **API Server** | Backend API and business logic | Node.js, Express, tRPC | 3000 |
| **Database** | Relational database | PostgreSQL 15 | 5432 |
| **OCR Service** | Document OCR extraction | Python, FastAPI, OLMOCR, GOT-OCR2.0 | 5010 |
| **Video Liveness** | Anti-spoofing detection | Python, FastAPI, MediaPipe | 5011 |
| **Facial Recognition** | Face matching | Python, FastAPI, DeepFace | 5009 |
| **Wazuh SIEM** | Security monitoring | Wazuh 4.7.2, OpenSearch | 1514, 9200, 5601 |

### Deployment Targets

- **On-Premise:** OpenStack, Kubernetes, bare metal
- **Cloud:** AWS, GCP, Azure
- **Hybrid:** On-premise + cloud backup

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                        │
│              iOS, Android, Web (PWA)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS/WSS
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   Load Balancer (Nginx)                     │
│              SSL Termination, Rate Limiting                 │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
│  API Server  │  │ OCR Service│  │  Video     │
│  (Node.js)   │  │  (Python)  │  │  Liveness  │
│  Port 3000   │  │  Port 5010 │  │  Port 5011 │
└───────┬──────┘  └─────┬──────┘  └─────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────┴──────┐              ┌─────────┴────────┐
│  PostgreSQL  │              │  Wazuh SIEM      │
│  Database    │              │  (Security)      │
│  Port 5432   │              │  Port 1514/9200  │
└──────────────┘              └──────────────────┘
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Public Zone                            │
│  - Load Balancer (80/443)                                   │
│  - Wazuh Dashboard (5601)                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Firewall
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   Application Zone                          │
│  - API Server (3000)                                        │
│  - OCR Service (5010)                                       │
│  - Video Liveness (5011)                                    │
│  - Facial Recognition (5009)                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Firewall
                         │
┌────────────────────────┴────────────────────────────────────┐
│                     Data Zone                               │
│  - PostgreSQL (5432)                                        │
│  - Wazuh Indexer (9200)                                     │
│  - Redis Cache (6379)                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Hardware Requirements

**Minimum Production Setup:**

| Component | CPU | RAM | Storage | Count |
|-----------|-----|-----|---------|-------|
| Load Balancer | 2 cores | 4GB | 50GB | 2 (HA) |
| API Server | 4 cores | 8GB | 100GB | 3 (HA) |
| OCR Service (GPU) | 8 cores + GPU | 16GB | 200GB | 2 |
| Video Liveness | 4 cores | 8GB | 100GB | 2 |
| Database | 8 cores | 32GB | 500GB SSD | 1 (+ replica) |
| Wazuh Manager | 4 cores | 8GB | 200GB | 1 |
| Wazuh Indexer | 8 cores | 16GB | 500GB SSD | 3 |
| Wazuh Dashboard | 2 cores | 4GB | 100GB | 2 |

**Total:** ~50 CPU cores, ~120GB RAM, ~2.5TB storage

### Software Requirements

- **Operating System:** Ubuntu 22.04 LTS
- **Container Runtime:** Docker 24+, Kubernetes 1.27+
- **Database:** PostgreSQL 15+
- **Load Balancer:** Nginx 1.24+ or HAProxy 2.8+
- **SSL Certificates:** Let's Encrypt or commercial CA
- **GPU Drivers:** NVIDIA CUDA 12.0+ (for OCR service)

### Network Requirements

- **Public IP addresses:** 1-3 (for load balancers)
- **Internal network:** 10.0.0.0/16 or similar
- **Bandwidth:** 100 Mbps minimum, 1 Gbps recommended
- **Firewall:** Managed firewall with DDoS protection

---

## Infrastructure Setup

### 1. Kubernetes Cluster Setup

**Using kubeadm:**

```bash
# On all nodes
sudo apt-get update
sudo apt-get install -y docker.io kubelet kubeadm kubectl
sudo systemctl enable docker kubelet

# On master node
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# Install Flannel network plugin
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

# On worker nodes
sudo kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
```

**Using managed Kubernetes (EKS, GKE, AKS):**

```bash
# AWS EKS
eksctl create cluster \
  --name fintech-app \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.xlarge \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 10 \
  --managed

# GCP GKE
gcloud container clusters create fintech-app \
  --region us-central1 \
  --machine-type n1-standard-4 \
  --num-nodes 3 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10

# Azure AKS
az aks create \
  --resource-group fintech-rg \
  --name fintech-app \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 10
```

### 2. Storage Configuration

**Create storage classes:**

```yaml
# fast-ssd-storage.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs  # or gce-pd, azure-disk
parameters:
  type: gp3  # or pd-ssd, Premium_LRS
  iopsPerGB: "50"
  fsType: ext4
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

```bash
kubectl apply -f fast-ssd-storage.yaml
```

### 3. Network Configuration

**Create namespaces:**

```bash
kubectl create namespace fintech-app
kubectl create namespace wazuh
kubectl create namespace monitoring
```

**Configure network policies:**

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-server-policy
  namespace: fintech-app
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: load-balancer
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: ocr-service
      ports:
        - protocol: TCP
          port: 5010
```

---

## Service Deployment

### 1. Deploy Multi-OCR Service

**Prerequisites:**

```bash
# Install NVIDIA GPU Operator for Kubernetes
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/gpu-operator/master/deployments/gpu-operator.yaml

# Verify GPU nodes
kubectl get nodes -o json | jq '.items[].status.capacity."nvidia.com/gpu"'
```

**Deploy OCR services:**

```bash
cd /home/ubuntu/python-services/multi-ocr/scripts
chmod +x deploy-ocr-services.sh

# Deploy to Kubernetes
DEPLOYMENT_TYPE=kubernetes \
NAMESPACE=fintech-app \
GPU_ENABLED=true \
./deploy-ocr-services.sh
```

**Verify deployment:**

```bash
kubectl get pods -n fintech-app -l app=ocr-service
kubectl logs -n fintech-app -l app=ocr-service --tail=50

# Test OCR service
kubectl port-forward -n fintech-app svc/multi-ocr-router 5010:5010
curl http://localhost:5010/health
```

### 2. Deploy Wazuh SIEM

**Deploy Wazuh:**

```bash
cd /home/ubuntu/python-services/wazuh/scripts
chmod +x deploy-wazuh.sh

# Generate SSL certificates
./deploy-wazuh.sh certs

# Deploy to Kubernetes
DEPLOYMENT_TYPE=kubernetes \
NAMESPACE=wazuh \
INDEXER_REPLICAS=3 \
MANAGER_REPLICAS=1 \
DASHBOARD_REPLICAS=2 \
./deploy-wazuh.sh
```

**Configure KYC logging:**

```bash
# Install KYC custom rules
kubectl create configmap wazuh-kyc-rules \
  -n wazuh \
  --from-file=kyc-rules.xml=/home/ubuntu/python-services/wazuh/rules/kyc-rules.xml

# Restart Wazuh Manager
kubectl rollout restart statefulset wazuh-manager -n wazuh
```

**Access Wazuh Dashboard:**

```bash
# Get Dashboard URL
DASHBOARD_URL=$(kubectl get ingress wazuh-dashboard-ingress -n wazuh -o jsonpath='{.spec.rules[0].host}')
echo "Wazuh Dashboard: https://${DASHBOARD_URL}"

# Get admin password
cat /home/ubuntu/python-services/wazuh/wazuh-passwords.txt
```

### 3. Deploy Database

**Create PostgreSQL StatefulSet:**

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: fintech-app
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15-alpine
          ports:
            - containerPort: 5432
              name: postgres
          env:
            - name: POSTGRES_DB
              value: fintech_app
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-creds
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-creds
                  key: password
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 500Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: fintech-app
spec:
  type: ClusterIP
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: postgres
```

```bash
# Create database credentials
kubectl create secret generic postgres-creds \
  -n fintech-app \
  --from-literal=username=fintech_user \
  --from-literal=password=$(openssl rand -base64 32)

# Deploy PostgreSQL
kubectl apply -f postgres-statefulset.yaml

# Run migrations
kubectl exec -it postgres-0 -n fintech-app -- psql -U fintech_user -d fintech_app -f /migrations/schema.sql
```

### 4. Deploy API Server

**Create API Server Deployment:**

```yaml
# api-server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: fintech-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
        - name: api-server
          image: your-registry/fintech-api:latest
          ports:
            - containerPort: 3000
              name: http
          env:
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
            - name: OCR_SERVICE_URL
              value: "http://multi-ocr-router:5010"
            - name: VIDEO_LIVENESS_URL
              value: "http://video-liveness:5011"
          resources:
            requests:
              memory: "2Gi"
              cpu: "1"
            limits:
              memory: "4Gi"
              cpu: "2"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: fintech-app
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
  selector:
    app: api-server
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
  namespace: fintech-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
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

```bash
# Build and push Docker image
cd /home/ubuntu/fintech-mobile-app
docker build -t your-registry/fintech-api:latest -f Dockerfile.api .
docker push your-registry/fintech-api:latest

# Deploy API server
kubectl apply -f api-server-deployment.yaml
```

### 5. Deploy Load Balancer

**Create Nginx Ingress:**

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fintech-app-ingress
  namespace: fintech-app
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
    - hosts:
        - api.yourcompany.com
      secretName: api-tls
  rules:
    - host: api.yourcompany.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 3000
```

```bash
# Install Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Deploy ingress
kubectl apply -f ingress.yaml
```

---

## Mobile App Deployment

### 1. Build Mobile App

**iOS:**

```bash
cd /home/ubuntu/fintech-mobile-app

# Install dependencies
pnpm install

# Build iOS app
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

**Android:**

```bash
# Build Android app
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

**Web (PWA):**

```bash
# Build web version
pnpm run build:web

# Deploy to hosting
# Option 1: Netlify
netlify deploy --prod --dir=dist

# Option 2: Vercel
vercel --prod

# Option 3: AWS S3 + CloudFront
aws s3 sync dist/ s3://your-bucket-name/
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### 2. Configure App Settings

**Update app.config.ts:**

```typescript
const env = {
  appName: "African Fintech",
  appSlug: "african-fintech",
  logoUrl: "https://cdn.yourcompany.com/logo.png",
  apiUrl: "https://api.yourcompany.com",
  scheme: "africanfintech",
  iosBundleId: "com.yourcompany.africanfintech",
  androidPackage: "com.yourcompany.africanfintech",
};
```

### 3. Update API Endpoints

**Update lib/api/video-liveness-service.ts:**

```typescript
const VIDEO_LIVENESS_API_URL = 'https://api.yourcompany.com/video-liveness';
```

**Update lib/trpc.ts:**

```typescript
const API_URL = 'https://api.yourcompany.com/trpc';
```

---

## Security Configuration

### 1. SSL/TLS Certificates

**Using Let's Encrypt:**

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourcompany.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### 2. Secrets Management

**Create secrets:**

```bash
# Database credentials
kubectl create secret generic database-url \
  -n fintech-app \
  --from-literal=url="postgresql://user:pass@postgres:5432/fintech_app"

# JWT secret
kubectl create secret generic jwt-secret \
  -n fintech-app \
  --from-literal=secret=$(openssl rand -base64 64)

# Encryption keys
kubectl create secret generic encryption-keys \
  -n fintech-app \
  --from-literal=key=$(openssl rand -base64 32)
```

### 3. Network Security

**Configure firewall rules:**

```bash
# Allow only necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 6443/tcp  # Kubernetes API
sudo ufw enable
```

**Configure Kubernetes Network Policies:**

```yaml
# default-deny-all.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: fintech-app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### 4. RBAC Configuration

**Create service accounts:**

```yaml
# service-accounts.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: fintech-app
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: fintech-app
rules:
  - apiGroups: [""]
    resources: ["secrets", "configmaps"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-rolebinding
  namespace: fintech-app
subjects:
  - kind: ServiceAccount
    name: api-server-sa
    namespace: fintech-app
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
```

---

## Monitoring and Observability

### 1. Prometheus and Grafana

**Install Prometheus Operator:**

```bash
kubectl create namespace monitoring

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi
```

**Access Grafana:**

```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Default credentials: admin / prom-operator
```

### 2. Logging with ELK Stack

**Deploy Elasticsearch, Logstash, Kibana:**

```bash
helm repo add elastic https://helm.elastic.co
helm repo update

# Elasticsearch
helm install elasticsearch elastic/elasticsearch \
  --namespace monitoring \
  --set replicas=3 \
  --set volumeClaimTemplate.resources.requests.storage=200Gi

# Kibana
helm install kibana elastic/kibana \
  --namespace monitoring

# Filebeat
helm install filebeat elastic/filebeat \
  --namespace monitoring
```

### 3. Application Performance Monitoring

**Install New Relic or Datadog:**

```bash
# New Relic
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/px.dev_viziers.yaml
kubectl apply -f https://download.newrelic.com/install/kubernetes/pixie/latest/olm_crd.yaml

# Datadog
helm repo add datadog https://helm.datadoghq.com
helm install datadog datadog/datadog \
  --set datadog.apiKey=YOUR_API_KEY \
  --set datadog.appKey=YOUR_APP_KEY
```

---

## Disaster Recovery

### 1. Database Backups

**Automated backups with CronJob:**

```yaml
# postgres-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: fintech-app
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: postgres-backup
              image: postgres:15-alpine
              command:
                - /bin/sh
                - -c
                - |
                  pg_dump -h postgres -U fintech_user fintech_app | gzip > /backups/backup-$(date +%Y%m%d-%H%M%S).sql.gz
                  aws s3 cp /backups/backup-$(date +%Y%m%d-%H%M%S).sql.gz s3://your-backup-bucket/
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-creds
                      key: password
              volumeMounts:
                - name: backups
                  mountPath: /backups
          volumes:
            - name: backups
              emptyDir: {}
          restartPolicy: OnFailure
```

### 2. Kubernetes Cluster Backup

**Using Velero:**

```bash
# Install Velero
wget https://github.com/vmware-tanzu/velero/releases/download/v1.12.0/velero-v1.12.0-linux-amd64.tar.gz
tar -xvf velero-v1.12.0-linux-amd64.tar.gz
sudo mv velero-v1.12.0-linux-amd64/velero /usr/local/bin/

# Configure backup location (S3)
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.8.0 \
  --bucket your-backup-bucket \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1 \
  --secret-file ./credentials-velero

# Create backup schedule
velero schedule create daily-backup --schedule="0 3 * * *"
```

### 3. Restore Procedures

**Restore database:**

```bash
# Download backup from S3
aws s3 cp s3://your-backup-bucket/backup-20260123-020000.sql.gz /tmp/

# Restore to PostgreSQL
gunzip -c /tmp/backup-20260123-020000.sql.gz | kubectl exec -i postgres-0 -n fintech-app -- psql -U fintech_user -d fintech_app
```

**Restore Kubernetes cluster:**

```bash
# List backups
velero backup get

# Restore from backup
velero restore create --from-backup daily-backup-20260123
```

---

## Troubleshooting

### Common Issues

#### 1. Pod CrashLoopBackOff

```bash
# Check pod logs
kubectl logs -n fintech-app <pod-name> --previous

# Describe pod
kubectl describe pod -n fintech-app <pod-name>

# Check events
kubectl get events -n fintech-app --sort-by='.lastTimestamp'
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -- psql -h postgres.fintech-app.svc.cluster.local -U fintech_user -d fintech_app

# Check database logs
kubectl logs -n fintech-app postgres-0
```

#### 3. OCR Service GPU Issues

```bash
# Check GPU availability
kubectl get nodes -o json | jq '.items[].status.capacity."nvidia.com/gpu"'

# Check GPU pod allocation
kubectl describe node <gpu-node-name> | grep nvidia.com/gpu

# Verify NVIDIA device plugin
kubectl get pods -n kube-system | grep nvidia
```

#### 4. High Memory Usage

```bash
# Check resource usage
kubectl top pods -n fintech-app
kubectl top nodes

# Scale down if needed
kubectl scale deployment api-server -n fintech-app --replicas=2

# Increase resource limits
kubectl edit deployment api-server -n fintech-app
```

---

## Performance Tuning

### 1. Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_kyc_submissions_user_id ON kyc_submissions(user_id);
CREATE INDEX idx_kyc_submissions_status ON kyc_submissions(status);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM kyc_submissions WHERE user_id = 'xxx';

-- Configure connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
```

### 2. API Server Optimization

```typescript
// Enable compression
app.use(compression());

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Enable caching
const cache = new NodeCache({ stdTTL: 600 });
app.use((req, res, next) => {
  const key = req.originalUrl;
  const cachedResponse = cache.get(key);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }
  res.sendResponse = res.json;
  res.json = (body) => {
    cache.set(key, body);
    res.sendResponse(body);
  };
  next();
});
```

### 3. OCR Service Optimization

```python
# Enable batch processing
@app.post("/extract-batch")
async def extract_batch(images: List[str]):
    results = await asyncio.gather(*[extract_single(img) for img in images])
    return results

# Use GPU efficiently
torch.backends.cudnn.benchmark = True
torch.backends.cuda.matmul.allow_tf32 = True
```

---

## Cost Estimation

### On-Premise (3-Year TCO)

| Component | Hardware Cost | Annual Maintenance | Total (3 years) |
|-----------|---------------|-------------------|-----------------|
| Servers (10x) | $50,000 | $5,000 | $65,000 |
| GPU Servers (2x) | $20,000 | $2,000 | $26,000 |
| Storage (3TB) | $5,000 | $500 | $6,500 |
| Networking | $10,000 | $1,000 | $13,000 |
| Power/Cooling | - | $5,000 | $15,000 |
| **Total** | **$85,000** | **$13,500** | **$125,500** |

### Cloud (AWS - 3-Year Cost)

| Component | Instance Type | Monthly Cost | Total (3 years) |
|-----------|---------------|--------------|-----------------|
| API Servers (3x) | t3.xlarge | $450 | $16,200 |
| OCR Servers (2x) | p3.2xlarge | $6,000 | $216,000 |
| Database | db.r5.2xlarge | $1,200 | $43,200 |
| Load Balancer | ALB | $50 | $1,800 |
| Storage (3TB) | EBS gp3 | $300 | $10,800 |
| Data Transfer | - | $500 | $18,000 |
| **Total** | - | **$8,500** | **$306,000** |

**Recommendation:** On-premise is 2.4x cheaper for long-term deployments with predictable workloads.

---

## Support and Maintenance

### Monitoring Checklist

- [ ] Check Prometheus alerts daily
- [ ] Review Grafana dashboards weekly
- [ ] Analyze Wazuh security events daily
- [ ] Review database performance weekly
- [ ] Check backup integrity monthly
- [ ] Update SSL certificates before expiry
- [ ] Review and rotate secrets quarterly
- [ ] Perform security audits quarterly
- [ ] Test disaster recovery procedures quarterly

### Update Schedule

- **Security patches:** Weekly
- **Minor updates:** Monthly
- **Major updates:** Quarterly
- **Database migrations:** As needed (with backups)

---

## Conclusion

This guide provides a comprehensive deployment strategy for the African Fintech Mobile App. Follow the steps carefully and ensure all security measures are in place before going live.

For support:
- Documentation: https://docs.yourcompany.com
- Email: support@yourcompany.com
- Slack: #fintech-app-support

**Last Updated:** January 23, 2026
**Version:** 1.0.0
