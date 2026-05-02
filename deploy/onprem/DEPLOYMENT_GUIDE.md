# Payment Switch Platform - On-Premise Deployment Guide

## Overview

This guide covers deploying the Payment Switch platform in on-premise environments. Three deployment paths are supported:

1. **Docker Compose** - For development, demo, and small-scale deployments
2. **Kubernetes** - For production deployments with high availability
3. **OpenStack + Kubernetes** - For enterprise on-premise infrastructure

## Infrastructure Requirements

### Minimum Requirements (Docker Compose - Development)

| Resource | Specification |
|----------|---------------|
| CPU | 8 cores |
| RAM | 32 GB |
| Storage | 200 GB SSD |
| Network | 1 Gbps |
| OS | Ubuntu 22.04 LTS |

### Production Requirements (Kubernetes)

| Node Type | Count | CPU | RAM | Storage |
|-----------|-------|-----|-----|---------|
| Control Plane | 3 | 8 cores | 16 GB | 100 GB SSD |
| Worker | 5+ | 16 cores | 32 GB | 200 GB SSD |
| Data | 3 | 32 cores | 64 GB | 2 TB SSD (high IOPS) |

### Storage Requirements

| Service | Storage Type | Size | IOPS |
|---------|--------------|------|------|
| PostgreSQL | SSD | 500 GB | 3000+ |
| TigerBeetle | NVMe SSD | 200 GB | 10000+ |
| Kafka | SSD | 1 TB | 3000+ |
| Redis | SSD | 50 GB | 5000+ |
| Vault | SSD | 50 GB | 1000+ |
| RustFS | HDD/SSD | 2 TB | 1000+ |

### Network Requirements

| Port | Service | Protocol |
|------|---------|----------|
| 80 | HTTP Ingress | TCP |
| 443 | HTTPS Ingress | TCP |
| 6443 | Kubernetes API | TCP |
| 2379-2380 | etcd | TCP |
| 5432 | PostgreSQL | TCP |
| 6379 | Redis | TCP |
| 9092-9094 | Kafka | TCP |
| 3001 | TigerBeetle | TCP |
| 8200 | Vault | TCP |

## Deployment Path 1: Docker Compose

### Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin
```

### Quick Start

```bash
cd /path/to/payment-switch

# Deploy
./deploy/onprem/compose/up.sh

# Run smoke tests
./deploy/onprem/compose/smoke-test.sh

# Stop
./deploy/onprem/compose/down.sh
```

### Configuration

1. Copy and edit the environment file:
```bash
cp .env.example .env
nano .env
```

2. Required configuration changes for production:
```bash
# Change ALL default passwords
DATABASE_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<random-256-bit-key>
GRAFANA_PASSWORD=<strong-password>
```

### Services Deployed

| Service | Port | Description |
|---------|------|-------------|
| Web Portal | 3000 | Main web application |
| Go Ledger | 8080 | Core ledger service |
| Fraud Detection | 8081 | ML-based fraud detection |
| Data Pipeline | 8082 | Analytics and ETL |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Dashboards |
| Adminer | 8090 | Database admin |
| Redis Commander | 8091 | Redis admin |

## Deployment Path 2: Kubernetes

### Prerequisites

```bash
# Install prerequisites
./deploy/onprem/k8s/bootstrap-prereqs.sh

# Verify cluster connectivity
kubectl cluster-info
```

### Deployment Steps

1. **Prepare Secrets**

Create required secrets before deployment:

```bash
# Create namespace
kubectl create namespace payment-switch

# Database credentials
kubectl create secret generic postgres-credentials \
  --from-literal=username=payment_user \
  --from-literal=password=<strong-password> \
  -n payment-switch

kubectl create secret generic redis-credentials \
  --from-literal=password=<strong-password> \
  -n payment-switch

kubectl create secret generic jwt-secret \
  --from-literal=secret=<random-256-bit-key> \
  -n payment-switch
```

2. **Deploy Platform**

```bash
# Dry run first
./deploy/onprem/k8s/apply.sh --dry-run

# Deploy
./deploy/onprem/k8s/apply.sh

# Verify
./deploy/onprem/k8s/verify.sh
```

3. **Configure Ingress**

```yaml
# Example ingress configuration
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payment-switch-ingress
  namespace: payment-switch
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - payment-switch.example.com
    secretName: payment-switch-tls
  rules:
  - host: payment-switch.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: apisix
            port:
              number: 80
```

### Storage Classes

For on-premise Kubernetes, configure appropriate storage classes:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: payment-switch-ssd
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

For OpenStack Cinder:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: payment-switch-cinder
provisioner: cinder.csi.openstack.org
parameters:
  type: ssd
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

## Deployment Path 3: OpenStack + Kubernetes

### Prerequisites

1. OpenStack credentials configured:
```bash
export OS_AUTH_URL=https://your-openstack:5000/v3
export OS_PROJECT_NAME=payment-switch
export OS_USERNAME=admin
export OS_PASSWORD=<password>
export OS_REGION_NAME=RegionOne
```

2. Terraform installed:
```bash
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform
```

### Infrastructure Deployment

1. **Configure Variables**

```bash
cd deploy/onprem/openstack/terraform
cp variables.tfvars.example terraform.tfvars
nano terraform.tfvars
```

2. **Deploy Infrastructure**

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file=terraform.tfvars

# Apply
terraform apply -var-file=terraform.tfvars
```

3. **Install Kubernetes**

After infrastructure is provisioned, install Kubernetes using kubeadm:

```bash
# SSH to first control plane node
ssh -i ~/.ssh/payment-switch-key ubuntu@<control-plane-ip>

# Initialize cluster
sudo kubeadm init \
  --control-plane-endpoint "<api-lb-ip>:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16

# Install CNI (Calico)
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.1/manifests/calico.yaml

# Join other control plane nodes
# (use the join command from kubeadm init output)

# Join worker nodes
# (use the join command from kubeadm init output)
```

4. **Deploy Platform**

```bash
# Copy kubeconfig to local machine
scp ubuntu@<control-plane-ip>:~/.kube/config ~/.kube/config

# Deploy Payment Switch
./deploy/onprem/k8s/apply.sh
```

### OpenStack Resources Created

| Resource | Count | Description |
|----------|-------|-------------|
| Network | 1 | Private cluster network |
| Subnet | 1 | 10.100.0.0/16 |
| Router | 1 | NAT gateway |
| Security Groups | 4 | Control plane, worker, data, LB |
| Instances | 11 | 3 CP + 5 worker + 3 data |
| Volumes | 18 | Persistent storage for data services |
| Load Balancers | 2 | API server + Ingress |
| Floating IPs | 5 | External access |

## Post-Deployment Configuration

### 1. Initialize Vault

```bash
# Initialize Vault
kubectl exec -it vault-0 -n payment-switch -- vault operator init

# Unseal Vault (repeat 3 times with different keys)
kubectl exec -it vault-0 -n payment-switch -- vault operator unseal <key>

# Enable transit engine for encryption
kubectl exec -it vault-0 -n payment-switch -- vault secrets enable transit
kubectl exec -it vault-0 -n payment-switch -- vault write -f transit/keys/payment-switch-master
```

### 2. Configure Keycloak

```bash
# Access Keycloak admin console
kubectl port-forward svc/keycloak 8080:8080 -n payment-switch

# Create realm and clients via admin console at http://localhost:8080
```

### 3. Initialize TigerBeetle

```bash
# Format TigerBeetle data file (if not done automatically)
kubectl exec -it tigerbeetle-0 -n payment-switch -- \
  tigerbeetle format --cluster=0 --replica=0 --replica-count=3 /data/0_0.tigerbeetle
```

### 4. Run Database Migrations

```bash
# Apply PostgreSQL migrations
kubectl exec -it postgres-0 -n payment-switch -- \
  psql -U payment_user -d payment_switch -f /migrations/schema.sql
```

## Operations

### Backup and Restore

**PostgreSQL Backup:**
```bash
kubectl exec -it postgres-0 -n payment-switch -- \
  pg_dump -U payment_user payment_switch > backup.sql
```

**TigerBeetle Backup:**
```bash
# TigerBeetle uses replication for durability
# For backup, stop the cluster and copy data files
```

**Vault Backup:**
```bash
kubectl exec -it vault-0 -n payment-switch -- \
  vault operator raft snapshot save /tmp/vault-backup.snap
kubectl cp payment-switch/vault-0:/tmp/vault-backup.snap ./vault-backup.snap
```

### Scaling

**Horizontal Pod Autoscaling:**
```bash
kubectl autoscale deployment go-ledger -n payment-switch \
  --min=3 --max=10 --cpu-percent=70
```

**Manual Scaling:**
```bash
kubectl scale deployment go-ledger -n payment-switch --replicas=5
```

### Monitoring

Access Grafana dashboards:
```bash
kubectl port-forward svc/grafana 3000:3000 -n payment-switch
# Open http://localhost:3000
```

Key dashboards:
- Payment Switch Overview
- TigerBeetle Performance
- Kafka Metrics
- PostgreSQL Performance
- API Gateway (APISIX)

### Log Aggregation

```bash
# View logs for a service
kubectl logs -f deployment/go-ledger -n payment-switch

# View logs for all pods with a label
kubectl logs -f -l app=go-ledger -n payment-switch
```

## Troubleshooting

### Common Issues

**Pods not starting:**
```bash
kubectl describe pod <pod-name> -n payment-switch
kubectl logs <pod-name> -n payment-switch --previous
```

**Database connection issues:**
```bash
# Check PostgreSQL connectivity
kubectl exec -it postgres-0 -n payment-switch -- pg_isready

# Check Redis connectivity
kubectl exec -it redis-0 -n payment-switch -- redis-cli ping
```

**TigerBeetle issues:**
```bash
# Check TigerBeetle status
kubectl logs tigerbeetle-0 -n payment-switch
```

**Network policy issues:**
```bash
# Temporarily disable network policies for debugging
kubectl delete networkpolicy --all -n payment-switch
```

### Health Checks

```bash
# Run verification script
./deploy/onprem/k8s/verify.sh

# Manual health checks
curl http://<ingress-ip>/health
curl http://<ingress-ip>/api/health
```

## Security Checklist

Before going to production, ensure:

- [ ] All default passwords changed
- [ ] TLS certificates configured for ingress
- [ ] Network policies enabled
- [ ] Vault initialized and unsealed
- [ ] Secrets stored in Vault (not K8s secrets)
- [ ] RBAC configured for Kubernetes
- [ ] Pod security policies/standards enabled
- [ ] Audit logging enabled
- [ ] Backup procedures tested
- [ ] DR plan documented and tested
- [ ] Monitoring and alerting configured
- [ ] Log aggregation configured
- [ ] Vulnerability scanning enabled

## Support

For issues and support:
- Check logs: `kubectl logs -f <pod> -n payment-switch`
- Run diagnostics: `./deploy/onprem/k8s/verify.sh`
- Review events: `kubectl get events -n payment-switch --sort-by='.lastTimestamp'`
