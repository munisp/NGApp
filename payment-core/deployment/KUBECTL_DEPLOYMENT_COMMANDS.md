# Kubectl Deployment Commands for Security Monitoring Stack

This document provides the complete set of `kubectl` commands to deploy the Wazuh and OpenCTI security monitoring stack.

## Prerequisites

Before deploying, ensure you have:

1. A running Kubernetes cluster (v1.25+)
2. `kubectl` configured to access your cluster
3. Sufficient cluster resources (CPU, memory, storage)
4. A storage class named `fast-ssd` available in your cluster

### Verify Prerequisites

```bash
# Check kubectl connection
kubectl cluster-info

# Check available storage classes
kubectl get storageclass

# Check available resources
kubectl top nodes
```

## Deployment Steps

### Step 1: Create the Security Namespace

```bash
# Create the security namespace
kubectl create namespace security

# Verify namespace creation
kubectl get namespace security
```

### Step 2: Deploy Wazuh Security Monitoring

```bash
# Deploy Wazuh manager and agents
kubectl apply -f deployment/kubernetes/security/wazuh.yaml

# Verify Wazuh deployment
kubectl get all -n security -l app=wazuh

# Check Wazuh manager pod status
kubectl get pods -n security -l app=wazuh,component=manager

# Wait for Wazuh manager to be ready (timeout: 10 minutes)
kubectl wait --for=condition=ready pod -l app=wazuh,component=manager -n security --timeout=600s

# Check Wazuh agent DaemonSet status
kubectl get daemonset -n security -l app=wazuh,component=agent

# View Wazuh manager logs
kubectl logs -n security -l app=wazuh,component=manager --tail=100

# View Wazuh agent logs on a specific node
kubectl logs -n security -l app=wazuh,component=agent --tail=50
```

### Step 3: Deploy OpenCTI Threat Intelligence Platform

```bash
# Deploy OpenCTI and supporting services
kubectl apply -f deployment/kubernetes/security/opencti.yaml

# Verify OpenCTI deployment
kubectl get all -n security -l app=opencti

# Check Elasticsearch cluster status
kubectl get statefulset -n security elasticsearch
kubectl get pods -n security -l app=elasticsearch

# Wait for Elasticsearch to be ready (timeout: 15 minutes)
kubectl wait --for=condition=ready pod -l app=elasticsearch -n security --timeout=900s

# Check Redis, RabbitMQ, and MinIO status
kubectl get pods -n security -l app=redis
kubectl get pods -n security -l app=rabbitmq
kubectl get statefulset -n security minio

# Check OpenCTI platform status
kubectl get deployment -n security opencti-platform
kubectl get pods -n security -l app=opencti,component=platform

# Wait for OpenCTI platform to be ready (timeout: 15 minutes)
kubectl wait --for=condition=ready pod -l app=opencti,component=platform -n security --timeout=900s

# Check OpenCTI workers status
kubectl get deployment -n security opencti-worker
kubectl get pods -n security -l app=opencti,component=worker

# Check OpenCTI connectors status
kubectl get deployment -n security -l component=connector
kubectl get pods -n security -l component=connector

# View OpenCTI platform logs
kubectl logs -n security -l app=opencti,component=platform --tail=100

# View OpenCTI worker logs
kubectl logs -n security -l app=opencti,component=worker --tail=50
```

### Step 4: Deploy Security Exporters

```bash
# Deploy Prometheus exporters for Wazuh and OpenCTI
kubectl apply -f deployment/kubernetes/security/security-exporters.yaml

# Verify exporters deployment
kubectl get deployment -n security wazuh-exporter
kubectl get deployment -n security opencti-exporter

# Check exporter pod status
kubectl get pods -n security -l app=wazuh-exporter
kubectl get pods -n security -l app=opencti-exporter

# Wait for exporters to be ready
kubectl wait --for=condition=ready pod -l app=wazuh-exporter -n security --timeout=300s
kubectl wait --for=condition=ready pod -l app=opencti-exporter -n security --timeout=300s

# View exporter logs
kubectl logs -n security -l app=wazuh-exporter --tail=50
kubectl logs -n security -l app=opencti-exporter --tail=50

# Test exporter metrics endpoints
kubectl port-forward -n security svc/wazuh-exporter 9090:9090 &
curl http://localhost:9090/metrics

kubectl port-forward -n security svc/opencti-exporter 9091:9091 &
curl http://localhost:9091/metrics
```

### Step 5: Update Prometheus Configuration

```bash
# Apply security scrape configuration to Prometheus
kubectl apply -f deployment/kubernetes/security/security-exporters.yaml

# If you need to manually update Prometheus configuration:
# 1. Edit the Prometheus ConfigMap
kubectl edit configmap prometheus-config -n monitoring

# 2. Add the scrape configurations from security-exporters.yaml
# 3. Reload Prometheus configuration
kubectl rollout restart statefulset prometheus -n monitoring

# Verify Prometheus is scraping security targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
# Then open http://localhost:9090/targets in your browser
```

### Step 6: Deploy Security Alerts and Dashboards

