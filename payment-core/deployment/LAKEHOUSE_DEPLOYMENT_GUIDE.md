# Lakehouse Architecture Deployment Guide

This guide provides comprehensive instructions for deploying the complete Lakehouse architecture for the Next-Generation Payment Switch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Steps](#deployment-steps)
4. [Running Data Pipelines](#running-data-pipelines)
5. [Monitoring and Observability](#monitoring-and-observability)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

*   **Kubernetes Cluster**: Version 1.25 or higher, with at least 5 nodes.
*   **kubectl**: Command-line tool for interacting with the Kubernetes cluster.
*   **Helm**: Package manager for Kubernetes (version 3.x).
*   **Java Development Kit (JDK)**: Version 11 or higher (for Flink job compilation).
*   **Maven**: Build automation tool for Java projects.

### Infrastructure Requirements

*   **Compute Resources**: Nodes with at least 16 CPU cores and 64GB RAM for production workloads.
*   **Storage**: A fast SSD storage class for MinIO and other stateful components.
*   **Network**: A LoadBalancer service for exposing the various UIs.

## Architecture Overview

Refer to the `docs/lakehouse-architecture.md` document for a detailed overview of the architecture.

## Deployment Steps

### Step 1: Deploy MinIO Object Storage

Deploy the MinIO StatefulSet and associated services:

```bash
kubectl apply -f deployment/kubernetes/lakehouse/minio-storage.yaml
```

Wait for the MinIO pods and the setup job to complete:

```bash
kubectl wait --for=condition=ready pod -l app=minio -n lakehouse --timeout=600s
kubectl wait --for=condition=complete job/minio-setup -n lakehouse --timeout=300s
```

### Step 2: Deploy Apache Flink

Deploy the Flink JobManager and TaskManager deployments:

```bash
kubectl apply -f deployment/kubernetes/lakehouse/flink-streaming.yaml
```

Wait for the Flink pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=flink -n lakehouse --timeout=600s
```

### Step 3: Deploy Apache Spark

Deploy the Spark History Server, Shuffle Service, and Spark Operator:

```bash
kubectl apply -f deployment/kubernetes/lakehouse/spark-batch.yaml
```

Wait for the Spark components to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=spark -n lakehouse --timeout=300s
```

### Step 4: Deploy Ray

Deploy the Ray head and worker deployments:

```bash
kubectl apply -f deployment/kubernetes/lakehouse/ray-distributed.yaml
```

Wait for the Ray pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=ray -n lakehouse --timeout=600s
```

## Running Data Pipelines

### Flink Streaming Job

1.  **Compile the Java code**:

    ```bash
    # (Assuming you have Maven installed)
    cd lakehouse-pipelines/flink
    mvn clean package
    ```

2.  **Submit the job to the Flink cluster**:

    ```bash
    # Port-forward the Flink JobManager UI
    kubectl port-forward svc/flink-jobmanager-ui -n lakehouse 8081:8081
    
    # Submit the job through the Flink UI at http://localhost:8081
    # Or use the Flink CLI
    ```

### Spark Batch Job

Submit the Spark batch job using `spark-submit` or the Spark Operator.

Example using `spark-submit`:

```bash
kubectl exec -it <spark-driver-pod> -- /opt/spark/bin/spark-submit \
  --master k8s://https://kubernetes.default.svc:443 \
  --deploy-mode cluster \
  --name transaction-analytics \
  --conf spark.kubernetes.namespace=lakehouse \
  --conf spark.kubernetes.authenticate.driver.serviceAccountName=spark \
  --conf spark.kubernetes.container.image=apache/spark:3.5.0-scala2.12-java11-python3-ubuntu \
  local:///path/to/transaction_analytics.py
```

### Ray ML Training Job

Submit the Ray training job to the Ray cluster:

```bash
# Port-forward the Ray dashboard
kubectl port-forward svc/ray-dashboard -n lakehouse 8265:8265

# Connect to the Ray cluster and run the script
ray job submit --address http://localhost:8265 -- python lakehouse-pipelines/ray/fraud_detection_training.py
```

## Monitoring and Observability

*   **Flink UI**: `http://<flink-jobmanager-ui-loadbalancer-ip>:8081`
*   **Spark History Server**: `http://<spark-history-server-loadbalancer-ip>:18080`
*   **Ray Dashboard**: `http://<ray-dashboard-loadbalancer-ip>:8265`
*   **MinIO Console**: `http://<minio-console-loadbalancer-ip>:9001`

## Troubleshooting

*   **Pod Errors**: Check pod logs using `kubectl logs <pod-name> -n lakehouse`.
*   **Job Failures**: Review the logs in the respective UIs (Flink, Spark, Ray).
*   **S3/MinIO Connectivity**: Ensure that the S3 endpoint and credentials are correct in all configurations.
