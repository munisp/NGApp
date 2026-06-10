# Kubernetes and Dapr Deployment Guide

This guide provides comprehensive instructions for deploying the Next Generation Payment Switch with Kubernetes and Dapr, focusing on the Go Ledger Service and Python Workflow Orchestrator.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Steps](#deployment-steps)
4. [Configuration Management](#configuration-management)
5. [Monitoring and Observability](#monitoring-and-observability)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying the payment switch, ensure you have the following prerequisites in place.

### Required Software

*   **Kubernetes Cluster**: Version 1.25 or higher, with at least 3 nodes for high availability.
*   **kubectl**: Command-line tool for interacting with the Kubernetes cluster.
*   **Helm**: Package manager for Kubernetes (version 3.x).
*   **Dapr**: Distributed Application Runtime installed on the Kubernetes cluster (version 1.12 or higher).
*   **Docker**: For building container images.

### Infrastructure Requirements

*   **Compute Resources**: Nodes with at least 16 CPU cores and 64GB RAM for production workloads.
*   **Storage**: Persistent storage with fast SSDs for TigerBeetle, PostgreSQL, and Kafka.
*   **Network**: Low-latency network between nodes, with support for network policies.

### External Dependencies

*   **TigerBeetle Cluster**: A running TigerBeetle cluster with at least 3 replicas.
*   **PostgreSQL Cluster**: A highly available PostgreSQL cluster (version 15 or higher).
*   **Redis Cluster**: A Redis cluster for caching and state management.
*   **Kafka Cluster**: A Kafka cluster for event streaming (version 2.8 or higher).
*   **Temporal Cluster**: A Temporal cluster for workflow orchestration.

## Architecture Overview

The deployment architecture consists of two primary services integrated via gRPC and managed by Dapr.

### Go Ledger Service

The **Go Ledger Service** is a high-performance gRPC service responsible for all interactions with the TigerBeetle ledger and PostgreSQL database. It provides the following capabilities:

*   **Account Management**: Creating and managing accounts in TigerBeetle.
*   **Transfer Processing**: Executing high-speed transfers between accounts.
*   **Balance Queries**: Retrieving account balances with low latency.
*   **Database Synchronization**: Syncing ledger data to PostgreSQL for analytics and reporting.

The service is deployed with the following characteristics:

*   **Replicas**: 10 (minimum) to 50 (maximum) with horizontal pod autoscaling.
*   **Resource Allocation**: 2-4 CPU cores and 4-8GB RAM per pod.
*   **Connection Pooling**: 20 connections to TigerBeetle and 20-100 connections to PostgreSQL.

### Python Workflow Orchestrator

The **Python Workflow Orchestrator** manages the end-to-end payment processing workflow using Temporal. It orchestrates interactions between multiple services, including the Go Ledger Service, Party Service, Account Service, and Fraud Detection Service. The orchestrator is responsible for:

*   **Payment Validation**: Validating payment requests.
*   **Party Lookup**: Resolving payer and payee information via gRPC.
*   **Balance Checks**: Verifying sufficient funds via the Ledger Service.
*   **Fraud Detection**: Invoking the fraud detection service.
*   **Transfer Execution**: Coordinating the transfer via the Ledger Service.
*   **Status Updates**: Recording transaction status in the database.
*   **Notifications**: Sending notifications to parties.

The service is deployed with the following characteristics:

*   **Replicas**: 20 (minimum) to 100 (maximum) with horizontal pod autoscaling.
*   **Resource Allocation**: 1-2 CPU cores and 2-4GB RAM per pod.
*   **Temporal Workers**: 4 workers per pod with 100 concurrent activities and 50 concurrent workflows.

### Dapr Integration

Dapr provides the following capabilities for both services:

*   **Service Mesh**: mTLS, service discovery, and traffic management.
*   **State Management**: Redis-based state store for caching and session management.
*   **Pub/Sub**: Kafka-based pub/sub for event-driven communication.
*   **Observability**: Distributed tracing with Zipkin/Jaeger and metrics with Prometheus.
*   **Resiliency**: Circuit breakers, retries, and timeouts.
*   **Access Control**: Fine-grained access control policies between services.

## Deployment Steps

Follow these steps to deploy the payment switch to your Kubernetes cluster.

### Step 1: Install Dapr on Kubernetes

Install Dapr on your Kubernetes cluster using Helm:

```bash
# Add Dapr Helm repository
helm repo add dapr https://dapr.github.io/helm-charts/
helm repo update

# Install Dapr
helm upgrade --install dapr dapr/dapr \
  --version=1.12 \
  --namespace dapr-system \
  --create-namespace \
  --wait
```

Verify the Dapr installation:

```bash
kubectl get pods -n dapr-system
```

### Step 2: Create the Payment Switch Namespace

Create the `payment-switch` namespace:

```bash
kubectl create namespace payment-switch
kubectl label namespace payment-switch name=payment-switch
```

### Step 3: Deploy Infrastructure Components

Deploy the required infrastructure components (TigerBeetle, PostgreSQL, Redis, Kafka, Temporal) using the provided manifests:

```bash
# Deploy TigerBeetle
kubectl apply -f deployment/kubernetes/tigerbeetle-statefulset.yaml

# Deploy PostgreSQL
kubectl apply -f deployment/kubernetes/optimized-deployments.yaml

# Deploy Redis
kubectl apply -f deployment/kubernetes/optimized-deployments.yaml

# Deploy Kafka
kubectl apply -f deployment/kubernetes/kafka-deployment.yaml

# Deploy Temporal
kubectl apply -f deployment/kubernetes/temporal-deployment.yaml
```

Wait for all infrastructure components to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=tigerbeetle -n payment-switch --timeout=300s
kubectl wait --for=condition=ready pod -l app=postgresql -n payment-switch --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n payment-switch --timeout=300s
kubectl wait --for=condition=ready pod -l app=kafka -n payment-switch --timeout=300s
kubectl wait --for=condition=ready pod -l app=temporal -n payment-switch --timeout=300s
```

### Step 4: Deploy Dapr Components

Deploy the Dapr components for state management, pub/sub, and secrets:

```bash
# Deploy Dapr components for Ledger Service
kubectl apply -f deployment/dapr/ledger-service-dapr.yaml

# Deploy Dapr components for Workflow Orchestrator
kubectl apply -f deployment/dapr/workflow-orchestrator-dapr.yaml
```

Verify the Dapr components:

```bash
kubectl get components -n payment-switch
kubectl get configurations -n payment-switch
```

### Step 5: Build and Push Container Images

Build the container images for the Go Ledger Service and Python Workflow Orchestrator:

```bash
# Build Go Ledger Service
cd go-services/ledger
docker build -t payment-switch/ledger-service:v1.0.0 .
docker push payment-switch/ledger-service:v1.0.0

# Build Python Workflow Orchestrator
cd ../../services/workflow-orchestrator
docker build -t payment-switch/workflow-orchestrator:v1.0.0 .
docker push payment-switch/workflow-orchestrator:v1.0.0
```

### Step 6: Deploy the Go Ledger Service

Deploy the Go Ledger Service:

```bash
kubectl apply -f deployment/kubernetes/go-ledger-service.yaml
```

Verify the deployment:

```bash
kubectl get pods -l app=ledger-service -n payment-switch
kubectl logs -l app=ledger-service -n payment-switch --tail=50
```

Check the service endpoints:

```bash
kubectl get svc -l app=ledger-service -n payment-switch
```

### Step 7: Deploy the Python Workflow Orchestrator

Deploy the Python Workflow Orchestrator:

```bash
kubectl apply -f deployment/kubernetes/workflow-orchestrator.yaml
```

Verify the deployment:

```bash
kubectl get pods -l app=workflow-orchestrator -n payment-switch
kubectl logs -l app=workflow-orchestrator -n payment-switch --tail=50
```

Check the service endpoints:

```bash
kubectl get svc -l app=workflow-orchestrator -n payment-switch
```

### Step 8: Verify End-to-End Connectivity

Test the connectivity between services:

```bash
# Test Ledger Service gRPC endpoint
kubectl run grpcurl --rm -it --image=fullstorydev/grpcurl:latest --restart=Never -- \
  -plaintext ledger-service.payment-switch:50051 list

# Test Workflow Orchestrator HTTP endpoint
kubectl run curl --rm -it --image=curlimages/curl:latest --restart=Never -- \
  http://workflow-orchestrator.payment-switch:8080/health/ready
```

### Step 9: Deploy Monitoring and Observability

Deploy Prometheus, Grafana, Zipkin, and Jaeger for monitoring and observability:

```bash
# Deploy monitoring stack
kubectl apply -f deployment/kubernetes/monitoring-stack.yaml
```

Access the monitoring dashboards:

```bash
# Port-forward Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Port-forward Zipkin
kubectl port-forward -n monitoring svc/zipkin 9411:9411
```

## Configuration Management

### Environment Variables

All configuration is managed through Kubernetes ConfigMaps and Secrets. To update configuration:

```bash
# Edit ConfigMap
kubectl edit configmap ledger-service-config -n payment-switch

# Edit Secret
kubectl edit secret ledger-service-secrets -n payment-switch
```

After updating configuration, restart the pods:

```bash
kubectl rollout restart deployment/ledger-service -n payment-switch
kubectl rollout restart deployment/workflow-orchestrator -n payment-switch
```

### Scaling Configuration

To manually scale the services:

```bash
# Scale Ledger Service
kubectl scale deployment/ledger-service --replicas=20 -n payment-switch

# Scale Workflow Orchestrator
kubectl scale deployment/workflow-orchestrator --replicas=50 -n payment-switch
```

The Horizontal Pod Autoscaler (HPA) will automatically scale based on CPU, memory, and custom metrics.

### Dapr Configuration

To update Dapr configuration:

```bash
# Edit Dapr Configuration
kubectl edit configuration ledger-service-config -n payment-switch

# Edit Dapr Resiliency
kubectl edit resiliency ledger-service-resiliency -n payment-switch
```

## Monitoring and Observability

### Metrics

Access Prometheus metrics:

*   **Ledger Service**: `http://ledger-service.payment-switch:9090/metrics`
*   **Workflow Orchestrator**: `http://workflow-orchestrator.payment-switch:9090/metrics`

Key metrics to monitor:

*   `ledger_transfers_total`: Total number of transfers processed.
*   `ledger_transfer_duration_seconds`: Transfer processing duration.
*   `workflow_executions_total`: Total number of workflow executions.
*   `workflow_execution_duration_seconds`: Workflow execution duration.
*   `grpc_client_requests_total`: Total number of gRPC client requests.

### Distributed Tracing

Access distributed traces:

*   **Zipkin**: `http://zipkin.monitoring:9411`
*   **Jaeger**: `http://jaeger-query.monitoring:16686`

Traces are automatically collected from all services via Dapr.

### Logs

View logs for services:

```bash
# Ledger Service logs
kubectl logs -l app=ledger-service -n payment-switch --tail=100 -f

# Workflow Orchestrator logs
kubectl logs -l app=workflow-orchestrator -n payment-switch --tail=100 -f

# Dapr sidecar logs
kubectl logs -l app=ledger-service -n payment-switch -c daprd --tail=100 -f
```

## Troubleshooting

### Common Issues

**Issue: Pods are in CrashLoopBackOff state**

Check the pod logs:

```bash
kubectl logs <pod-name> -n payment-switch
kubectl describe pod <pod-name> -n payment-switch
```

Common causes:

*   Missing or incorrect environment variables.
*   Unable to connect to dependencies (TigerBeetle, PostgreSQL, etc.).
*   Insufficient resources.

**Issue: gRPC connection errors**

Verify service endpoints:

```bash
kubectl get svc -n payment-switch
kubectl get endpoints -n payment-switch
```

Test connectivity:

```bash
kubectl run netshoot --rm -it --image=nicolaka/netshoot --restart=Never -- \
  nc -zv ledger-service.payment-switch 50051
```

**Issue: High latency or timeouts**

Check resource utilization:

```bash
kubectl top pods -n payment-switch
kubectl top nodes
```

Review HPA status:

```bash
kubectl get hpa -n payment-switch
kubectl describe hpa ledger-service-hpa -n payment-switch
```

**Issue: Dapr sidecar not injecting**

Verify Dapr annotations:

```bash
kubectl get pod <pod-name> -n payment-switch -o yaml | grep dapr.io
```

Check Dapr control plane:

```bash
kubectl get pods -n dapr-system
kubectl logs -l app=dapr-sidecar-injector -n dapr-system
```

### Health Checks

Check service health:

```bash
# Ledger Service health
kubectl exec -it <ledger-pod> -n payment-switch -- grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check

# Workflow Orchestrator health
kubectl exec -it <workflow-pod> -n payment-switch -- curl http://localhost:8080/health/ready
```

### Performance Tuning

For optimal performance:

1.  **Increase connection pool sizes** in ConfigMaps based on load.
2.  **Adjust HPA thresholds** to scale more aggressively.
3.  **Enable CPU pinning** for high-performance nodes.
4.  **Use dedicated node pools** for performance-critical services.
5.  **Optimize network policies** to reduce latency.

## Conclusion

This guide provides a comprehensive approach to deploying the Next Generation Payment Switch with Kubernetes and Dapr. For additional support, refer to the official documentation for [Kubernetes](https://kubernetes.io/docs/), [Dapr](https://docs.dapr.io/), and [Temporal](https://docs.temporal.io/).
