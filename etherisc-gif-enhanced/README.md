# Reinsurer API Service

This service provides a REST API for reinsurer participation in the Etherisc GIF ecosystem. It handles quote submissions and claim notifications, integrating with the core Policy and Claims services via Temporal workflows for asynchronous processing.

## Features

- **REST API**: Endpoints for quote submission and claim notification.
- **Authentication**: API Key based authentication for reinsurers.
- **Authorization**: Simple authorization based on valid API keys.
- **Temporal Integration**: Uses Temporal workflows for reliable, asynchronous processing of quotes and claims.
- **Observability**: Prometheus metrics for HTTP requests and structured logging.
- **Deployment**: Kubernetes manifests for production deployment.

## Endpoints

| Method | Path | Description | Authentication |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/reinsurer/quotes` | Submit a quote for a policy. | Required |
| `POST` | `/api/v1/reinsurer/claims` | Notify the reinsurer of a claim. | Required |
| `GET` | `/health` | Health check endpoint. | None |
| `GET` | `/metrics` | Prometheus metrics endpoint. | None |

## Configuration

Configuration is managed via `configs/config.yaml` and environment variables.

## Development

1. **Prerequisites**: Go 1.21+, Docker, Temporal Server (for full functionality).
2. **Build**: `go build ./cmd/reinsurer-api`
3. **Run**: `./reinsurer-api` (Ensure `config.yaml` is accessible)

## Deployment

See `deploy/k8s.yaml` for Kubernetes deployment manifests.
