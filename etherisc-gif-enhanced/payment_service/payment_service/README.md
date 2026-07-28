# Payment Service Integration

This service is a core component of the Etherisc GIF platform, responsible for orchestrating the payment of policy premiums via a fiat-to-crypto conversion workflow. It leverages **Temporal** for reliable, long-running process management.

## Features Implemented

1.  **Fiat-to-Crypto Conversion**: Integrates with a mock crypto exchange to convert fiat currency (e.g., NGN, USD) to USDC.
2.  **Fiat Payment Gateway Integration**: Interfaces with mock Paystack/Flutterwave for fiat payment initiation and confirmation via webhooks.
3.  **Crypto Wallet Management**: Manages internal service wallets for crypto transfers.
4.  **Temporal Workflow**: Orchestrates the entire payment process: Fiat Payment -> Crypto Purchase -> Crypto Transfer -> Policy Service Notification.
5.  **API Endpoints**: Provides endpoints for initiating payments, checking status, and receiving webhooks.
6.  **Observability**: Includes structured logging (Zap) and Prometheus metrics definitions.
7.  **Deployment**: Includes a Dockerfile and Kubernetes manifests.

## Architecture

The service follows a Clean Architecture pattern, with clear separation between domain, service, adapter, and transport layers. The core business logic is encapsulated in the `service` package and orchestrated by the `workflow` package using Temporal.

## API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/payments` | Initiates a new premium payment. |
| `GET` | `/api/v1/payments/{id}` | Retrieves the status of a payment. |
| `POST` | `/api/v1/webhooks/fiat-gateway` | Receives payment confirmation webhooks. |
| `GET` | `/metrics` | Prometheus metrics endpoint. |

## Local Development

1.  **Prerequisites**: Go (1.21+), Docker, Temporal Server (running locally or accessible).
2.  **Build**: `make build`
3.  **Run**: `make run`

## Deployment

The `k8s/deployment.yaml` provides a Kubernetes manifest for deploying the service, including a Deployment, Service, and Secret placeholder.
