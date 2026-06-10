# APISIX API Gateway and Openappsec Deployment Guide

This guide provides comprehensive instructions for deploying the APISIX API Gateway with Openappsec integration for the Next Generation Payment Switch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Steps](#deployment-steps)
4. [Configuration Management](#configuration-management)
5. [Security Policy Management](#security-policy-management)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying the API Gateway, ensure you have the following prerequisites in place.

### Required Software

*   **Kubernetes Cluster**: Version 1.25 or higher, with at least 3 nodes.
*   **kubectl**: Command-line tool for interacting with the Kubernetes cluster.
*   **Helm**: Package manager for Kubernetes (version 3.x).

### Infrastructure Requirements

*   **Compute Resources**: Nodes with at least 8 CPU cores and 32GB RAM for production workloads.
*   **Storage**: Persistent storage for etcd.
*   **Network**: A LoadBalancer service for exposing the API Gateway.

## Architecture Overview

The API Gateway architecture consists of APISIX as the core gateway and Openappsec for advanced security.

### APISIX API Gateway

APISIX serves as the central entry point for all external traffic. It provides:

*   **Dynamic Routing**: Routes traffic to backend services based on flexible rules.
*   **Load Balancing**: Distributes traffic across multiple service instances.
*   **Authentication**: JWT-based authentication for securing APIs.
*   **Rate Limiting**: Protects backend services from traffic spikes.
*   **Observability**: Integrates with Prometheus and Zipkin for metrics and tracing.

### Openappsec Integration

Openappsec provides a comprehensive security layer for the API Gateway, including:

*   **Web Application Firewall (WAF)**: Protects against OWASP Top 10 vulnerabilities.
*   **API Security**: Schema validation, API discovery, and JWT validation.
*   **Threat Prevention**: Bot protection, DDoS mitigation, and IP reputation.
*   **Data Protection**: PII detection and sensitive data masking.

## Deployment Steps

Follow these steps to deploy the API Gateway and Openappsec to your Kubernetes cluster.

### Step 1: Deploy APISIX

Deploy the APISIX API Gateway and its etcd backend:

```bash
kubectl apply -f deployment/kubernetes/apisix-gateway.yaml
```

Wait for the APISIX pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=apisix -n apisix --timeout=300s
```

### Step 2: Deploy Openappsec

Deploy the Openappsec agent and management components:

```bash
kubectl apply -f deployment/kubernetes/openappsec-security.yaml
```

Wait for the Openappsec pods to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=openappsec-agent -n openappsec --timeout=300s
```

### Step 3: Deploy Routes and Upstreams

Deploy the APISIX routes and upstream configurations for the backend services:

```bash
kubectl apply -f deployment/kubernetes/apisix-routes.yaml
```

### Step 4: Deploy Security Policies

Deploy the security policies, including OPA policies and rate limiting configurations:

```bash
kubectl apply -f deployment/kubernetes/apisix-security-policies.yaml
```

## Configuration Management

All configurations are managed through Kubernetes ConfigMaps and custom resources.

*   **APISIX Configuration**: `apisix-config` ConfigMap in the `apisix` namespace.
*   **Openappsec Policy**: `openappsec-config` ConfigMap in the `openappsec` namespace.
*   **Routes and Upstreams**: `ApisixRoute` and `ApisixUpstream` custom resources.
*   **Security Policies**: `ApisixPluginConfig` and `ApisixGlobalRule` custom resources.

To update a configuration, edit the corresponding manifest and apply it using `kubectl apply -f <file>.yaml`.

## Security Policy Management

### Openappsec

The Openappsec security policy is defined in the `local_policy.yaml` key of the `openappsec-config` ConfigMap. You can customize the WAF, API security, and threat prevention settings in this file.

### OPA Policies

OPA policies are defined in the `opa-policies` ConfigMap. You can add or modify Rego policies to enforce custom authorization logic.

### Rate Limiting

Rate limiting is configured using the `limit-count` plugin in the `ApisixRoute` resources and the `rate-limit-config` ConfigMap.

## Monitoring and Observability

### Metrics

APISIX exposes Prometheus metrics at `http://apisix-metrics.apisix:9091/apisix/prometheus/metrics`.

### Tracing

APISIX is integrated with Zipkin for distributed tracing. Traces can be viewed in the Zipkin UI.

## Troubleshooting

### APISIX Logs

Check the APISIX logs for errors:

```bash
kubectl logs -l app=apisix -n apisix --tail=100 -f
```

### Openappsec Logs

Check the Openappsec agent logs:

```bash
kubectl logs -l app=openappsec-agent -n openappsec --tail=100 -f
```

### Common Issues

*   **502 Bad Gateway**: Check the health of the upstream services.
*   **403 Forbidden**: Review the Openappsec and OPA policies.
*   **429 Too Many Requests**: Adjust the rate limiting configuration.