```bash
# Deploy security alerting rules
kubectl apply -f deployment/kubernetes/security/security-alerts-dashboards.yaml

# Verify alerting rules are loaded
kubectl get configmap -n monitoring prometheus-security-rules

# Reload Prometheus to pick up new rules
kubectl rollout restart statefulset prometheus -n monitoring

# Verify Grafana dashboards are loaded
kubectl get configmap -n monitoring -l dashboard

# Reload Grafana to pick up new dashboards
kubectl rollout restart deployment grafana -n monitoring
```

## Verification and Testing

### Check Overall Deployment Status

```bash
# Get all resources in security namespace
kubectl get all -n security

# Check persistent volume claims
kubectl get pvc -n security

# Check services
kubectl get svc -n security

# Check for any errors or warnings
kubectl get events -n security --sort-by='.lastTimestamp'
```

### Access UIs via Port Forwarding

```bash
# Access OpenCTI UI (default credentials: admin@opencti.io / ChangeMe)
kubectl port-forward -n security svc/opencti-platform 8080:8080
# Open http://localhost:8080 in your browser

# Access Wazuh API
kubectl port-forward -n security svc/wazuh-manager 55000:55000

# Access Grafana with security dashboards
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Open http://localhost:3000 in your browser
```

### Get LoadBalancer External IPs

```bash
# Get OpenCTI external IP
kubectl get svc opencti-external -n security

# Get Grafana external IP (if using LoadBalancer)
kubectl get svc grafana-external -n monitoring
```

## Troubleshooting Commands

### Pod Issues

```bash
# Describe a failing pod
kubectl describe pod <pod-name> -n security

# Get detailed logs
kubectl logs <pod-name> -n security --previous

# Execute commands inside a pod
kubectl exec -it <pod-name> -n security -- /bin/bash

# Check pod resource usage
kubectl top pod -n security
```

### Storage Issues

```bash
# Check PVC status
kubectl get pvc -n security

# Describe a PVC
kubectl describe pvc <pvc-name> -n security

# Check storage class
kubectl describe storageclass fast-ssd
```

### Network Issues

```bash
# Test connectivity between pods
kubectl run -it --rm debug --image=busybox --restart=Never -n security -- sh
# Inside the pod:
# nslookup wazuh-manager.security.svc.cluster.local
# wget -O- http://opencti-platform:8080/health

# Check service endpoints
kubectl get endpoints -n security

# Check network policies
kubectl get networkpolicies -n security
```

### Configuration Issues

```bash
# View ConfigMaps
kubectl get configmap -n security
kubectl describe configmap <configmap-name> -n security

# Edit a ConfigMap
kubectl edit configmap <configmap-name> -n security

# View Secrets
kubectl get secrets -n security
kubectl describe secret <secret-name> -n security
```

## Cleanup Commands

### Remove Security Monitoring Stack

```bash
# Delete security alerts and dashboards
kubectl delete -f deployment/kubernetes/security/security-alerts-dashboards.yaml

# Delete security exporters
kubectl delete -f deployment/kubernetes/security/security-exporters.yaml

# Delete OpenCTI
kubectl delete -f deployment/kubernetes/security/opencti.yaml

# Delete Wazuh
kubectl delete -f deployment/kubernetes/security/wazuh.yaml

# Delete the security namespace (this will delete all resources)
kubectl delete namespace security
```

### Force Delete Stuck Resources

```bash
# Force delete a stuck pod
kubectl delete pod <pod-name> -n security --force --grace-period=0

# Force delete a stuck PVC
kubectl patch pvc <pvc-name> -n security -p '{"metadata":{"finalizers":null}}'
kubectl delete pvc <pvc-name> -n security
```

## Scaling Commands

### Scale Deployments

```bash
# Scale OpenCTI platform
kubectl scale deployment opencti-platform -n security --replicas=3

# Scale OpenCTI workers
kubectl scale deployment opencti-worker -n security --replicas=5

# Scale Elasticsearch
kubectl scale statefulset elasticsearch -n security --replicas=5
```

### Update Resource Limits

```bash
# Edit deployment to update resource requests/limits
kubectl edit deployment opencti-platform -n security

# Or use kubectl set resources
kubectl set resources deployment opencti-platform -n security \
  --limits=cpu=4000m,memory=16Gi \
  --requests=cpu=2000m,memory=8Gi
```

## Monitoring Commands

### Watch Deployment Progress

```bash
# Watch all pods in security namespace
kubectl get pods -n security -w

# Watch specific deployment rollout
kubectl rollout status deployment opencti-platform -n security

# Watch StatefulSet rollout
kubectl rollout status statefulset elasticsearch -n security
```

### Check Metrics

```bash
# Get resource usage for all pods
kubectl top pods -n security

# Get resource usage for nodes
kubectl top nodes

# Get detailed resource usage
kubectl describe node <node-name>
```

## Best Practices

1. **Always verify prerequisites** before deploying
2. **Deploy in order**: Wazuh → OpenCTI → Exporters → Alerts/Dashboards
3. **Wait for each component** to be ready before proceeding
4. **Monitor logs** during deployment to catch issues early
5. **Test connectivity** between components after deployment
6. **Backup configurations** before making changes
7. **Use namespaces** to isolate security components
8. **Set resource limits** to prevent resource exhaustion
9. **Enable monitoring** from the start
10. **Document custom changes** for future reference
