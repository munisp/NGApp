# Next Generation Payment Switch - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Local Development Environment](#local-development-environment)
4. [Production Deployment](#production-deployment)
5. [Configuration](#configuration)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

Before deploying the Next Generation Payment Switch, ensure you have the following tools installed:

- **Kubernetes**: v1.24 or higher
- **kubectl**: v1.24 or higher
- **Helm**: v3.8 or higher
- **Docker**: v20.10 or higher
- **Docker Compose**: v2.0 or higher (for local development)

### Required Access

- Kubernetes cluster with admin access
- Container registry (Docker Hub, ECR, GCR, or ACR)
- Domain name for production deployment
- SSL/TLS certificates

### Resource Requirements

#### Minimum Production Cluster

- **Nodes**: 10 worker nodes
- **CPU**: 4 cores per node (40 cores total)
- **Memory**: 16 GB per node (160 GB total)
- **Storage**: 1 TB total (SSD recommended)
- **Network**: 10 Gbps

#### Recommended Production Cluster

- **Nodes**: 20 worker nodes
- **CPU**: 8 cores per node (160 cores total)
- **Memory**: 32 GB per node (640 GB total)
- **Storage**: 5 TB total (NVMe SSD recommended)
- **Network**: 25 Gbps

## Infrastructure Setup

### 1. Kubernetes Cluster Setup

#### Using Amazon EKS

```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create EKS cluster
eksctl create cluster \
  --name payment-switch \
  --version 1.28 \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type m5.2xlarge \
  --nodes 20 \
  --nodes-min 10 \
  --nodes-max 30 \
  --managed
```

#### Using Google GKE

```bash
# Create GKE cluster
gcloud container clusters create payment-switch \
  --region us-central1 \
  --machine-type n2-standard-8 \
  --num-nodes 20 \
  --enable-autoscaling \
  --min-nodes 10 \
  --max-nodes 30 \
  --enable-autorepair \
  --enable-autoupgrade
```

#### Using Azure AKS

```bash
# Create resource group
az group create --name payment-switch-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group payment-switch-rg \
  --name payment-switch \
  --node-count 20 \
  --node-vm-size Standard_D8s_v3 \
  --enable-cluster-autoscaler \
  --min-count 10 \
  --max-count 30 \
  --enable-addons monitoring
```

### 2. Storage Classes

Create storage classes for different performance tiers:

```yaml
# fast-ssd-storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs  # Change based on cloud provider
parameters:
  type: gp3
  iops: "16000"
  throughput: "1000"
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
```

Apply the storage class:

```bash
kubectl apply -f fast-ssd-storage-class.yaml
```

### 3. Install Dapr

```bash
# Install Dapr CLI
wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash

# Initialize Dapr on Kubernetes
dapr init -k --enable-ha=true
```

### 4. Install Cert-Manager (for TLS)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@payment-switch.example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Local Development Environment

### 1. Clone Repository

```bash
git clone https://github.com/your-org/nextgen-payment-switch.git
cd nextgen-payment-switch
```

### 2. Start Services with Docker Compose

```bash
cd deployment/docker
docker-compose up -d
```

### 3. Verify Services

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f payment-gateway

# Test payment gateway
curl http://localhost:8000/health
```

### 4. Access UIs

- **Payment Gateway API**: http://localhost:8000
- **Temporal UI**: http://localhost:8080
- **Grafana**: http://localhost:3001 (admin/admin)
- **OpenSearch Dashboards**: http://localhost:5601

### 5. Stop Services

```bash
docker-compose down
```

## Production Deployment

### Step 1: Create Namespaces

```bash
kubectl apply -f deployment/kubernetes/namespace.yaml
```

### Step 2: Deploy Infrastructure Components

#### Deploy TigerBeetle

```bash
kubectl apply -f deployment/kubernetes/tigerbeetle-statefulset.yaml

# Wait for TigerBeetle to be ready
kubectl wait --for=condition=ready pod -l app=tigerbeetle -n payment-switch --timeout=300s
```

#### Deploy Kafka

```bash
kubectl apply -f deployment/kubernetes/kafka-deployment.yaml

# Wait for Kafka to be ready
kubectl wait --for=condition=ready pod -l app=kafka -n payment-switch --timeout=300s
```

#### Deploy Temporal

```bash
kubectl apply -f deployment/kubernetes/temporal-deployment.yaml

# Wait for Temporal to be ready
kubectl wait --for=condition=ready pod -l app=temporal -n payment-switch --timeout=300s
```

#### Deploy APISIX

```bash
kubectl apply -f deployment/kubernetes/apisix-deployment.yaml

# Wait for APISIX to be ready
kubectl wait --for=condition=ready pod -l app=apisix -n payment-switch --timeout=300s
```

#### Deploy Dapr Components

```bash
kubectl apply -f deployment/kubernetes/dapr-config.yaml
```

### Step 3: Deploy Mojaloop

```bash
kubectl apply -f deployment/kubernetes/mojaloop-deployment.yaml

# Wait for Mojaloop components to be ready
kubectl wait --for=condition=ready pod -l app=mojaloop -n payment-switch --timeout=300s
```

### Step 4: Deploy Security & Monitoring

```bash
kubectl apply -f deployment/kubernetes/security-monitoring.yaml

# Wait for security components to be ready
kubectl wait --for=condition=ready pod -l app=wazuh -n payment-switch-security --timeout=300s
kubectl wait --for=condition=ready pod -l app=opensearch -n payment-switch-security --timeout=300s
```

### Step 5: Build and Push Application Images

```bash
# Build payment gateway
docker build -t your-registry/payment-gateway:1.0.0 services/payment-gateway
docker push your-registry/payment-gateway:1.0.0

# Build workflow orchestrator
docker build -t your-registry/workflow-orchestrator:1.0.0 services/workflow-orchestrator
docker push your-registry/workflow-orchestrator:1.0.0

# Build fraud detection
docker build -t your-registry/fraud-detection:1.0.0 services/fraud-detection
docker push your-registry/fraud-detection:1.0.0

# Build settlement
docker build -t your-registry/settlement:1.0.0 services/settlement
docker push your-registry/settlement:1.0.0
```

### Step 6: Deploy Application Services Using Helm

```bash
# Update values.yaml with your registry
sed -i 's|payment-switch/|your-registry/|g' deployment/helm/values.yaml

# Install with Helm
helm install payment-switch deployment/helm \
  --namespace payment-switch \
  --values deployment/helm/values.yaml \
  --wait \
  --timeout 10m
```

### Step 7: Verify Deployment

```bash
# Check all pods
kubectl get pods -n payment-switch

# Check services
kubectl get svc -n payment-switch

# Check ingress
kubectl get ingress -n payment-switch

# Test payment gateway
kubectl port-forward svc/payment-gateway 8000:8000 -n payment-switch
curl http://localhost:8000/health
```

## Configuration

### Environment Variables

#### Payment Gateway

```yaml
TEMPORAL_HOST: temporal-frontend:7233
REDIS_HOST: redis-master
REDIS_PORT: 6379
TIGERBEETLE_HOST: tigerbeetle
TIGERBEETLE_PORT: 3000
LOG_LEVEL: INFO
```

#### Fraud Detection

```yaml
REDIS_HOST: redis-master
REDIS_PORT: 6379
ML_MODEL_PATH: /models/fraud-detection
GNN_MODEL_PATH: /models/gnn-fraud
LOG_LEVEL: INFO
```

### Secrets Management

Create secrets for sensitive data:

```bash
# Create Redis password secret
kubectl create secret generic redis-secret \
  --from-literal=password='your-secure-password' \
  -n payment-switch

# Create database credentials
kubectl create secret generic db-credentials \
  --from-literal=username='admin' \
  --from-literal=password='your-secure-password' \
  -n payment-switch

# Create API keys
kubectl create secret generic api-keys \
  --from-literal=mojaloop-api-key='your-api-key' \
  -n payment-switch
```

### ConfigMaps

Create ConfigMaps for configuration:

```bash
kubectl create configmap payment-gateway-config \
  --from-file=config.yaml \
  -n payment-switch
```

## Monitoring & Observability

### Deploy Prometheus

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace payment-switch-monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi
```

### Deploy Grafana Dashboards

```bash
# Import payment switch dashboards
kubectl apply -f monitoring/grafana-dashboards.yaml
```

### Configure Alerts

```bash
# Create alerting rules
kubectl apply -f monitoring/prometheus-rules.yaml
```

## Security Hardening

### 1. Network Policies

Apply network policies to restrict traffic:

```bash
kubectl apply -f security/network-policies.yaml
```

### 2. Pod Security Policies

```bash
kubectl apply -f security/pod-security-policies.yaml
```

### 3. RBAC

Create service accounts and roles:

```bash
kubectl apply -f security/rbac.yaml
```

### 4. Enable mTLS with Dapr

Dapr automatically enables mTLS between services. Verify:

```bash
kubectl get configurations -n payment-switch
```

### 5. Secrets Encryption

Enable encryption at rest for secrets:

```bash
# For EKS
aws eks update-cluster-config \
  --name payment-switch \
  --encryption-config '[{"resources":["secrets"],"provider":{"keyArn":"arn:aws:kms:region:account:key/key-id"}}]'
```

## Troubleshooting

### Common Issues

#### 1. Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n payment-switch

# Check logs
kubectl logs <pod-name> -n payment-switch

# Check events
kubectl get events -n payment-switch --sort-by='.lastTimestamp'
```

#### 2. Service Connection Issues

```bash
# Test service connectivity
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash
# Inside the pod:
curl http://payment-gateway:8000/health
```

#### 3. TigerBeetle Not Starting

```bash
# Check TigerBeetle logs
kubectl logs -l app=tigerbeetle -n payment-switch

# Verify storage
kubectl get pvc -n payment-switch
```

#### 4. Temporal Workflow Failures

```bash
# Check Temporal logs
kubectl logs -l app=temporal,service=frontend -n payment-switch

# Access Temporal UI
kubectl port-forward svc/temporal-ui 8080:8080 -n payment-switch
```

### Performance Tuning

#### 1. Adjust Resource Limits

Edit `deployment/helm/values.yaml` to increase resources:

```yaml
paymentGateway:
  resources:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
```

#### 2. Enable Horizontal Pod Autoscaling

```bash
kubectl autoscale deployment payment-gateway \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n payment-switch
```

#### 3. Optimize Database Connections

Adjust connection pool sizes in application configuration.

### Backup and Recovery

#### 1. Backup TigerBeetle Data

```bash
# Create snapshot
kubectl exec -it tigerbeetle-0 -n payment-switch -- \
  /usr/local/bin/tigerbeetle snapshot /var/lib/tigerbeetle/data.tigerbeetle
```

#### 2. Backup Kafka Topics

```bash
# Use Kafka MirrorMaker or Confluent Replicator
```

#### 3. Backup Temporal Workflows

```bash
# Backup PostgreSQL database
kubectl exec -it postgresql-0 -n payment-switch -- \
  pg_dump -U temporal temporal > temporal_backup.sql
```

## Scaling

### Horizontal Scaling

```bash
# Scale payment gateway
kubectl scale deployment payment-gateway --replicas=10 -n payment-switch

# Scale fraud detection
kubectl scale deployment fraud-detection --replicas=5 -n payment-switch
```

### Vertical Scaling

Update resource requests/limits in Helm values and upgrade:

```bash
helm upgrade payment-switch deployment/helm \
  --namespace payment-switch \
  --values deployment/helm/values.yaml
```

## Maintenance

### Rolling Updates

```bash
# Update image version
helm upgrade payment-switch deployment/helm \
  --namespace payment-switch \
  --set paymentGateway.image.tag=1.1.0 \
  --wait
```

### Database Migrations

```bash
# Run migrations
kubectl apply -f migrations/migration-job.yaml
```

## Support

For additional support:
- Documentation: https://docs.payment-switch.example.com
- Community: https://community.payment-switch.example.com
- Email: support@payment-switch.example.com
