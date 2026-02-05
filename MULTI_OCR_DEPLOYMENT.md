# Multi-OCR Services Deployment Guide

Complete guide for deploying OLMOCR and GOT-OCR2.0 services on GPU servers with Docker Compose, Kubernetes, and OpenStack.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [OpenStack Deployment](#openstack-deployment)
6. [Configuration](#configuration)
7. [Monitoring and Scaling](#monitoring-and-scaling)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Multi-OCR system consists of three main services:

| Service | Port | GPU Required | Memory | Description |
|---------|------|--------------|--------|-------------|
| **OLMOCR** | 5012 | Yes (12GB+) | 8GB | Optimized for African ID documents |
| **GOT-OCR2.0** | 5013 | Yes (16GB+) | 16GB | Advanced multilingual OCR |
| **Multi-OCR Router** | 5014 | No | 1GB | Intelligent engine selection |
| **Redis Cache** | 6379 | No | 4GB | OCR result caching |

### Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (KYC Service)  │
└────────┬────────┘
         │
         v
┌─────────────────────┐
│ Multi-OCR Router    │
│ (Port 5014)         │
│ - Engine Selection  │
│ - Load Balancing    │
│ - Result Caching    │
└─────────┬───────────┘
          │
    ┌─────┴─────┬─────────────┐
    v           v             v
┌────────┐  ┌────────┐  ┌──────────┐
│PaddleOCR│ │OLMOCR  │  │GOT-OCR2.0│
│Port 5008│ │Port 5012│ │Port 5013 │
└────────┘  └────────┘  └──────────┘
```

---

## Prerequisites

### Hardware Requirements

**GPU Servers:**
- NVIDIA GPU with CUDA 11.8+
- OLMOCR: 12GB+ VRAM (Tesla V100, A10, RTX 3090)
- GOT-OCR2.0: 16GB+ VRAM (Tesla V100, A100, RTX 4090)
- 32GB+ System RAM
- 100GB+ SSD storage

**Non-GPU Servers (Router, Redis):**
- 4 CPU cores
- 8GB RAM
- 50GB SSD storage

### Software Requirements

**All Deployments:**
- Ubuntu 22.04 LTS
- Docker 24.0+
- NVIDIA Docker Runtime (for GPU servers)
- CUDA 11.8+ and cuDNN 8.6+

**Kubernetes Deployment:**
- Kubernetes 1.27+
- kubectl CLI
- NVIDIA GPU Operator
- Helm 3.0+ (optional)

**OpenStack Deployment:**
- OpenStack Yoga or newer
- OpenStack CLI tools
- GPU-enabled compute nodes

---

## Docker Compose Deployment

### Step 1: Install Docker and NVIDIA Runtime

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install NVIDIA Docker Runtime
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### Step 2: Download Models

```bash
cd /home/ubuntu/python-services/multi-ocr

# Create models directory
mkdir -p models/{olmocr,got-ocr2}

# Download OLMOCR model (5GB)
cd models/olmocr
wget https://huggingface.co/ucaslcl/GOT-OCR2_0/resolve/main/olmocr_model.pth

# Download GOT-OCR2.0 model (10GB)
cd ../got-ocr2
wget https://huggingface.co/ucaslcl/GOT-OCR2_0/resolve/main/model.safetensors
wget https://huggingface.co/ucaslcl/GOT-OCR2_0/resolve/main/config.json
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**.env file:**
```bash
# Registry
REGISTRY=registry.yourcompany.com
VERSION=latest

# GPU Configuration
CUDA_VISIBLE_DEVICES=0,1  # Use GPUs 0 and 1

# Service Configuration
OLMOCR_BATCH_SIZE=4
OLMOCR_MAX_WORKERS=2
GOT_OCR2_BATCH_SIZE=2
GOT_OCR2_MAX_WORKERS=2

# Redis Configuration
REDIS_MAXMEMORY=2gb
REDIS_CACHE_TTL=3600

# Logging
LOG_LEVEL=INFO
```

### Step 4: Deploy Services

```bash
# Build and start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Test services
curl http://localhost:5012/health  # OLMOCR
curl http://localhost:5013/health  # GOT-OCR2
curl http://localhost:5014/health  # Multi-OCR Router
```

### Step 5: Automated Deployment

```bash
# Run automated deployment script
cd scripts
./deploy-ocr-services.sh build

# Or deploy without building
DEPLOYMENT_TYPE=docker-compose ./deploy-ocr-services.sh
```

---

## Kubernetes Deployment

### Step 1: Prepare Kubernetes Cluster

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Step 2: Install NVIDIA GPU Operator

```bash
# Add NVIDIA Helm repository
helm repo add nvidia https://nvidia.github.io/gpu-operator
helm repo update

# Install GPU Operator
helm install --wait --generate-name \
  -n gpu-operator --create-namespace \
  nvidia/gpu-operator

# Verify GPU nodes
kubectl get nodes -o json | jq '.items[].status.capacity."nvidia.com/gpu"'
```

### Step 3: Label GPU Nodes

```bash
# Label nodes with GPU memory
kubectl label nodes gpu-node-1 gpu=true gpu-memory=16gb
kubectl label nodes gpu-node-2 gpu=true gpu-memory=12gb

# Verify labels
kubectl get nodes --show-labels | grep gpu
```

### Step 4: Create Storage Classes

```bash
# Create NFS storage class for model files
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
provisioner: nfs.csi.k8s.io
parameters:
  server: nfs-server.yourcompany.com
  share: /exports/models
reclaimPolicy: Retain
volumeBindingMode: Immediate
EOF

# Create SSD storage class for Redis
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
EOF
```

### Step 5: Upload Models to NFS

```bash
# Mount NFS share
sudo mkdir -p /mnt/nfs-models
sudo mount nfs-server.yourcompany.com:/exports/models /mnt/nfs-models

# Copy models
sudo cp -r models/olmocr /mnt/nfs-models/
sudo cp -r models/got-ocr2 /mnt/nfs-models/

# Verify
ls -lh /mnt/nfs-models/
```

### Step 6: Deploy Services

```bash
# Create namespace
kubectl create namespace ocr-services

# Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml

# Wait for Redis
kubectl wait --for=condition=ready pod -l app=redis -n ocr-services --timeout=300s

# Deploy OLMOCR
kubectl apply -f k8s/olmocr-deployment.yaml

# Deploy GOT-OCR2
kubectl apply -f k8s/got-ocr2-deployment.yaml

# Wait for OCR services
kubectl wait --for=condition=ready pod -l app=olmocr -n ocr-services --timeout=600s
kubectl wait --for=condition=ready pod -l app=got-ocr2 -n ocr-services --timeout=600s

# Deploy Multi-OCR Router
kubectl apply -f k8s/multi-ocr-router-deployment.yaml

# Wait for router
kubectl wait --for=condition=ready pod -l app=multi-ocr-router -n ocr-services --timeout=300s
```

### Step 7: Verify Deployment

```bash
# Check pods
kubectl get pods -n ocr-services

# Check services
kubectl get svc -n ocr-services

# Check ingress
kubectl get ingress -n ocr-services

# Test services
kubectl port-forward -n ocr-services svc/multi-ocr-router-service 5014:5014 &
curl http://localhost:5014/health
```

### Step 8: Automated Deployment

```bash
# Run automated deployment script
cd scripts
DEPLOYMENT_TYPE=kubernetes \
NAMESPACE=ocr-services \
REGISTRY=registry.yourcompany.com \
./deploy-ocr-services.sh build
```

---

## OpenStack Deployment

### Step 1: Install OpenStack CLI

```bash
# Install OpenStack CLI
sudo apt-get update
sudo apt-get install -y python3-openstackclient

# Source OpenStack credentials
source openrc.sh

# Verify access
openstack server list
```

### Step 2: Create GPU Flavors

```bash
# Create flavor for OLMOCR (12GB GPU)
openstack flavor create \
  --ram 32768 \
  --disk 100 \
  --vcpus 8 \
  --property pci_passthrough:alias='gpu:1' \
  g1.xlarge

# Create flavor for GOT-OCR2 (16GB GPU)
openstack flavor create \
  --ram 65536 \
  --disk 200 \
  --vcpus 16 \
  --property pci_passthrough:alias='gpu:1' \
  g1.2xlarge

# Create flavor for Router (no GPU)
openstack flavor create \
  --ram 8192 \
  --disk 50 \
  --vcpus 4 \
  m1.large
```

### Step 3: Create Cloud-Init Scripts

**OLMOCR Cloud-Init:**
```yaml
#cloud-config
packages:
  - docker.io
  - nvidia-docker2

runcmd:
  - systemctl start docker
  - systemctl enable docker
  - docker pull ${REGISTRY}/olmocr:${VERSION}
  - docker run -d --name olmocr --gpus all -p 5012:5012 ${REGISTRY}/olmocr:${VERSION}
```

**GOT-OCR2 Cloud-Init:**
```yaml
#cloud-config
packages:
  - docker.io
  - nvidia-docker2

runcmd:
  - systemctl start docker
  - systemctl enable docker
  - docker pull ${REGISTRY}/got-ocr2:${VERSION}
  - docker run -d --name got-ocr2 --gpus all -p 5013:5013 ${REGISTRY}/got-ocr2:${VERSION}
```

**Router Cloud-Init:**
```yaml
#cloud-config
packages:
  - docker.io

runcmd:
  - systemctl start docker
  - systemctl enable docker
  - docker pull ${REGISTRY}/multi-ocr-router:${VERSION}
  - docker run -d --name router -p 5014:5014 \
      -e OLMOCR_URL=http://OLMOCR_IP:5012 \
      -e GOT_OCR2_URL=http://GOT_OCR2_IP:5013 \
      ${REGISTRY}/multi-ocr-router:${VERSION}
```

### Step 4: Deploy Instances

```bash
# Create security group
openstack security group create ocr-services
openstack security group rule create --protocol tcp --dst-port 5012:5014 ocr-services
openstack security group rule create --protocol tcp --dst-port 6379 ocr-services

# Create OLMOCR instance
openstack server create \
  --flavor g1.xlarge \
  --image ubuntu-22.04-gpu \
  --key-name default \
  --security-group ocr-services \
  --network private \
  --user-data cloud-init/olmocr-init.yaml \
  olmocr-1

# Create GOT-OCR2 instance
openstack server create \
  --flavor g1.2xlarge \
  --image ubuntu-22.04-gpu \
  --key-name default \
  --security-group ocr-services \
  --network private \
  --user-data cloud-init/got-ocr2-init.yaml \
  got-ocr2-1

# Create Router instance
openstack server create \
  --flavor m1.large \
  --image ubuntu-22.04 \
  --key-name default \
  --security-group ocr-services \
  --network private \
  --user-data cloud-init/router-init.yaml \
  multi-ocr-router-1
```

### Step 5: Automated Deployment

```bash
# Run automated deployment script
cd scripts
DEPLOYMENT_TYPE=openstack \
REGISTRY=registry.yourcompany.com \
./deploy-ocr-services.sh
```

---

## Configuration

### Multi-OCR Router Configuration

The router intelligently selects the best OCR engine based on:

1. **Document Type:**
   - Passport → GOT-OCR2.0 (multilingual)
   - Driver's License → OLMOCR (African-optimized)
   - National ID → OLMOCR (African-optimized)
   - Voter's Card → PaddleOCR (fast, good enough)

2. **Language Detection:**
   - English-only → PaddleOCR (fastest)
   - French/Portuguese → GOT-OCR2.0 (multilingual)
   - Mixed languages → GOT-OCR2.0 (best accuracy)

3. **Image Quality:**
   - High quality → PaddleOCR (fastest)
   - Medium quality → OLMOCR (balanced)
   - Low quality → GOT-OCR2.0 (most robust)

4. **Load Balancing:**
   - Round-robin across available engines
   - Automatic failover to backup engine
   - Circuit breaker for unhealthy services

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PADDLEOCR_URL` | `http://localhost:5008` | PaddleOCR service URL |
| `OLMOCR_URL` | `http://localhost:5012` | OLMOCR service URL |
| `GOT_OCR2_URL` | `http://localhost:5013` | GOT-OCR2 service URL |
| `REDIS_URL` | `redis://localhost:6379` | Redis cache URL |
| `CACHE_TTL` | `3600` | Cache TTL in seconds |
| `MAX_RETRIES` | `3` | Max retry attempts |
| `TIMEOUT` | `60` | Request timeout in seconds |
| `LOG_LEVEL` | `INFO` | Logging level |

---

## Monitoring and Scaling

### Prometheus Metrics

All services expose Prometheus metrics at `/metrics`:

```bash
# OLMOCR metrics
curl http://localhost:5012/metrics

# GOT-OCR2 metrics
curl http://localhost:5013/metrics

# Router metrics
curl http://localhost:5014/metrics
```

**Key Metrics:**
- `ocr_requests_total` - Total OCR requests
- `ocr_request_duration_seconds` - Request latency
- `ocr_errors_total` - Error count
- `ocr_engine_selection` - Engine selection distribution
- `gpu_memory_usage_bytes` - GPU memory usage
- `gpu_utilization_percent` - GPU utilization

### Grafana Dashboard

Import the provided Grafana dashboard:

```bash
# Import dashboard
curl -X POST http://grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana/multi-ocr-dashboard.json
```

### Horizontal Pod Autoscaling (Kubernetes)

The HPA configurations automatically scale based on:

**OLMOCR:**
- Min replicas: 2
- Max replicas: 6
- Target CPU: 70%
- Target Memory: 80%

**GOT-OCR2:**
- Min replicas: 2
- Max replicas: 4
- Target CPU: 70%
- Target Memory: 80%

**Multi-OCR Router:**
- Min replicas: 3
- Max replicas: 10
- Target CPU: 70%
- Target Memory: 80%

### Manual Scaling

**Kubernetes:**
```bash
# Scale OLMOCR
kubectl scale deployment olmocr -n ocr-services --replicas=4

# Scale GOT-OCR2
kubectl scale deployment got-ocr2 -n ocr-services --replicas=3

# Scale Router
kubectl scale deployment multi-ocr-router -n ocr-services --replicas=6
```

**Docker Compose:**
```bash
# Scale services
docker-compose up -d --scale olmocr=2 --scale got-ocr2=2 --scale multi-ocr-router=3
```

---

## Troubleshooting

### Common Issues

#### 1. GPU Not Detected

**Symptoms:**
```
RuntimeError: CUDA error: no kernel image is available for execution on the device
```

**Solution:**
```bash
# Check NVIDIA driver
nvidia-smi

# Reinstall NVIDIA Docker Runtime
sudo apt-get purge nvidia-docker2
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Test GPU access
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

#### 2. Out of Memory (OOM)

**Symptoms:**
```
CUDA out of memory. Tried to allocate 2.00 GiB
```

**Solution:**
```bash
# Reduce batch size
export OLMOCR_BATCH_SIZE=2
export GOT_OCR2_BATCH_SIZE=1

# Or use smaller GPU
# OLMOCR: 12GB → 8GB (batch_size=2)
# GOT-OCR2: 16GB → 12GB (batch_size=1)
```

#### 3. Slow OCR Performance

**Symptoms:**
- OCR requests take > 10 seconds
- High GPU utilization (> 95%)

**Solution:**
```bash
# Increase replicas
kubectl scale deployment olmocr -n ocr-services --replicas=4

# Enable Redis caching
export CACHE_TTL=7200  # 2 hours

# Use faster engine for simple documents
# Configure router to prefer PaddleOCR for high-quality images
```

#### 4. Service Unhealthy

**Symptoms:**
```
Health check failed: Connection refused
```

**Solution:**
```bash
# Check service logs
kubectl logs -n ocr-services -l app=olmocr --tail=100

# Restart service
kubectl rollout restart deployment olmocr -n ocr-services

# Check resource limits
kubectl describe pod -n ocr-services -l app=olmocr
```

#### 5. Model Loading Failure

**Symptoms:**
```
FileNotFoundError: Model file not found at /models/olmocr/model.pth
```

**Solution:**
```bash
# Verify model files
ls -lh /mnt/nfs-models/olmocr/
ls -lh /mnt/nfs-models/got-ocr2/

# Re-download models
cd models/olmocr
wget https://huggingface.co/ucaslcl/GOT-OCR2_0/resolve/main/olmocr_model.pth

# Verify PVC mount
kubectl describe pvc olmocr-models-pvc -n ocr-services
```

### Debugging Commands

**Docker Compose:**
```bash
# View logs
docker-compose logs -f olmocr
docker-compose logs -f got-ocr2
docker-compose logs -f multi-ocr-router

# Execute into container
docker-compose exec olmocr bash

# Check GPU usage
docker-compose exec olmocr nvidia-smi

# Restart service
docker-compose restart olmocr
```

**Kubernetes:**
```bash
# View logs
kubectl logs -n ocr-services -l app=olmocr --tail=100 -f

# Execute into pod
kubectl exec -it -n ocr-services deployment/olmocr -- bash

# Check GPU usage
kubectl exec -it -n ocr-services deployment/olmocr -- nvidia-smi

# Describe pod
kubectl describe pod -n ocr-services -l app=olmocr

# Check events
kubectl get events -n ocr-services --sort-by='.lastTimestamp'
```

### Performance Tuning

**GPU Memory Optimization:**
```python
# In service code
import torch
torch.cuda.empty_cache()  # Clear GPU cache after each batch
torch.backends.cudnn.benchmark = True  # Enable cuDNN auto-tuner
```

**Batch Processing:**
```python
# Process multiple images in parallel
batch_size = 4  # Adjust based on GPU memory
images = [img1, img2, img3, img4]
results = model.batch_predict(images)
```

**Caching Strategy:**
```python
# Cache OCR results by image hash
import hashlib
image_hash = hashlib.sha256(image_bytes).hexdigest()
cached_result = redis.get(f"ocr:{image_hash}")
if cached_result:
    return cached_result
```

---

## Cost Estimation

### GPU Server Costs (Monthly)

**Cloud Providers:**
| Provider | Instance Type | GPU | vCPU | RAM | Storage | Cost/Month |
|----------|---------------|-----|------|-----|---------|------------|
| AWS | p3.2xlarge | V100 16GB | 8 | 61GB | 100GB | $1,200 |
| GCP | n1-standard-8 + T4 | T4 16GB | 8 | 30GB | 100GB | $600 |
| Azure | NC6s_v3 | V100 16GB | 6 | 112GB | 100GB | $1,100 |

**On-Premise (OpenStack):**
- Hardware: $8,000 - $15,000 (one-time)
- Power: $100 - $200/month
- Maintenance: $200 - $500/month
- **Total 3-Year TCO:** $15,000 - $25,000

### Scaling Recommendations

**Small Deployment (< 1,000 KYC/day):**
- 1x OLMOCR instance (12GB GPU)
- 1x GOT-OCR2 instance (16GB GPU)
- 1x Router instance (no GPU)
- **Cost:** $1,800/month (cloud) or $8,000 (on-premise)

**Medium Deployment (1,000 - 10,000 KYC/day):**
- 2x OLMOCR instances (12GB GPU)
- 2x GOT-OCR2 instances (16GB GPU)
- 3x Router instances (no GPU)
- **Cost:** $3,600/month (cloud) or $15,000 (on-premise)

**Large Deployment (> 10,000 KYC/day):**
- 4x OLMOCR instances (12GB GPU)
- 4x GOT-OCR2 instances (16GB GPU)
- 6x Router instances (no GPU)
- **Cost:** $7,200/month (cloud) or $25,000 (on-premise)

---

## Next Steps

1. **Deploy to Staging:**
   ```bash
   DEPLOYMENT_TYPE=kubernetes NAMESPACE=ocr-staging ./deploy-ocr-services.sh build
   ```

2. **Run Load Tests:**
   ```bash
   k6 run --vus 100 --duration 5m load-tests/ocr-load-test.js
   ```

3. **Monitor Performance:**
   - Access Grafana dashboard: http://grafana.yourcompany.com/d/multi-ocr
   - Set up alerts for high latency (> 5s) and errors (> 1%)

4. **Deploy to Production:**
   ```bash
   DEPLOYMENT_TYPE=kubernetes NAMESPACE=ocr-services ./deploy-ocr-services.sh build
   ```

5. **Update Mobile App:**
   - Update `MULTI_OCR_ROUTER_URL` in mobile app configuration
   - Test end-to-end KYC flow with video liveness

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourcompany/multi-ocr/issues
- Slack: #ocr-services
- Email: devops@yourcompany.com

---

**Last Updated:** January 23, 2026
**Version:** 1.0.0
