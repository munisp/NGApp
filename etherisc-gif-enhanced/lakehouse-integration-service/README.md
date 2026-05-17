# Lakehouse Integration Service

This service is responsible for integrating the core Etherisc GIF blockchain data (policies and claims) into the central Lakehouse for advanced analytics. It simulates the end-to-end data pipeline, including Change Data Capture (CDC) events, Kafka messaging, Flink-like transformation, and Iceberg data synchronization, all implemented in Go.

## Features Implemented

1.  **Debezium CDC Simulation**: HTTP endpoints (`/v1/events/policy`, `/v1/events/claim`) simulate receiving CDC events from a Debezium connector monitoring `blockchain_policies` and `blockchain_claims` tables.
2.  **Kafka Integration**: Events are immediately published to dedicated Kafka topics (`blockchain_policies_cdc`, `blockchain_claims_cdc`).
3.  **Flink Transformation Simulation**: The service layer (`pkg/service`) performs a lightweight transformation and enrichment of the raw CDC data before publishing to Kafka, simulating the role of a Flink streaming job.
4.  **Iceberg Sync Simulation**: The Kafka topics are the source for a conceptual Iceberg sink, making the data available for analytics.
5.  **Analytics Views**: A dedicated endpoint (`/v1/analytics/{viewName}`) simulates querying the Lakehouse (e.g., via Trino/Presto) to retrieve pre-calculated analytics views.
6.  **Temporal Workflow**: An endpoint (`/v1/sync/start`) simulates triggering a Temporal workflow for a full, non-CDC data backfill/sync operation.
7.  **Observability**: Full Prometheus metrics are exposed on the `/metrics` endpoint.
8.  **Production Readiness**: Includes a `Dockerfile` and Kubernetes deployment manifests (`k8s/deployment.yaml`).

## API Endpoints

| Method | Path | Description | Request Body | Response Body |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/v1/events/policy` | Simulates receiving a `blockchain_policies` CDC event. | `{"id": "...", "policy_id": "...", "state": "...", "premium": 100.0, "timestamp": "..."}` | `{"status": "event processed", "policy_id": "..."}` |
| `POST` | `/v1/events/claim` | Simulates receiving a `blockchain_claims` CDC event. | `{"id": "...", "claim_id": "...", "status": "...", "payout": 500.0, "timestamp": "..."}` | `{"status": "event processed", "claim_id": "..."}` |
| `GET` | `/v1/analytics/{viewName}` | Retrieves a simulated analytics view (e.g., `policy_summary`, `claim_payout_ratio`). | None | JSON object with view data. |
| `POST` | `/v1/sync/start` | Triggers a Temporal workflow for a full data sync. | None | `{"status": "full sync workflow started", "workflow_id": "..."}` |
| `GET` | `/health` | Standard health check endpoint. | None | `OK` |
| `GET` | `/metrics` | Prometheus metrics endpoint. | None | Prometheus exposition format. |

## Local Development

1.  **Prerequisites**: Go 1.21+, Docker, `confluent-kafka-go` dependencies (librdkafka).
2.  **Build**: `go build -o lakehouse-integration-service ./cmd/lakehouse-integration-service/main.go`
3.  **Run**: `./lakehouse-integration-service`

## Deployment

The service is designed for containerized deployment.

1.  **Build Docker Image**: `docker build -t etherisc/lakehouse-integration-service:latest .`
2.  **Deploy to Kubernetes**: Apply the manifest in `k8s/deployment.yaml`.

```bash
kubectl apply -f k8s/deployment.yaml
```

**Note**: The Kafka and DB connection details must be configured via environment variables or Kubernetes secrets.
