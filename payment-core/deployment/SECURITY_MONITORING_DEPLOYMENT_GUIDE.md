# Integrated Security Monitoring Deployment Guide

This guide provides comprehensive instructions for deploying the integrated security monitoring stack, including Wazuh, OpenCTI, and their integration with the existing Prometheus/Grafana/Alertmanager stack.

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

*   **Storage**: A fast SSD storage class for Wazuh, OpenCTI, and Prometheus data.
*   **Network**: A LoadBalancer service for exposing the Wazuh and OpenCTI UIs.

## Architecture Overview

Refer to the `docs/security-monitoring-architecture.md` document for a detailed overview of the architecture.

## Deployment Steps

### Step 1: Deploy Wazuh

Deploy the Wazuh manager, agents, and related components:

```bash
kubectl apply -f deployment/kubernetes/security/wazuh.yaml
```

Wait for the Wazuh pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=wazuh -n security --timeout=600s
```

### Step 2: Deploy OpenCTI

Deploy the OpenCTI platform, workers, connectors, and supporting services (Elasticsearch, Redis, RabbitMQ, MinIO):

```bash
kubectl apply -f deployment/kubernetes/security/opencti.yaml
```

Wait for the OpenCTI pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=opencti -n security --timeout=900s
```

### Step 3: Deploy Security Exporters

Deploy the Prometheus exporters for Wazuh and OpenCTI:

```bash
kubectl apply -f deployment/kubernetes/security/security-exporters.yaml
```

### Step 4: Update Prometheus Configuration

Apply the new scrape configurations for the security exporters to your Prometheus deployment. This is typically done by adding the contents of `prometheus-security-scrape-config` to your main Prometheus configuration file.

### Step 5: Deploy Security Alerts and Dashboards

Deploy the security-focused alerting rules and Grafana dashboards:

```bash
kubectl apply -f deployment/kubernetes/security/security-alerts-dashboards.yaml
```

## Accessing Dashboards

*   **Wazuh UI**: The Wazuh UI is typically accessed through a Kibana or OpenSearch Dashboards interface, which is not included in this deployment. You would need to deploy one of these and configure it to connect to the Wazuh indexer.
*   **OpenCTI UI**: `http://<opencti-external-loadbalancer-ip>:8080`
*   **Grafana Security Dashboards**: Access your Grafana UI and look for the "Security Overview", "Wazuh Detailed Monitoring", and "OpenCTI Threat Intelligence" dashboards.

## Alerting Configuration

*   **Security Alerting Rules**: Defined in `deployment/kubernetes/security/security-alerts-dashboards.yaml`.
*   **Notification Channels**: Configure your notification channels in the `alertmanager-config` ConfigMap in your main Alertmanager deployment.

## Troubleshooting

*   **Pod Errors**: Check pod logs using `kubectl logs <pod-name> -n security`.
*   **Connectivity Issues**: Ensure that all components can communicate with each other within the `security` and `monitoring` namespaces.
*   **Data Not Appearing**: Verify that the exporters are running and that Prometheus is successfully scraping their metrics.
