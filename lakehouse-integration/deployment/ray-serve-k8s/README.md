# Ray Serve API Kubernetes Deployment

Production-ready Kubernetes manifests for Ray Serve ML inference API with KEDA autoscaling.

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- KEDA installed (v2.10+)
- Prometheus Operator (for monitoring)
- Cert-manager (for TLS)
- Nginx Ingress Controller

## Quick Start

### Deploy to Production

```bash
# Install KEDA
kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.12.0/keda-2.12.0.yaml

# Deploy Ray Serve API
kubectl apply -k overlays/prod/

# Verify deployment
kubectl get pods -n ray-serve
kubectl get scaledobject -n ray-serve
kubectl get svc -n ray-serve
```

### Deploy to Development

```bash
kubectl apply -k overlays/dev/
```

## Architecture

**Deployment**: 3-20 replicas (production: 5-50) with rolling updates  
**Autoscaling**: KEDA with 8 triggers (HTTP requests, CPU, memory, Kafka lag, queue length, latency, Redis queue, PostgreSQL connections)  
**Monitoring**: Prometheus ServiceMonitor with 7 alerts  
**Security**: NetworkPolicy, RBAC, Pod Security Standards  
**High Availability**: PodDisruptionBudget (min 2 available)

## KEDA Autoscaling Triggers

**HTTP Request Rate**: Scales when requests/sec > 100  
**CPU Utilization**: Scales when CPU > 70%  
**Memory Utilization**: Scales when memory > 80%  
**Kafka Consumer Lag**: Scales when lag > 50 messages  
**Model Queue Length**: Scales when queued queries > 20  
**Inference Latency**: Scales when p95 latency > 500ms  
**Redis Queue**: Scales when queue length > 30  
**PostgreSQL Connections**: Scales when active connections > 50

## Exposed Services

**ClusterIP** (internal): `ray-serve-api.ray-serve.svc.cluster.local:8000`  
**LoadBalancer** (external): `ray-serve-api-lb.ray-serve.svc.cluster.local`  
**Ingress**: `https://ml-api.lakehouse.example.com`  
**Dashboard**: `https://ray-serve.lakehouse.example.com`

## API Endpoints

**Fraud Detection**: `POST /api/v1/predict/fraud`  
**Risk Scoring**: `POST /api/v1/predict/risk`  
**Claims Prediction**: `POST /api/v1/predict/claims`  
**Model List**: `GET /api/v1/models`  
**Health Check**: `GET /health`  
**Metrics**: `GET /metrics`

## Configuration

### Update Secrets

```bash
# Edit secrets
kubectl edit secret ray-serve-secrets -n ray-serve

# Or create from file
kubectl create secret generic ray-serve-secrets \
  --from-env-file=secrets.env \
  -n ray-serve \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Update Models

```bash
# Models are downloaded from S3/MinIO on pod startup
# Update S3_BUCKET secret to point to new model location
```

### Scale Manually

```bash
# Scale deployment
kubectl scale deployment ray-serve-api -n ray-serve --replicas=10

# KEDA will override manual scaling based on triggers
```

## Monitoring

### View Metrics

```bash
# Port-forward to metrics endpoint
kubectl port-forward -n ray-serve svc/ray-serve-api 9090:9090

# Access metrics
curl http://localhost:9090/metrics
```

### View Alerts

```bash
# Check PrometheusRule
kubectl get prometheusrule -n ray-serve

# View alerts in Prometheus UI
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```

### View Dashboard

```bash
# Port-forward to Ray dashboard
kubectl port-forward -n ray-serve svc/ray-serve-api 8265:8265

# Access dashboard
open http://localhost:8265
```

## Troubleshooting

### Pods Not Starting

```bash
kubectl logs -n ray-serve -l app=ray-serve-api
kubectl describe pod -n ray-serve -l app=ray-serve-api
```

### KEDA Not Scaling

```bash
kubectl get scaledobject -n ray-serve
kubectl describe scaledobject ray-serve-api-scaler -n ray-serve
kubectl logs -n keda -l app=keda-operator
```

### High Latency

```bash
# Check metrics
kubectl port-forward -n ray-serve svc/ray-serve-api 9090:9090
curl http://localhost:9090/metrics | grep latency

# Check resource usage
kubectl top pods -n ray-serve
```

## Production Checklist

- [ ] Update secrets in `secrets.env`
- [ ] Configure ingress hostname
- [ ] Set up TLS certificates
- [ ] Configure resource limits
- [ ] Set up monitoring alerts
- [ ] Configure backup for models
- [ ] Test autoscaling triggers
- [ ] Configure network policies
- [ ] Set up log aggregation
- [ ] Configure RBAC policies

## Files

- `base/` - Base Kubernetes manifests
- `overlays/dev/` - Development configuration
- `overlays/staging/` - Staging configuration
- `overlays/prod/` - Production configuration

## Support

For issues, contact the ML Platform team.
