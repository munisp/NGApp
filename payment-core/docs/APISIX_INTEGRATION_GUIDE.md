# APISIX Integration Guide

This document provides a comprehensive guide to the integration of APISIX with the Unified API Gateway in the Next-Generation Payment Switch.

## 1. Architecture Overview

The integration follows a hybrid architecture where APISIX acts as the edge gateway, handling all external traffic, while the Unified API Gateway acts as a business logic gateway, orchestrating the various microservices.

**Key Responsibilities:**

- **APISIX (Edge Gateway)**:
  - SSL/TLS termination
  - Request routing
  - Rate limiting
  - Authentication (JWT)
  - Caching
  - Security (WAF, IP restriction)
  - Observability (Prometheus, OpenTelemetry)

- **Unified API Gateway (Business Logic Gateway)**:
  - Service discovery
  - Service orchestration
  - Business logic aggregation
  - Protocol translation (e.g., REST to gRPC)

## 2. Deployment

The integrated deployment is managed by the `apisix-unified-gateway-integrated.yaml` manifest. This manifest deploys both APISIX and the Unified API Gateway, along with all necessary configurations, services, and network policies.

**To deploy the integrated stack:**

```bash
kubectl apply -f deployment/kubernetes/apisix-unified-gateway-integrated.yaml
```

## 3. Configuration

The configuration for the integration is managed through several Kubernetes ConfigMaps and custom resources:

- **`apisix-unified-gateway-config`**: Configures the APISIX instance, including the etcd backend and logging.
- **`apisix-unified-gateway-routes.yaml`**: Defines the APISIX routes that forward traffic to the Unified API Gateway.
- **`unified-api-gateway-config`**: Configures the Unified API Gateway, including the addresses of the backend services.

## 4. Verification

To verify the integration, you can perform the following checks:

1.  **Check the status of the pods**:

    ```bash
    kubectl get pods -n payment-switch
    ```

2.  **Check the logs of the APISIX and Unified API Gateway pods**:

    ```bash
    kubectl logs -n payment-switch -l app=apisix
    kubectl logs -n payment-switch -l app=unified-api-gateway
    ```

3.  **Send a test request to the APISIX gateway**:

    ```bash
    curl -i -X GET https://api.payment-switch.example.com/api/v1/health
    ```

    You should receive a `200 OK` response from the Unified API Gateway.

## 5. Troubleshooting

- **502 Bad Gateway**: This usually indicates that APISIX cannot reach the Unified API Gateway. Check the logs of the APISIX pods for more details.
- **404 Not Found**: This may indicate that the route is not correctly configured in APISIX. Check the `apisix-unified-gateway-routes.yaml` manifest.
- **401 Unauthorized**: This indicates that the JWT authentication failed. Ensure that you are providing a valid JWT in the `Authorization` header.

