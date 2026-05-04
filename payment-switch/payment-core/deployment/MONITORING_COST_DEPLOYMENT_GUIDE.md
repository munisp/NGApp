# Monitoring and Cost Management Deployment Guide

This guide provides comprehensive instructions for deploying the complete monitoring and cost management stack for the Lakehouse components of the Next-Generation Payment Switch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Steps](#deployment-steps)
4. [Accessing Dashboards](#accessing-dashboards)
5. [Alerting Configuration](#alerting-configuration)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

*   **Kubernetes Cluster**: Version 1.25 or higher.
*   **kubectl**: Command-line tool for interacting with the Kubernetes cluster.
*   **Helm**: Package manager for Kubernetes (version 3.x).

### Infrastructure Requirements

*   **Storage**: A fast SSD storage class for Prometheus and Kubecost data.
*   **Network**: A LoadBalancer service for exposing Grafana, Prometheus, Alertmanager, and Kubecost UIs.

## Architecture Overview

Refer to the `docs/monitoring-cost-architecture.md` document for a detailed overview of the architecture.

## Deployment Steps

### Step 1: Deploy Prometheus

Deploy the Prometheus StatefulSet, ServiceMonitors, and related components:

```bash
kubectl apply -f deployment/kubernetes/monitoring/prometheus.yaml
```

Wait for the Prometheus pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=600s
```

### Step 2: Deploy Grafana

Deploy the Grafana Deployment, dashboards, and data sources:

```bash
kubectl apply -f deployment/kubernetes/monitoring/grafana.yaml
```

Wait for the Grafana pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=300s
```

### Step 3: Deploy Kubecost

Deploy the Kubecost cost analyzer and related components:

```bash
kubectl apply -f deployment/kubernetes/monitoring/kubecost.yaml
```

Wait for the Kubecost pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=kubecost -n monitoring --timeout=600s
```

### Step 4: Deploy Alertmanager

Deploy the Alertmanager StatefulSet and alerting rules:

```bash
kubectl apply -f deployment/kubernetes/monitoring/alerting.yaml
```

Wait for the Alertmanager pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=alertmanager -n monitoring --timeout=300s
```

## Accessing Dashboards

*   **Prometheus UI**: `http://<prometheus-external-loadbalancer-ip>:9090`
*   **Grafana UI**: `http://<grafana-external-loadbalancer-ip>:3000`
*   **Kubecost UI**: `http://<kubecost-external-loadbalancer-ip>:9090`
*   **Alertmanager UI**: `http://<alertmanager-external-loadbalancer-ip>:9093`

## Alerting Configuration

*   **Alerting Rules**: Defined in `deployment/kubernetes/monitoring/alerting.yaml`.
*   **Notification Channels**: Configure your Slack webhook, PagerDuty service key, and email settings in the `alertmanager-config` ConfigMap within the `alerting.yaml` file.

## Troubleshooting

*   **Pod Errors**: Check pod logs using `kubectl logs <pod-name> -n monitoring`.
*   **Metrics Not Appearing**: Verify that the ServiceMonitors and PodMonitors are correctly configured and that the targets are up in the Prometheus UI.
*   **Alerts Not Firing**: Check the Prometheus UI to ensure that the alerting rules are loaded and that the alert conditions are met.
