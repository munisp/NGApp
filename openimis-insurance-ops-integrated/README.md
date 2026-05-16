# Claims Reserve Calculation Integration Service

This service integrates OpenIMIS claims reporting workflow with a claims reserve calculation engine, utilizing **Temporal** for automated, reliable reserve adjustments and **Prometheus** for observability.

## Features Implemented

1.  **Temporal Workflow**: `ReserveAdjustmentWorkflow` for automated reserve calculation and synchronization.
2.  **IBNR Calculation**: `IBNRCalculationWorkflow` for scheduled or triggered Incurred But Not Reported (IBNR) reserve calculation.
3.  **Large Claim Review**: Logic to trigger an external **Actuarial Review** for claims exceeding a threshold (mocked via `openimis` client).
4.  **Real-time Reserve Update**: Syncs calculated reserves back to the OpenIMIS Claims Service (mocked).
5.  **Database Persistence**: Stores reserve history in a PostgreSQL database.
6.  **Production Readiness**: Includes structured logging (Zap), Prometheus metrics, and Kubernetes manifests.

## Components

| Component | Description |
| :--- | :--- |
| `cmd/api` | REST API to trigger workflows (e.g., on claim creation event). |
| `cmd/worker` | Temporal Worker to host workflows and activities. |
| `internal/temporal` | Temporal workflows and activities implementation. |
| `internal/calculator` | Core business logic for reserve calculation. |
| `internal/db` | Database connection, migration, and repository logic. |
| `internal/openimis` | Mock client for OpenIMIS and Actuarial services. |
| `pkg/log`, `pkg/metrics` | Structured logging and Prometheus metrics utilities. |
| `k8s` | Kubernetes deployment manifests. |

## Configuration

The service is configured via `config/config.yaml` and environment variables.

| Setting | Default Value | Description |
| :--- | :--- | :--- |
| `temporal.hostPort` | `temporal-frontend:7233` | Temporal server address. |
| `temporal.taskQueue` | `CLAIMS_RESERVE_TASK_QUEUE` | Temporal task queue name. |
| `database.name` | `claims_reserve_db` | PostgreSQL database name. |
| `server.port` | `8080` | API server port. |
| `metrics.port` | `9090` | Prometheus metrics server port. |

## Deployment

The `k8s` directory contains Kubernetes manifests for deploying the API, Worker, and a placeholder PostgreSQL database.

1.  **Build Docker Image**:
    \`\`\`bash
    docker build -t claims-reserve-service:latest .
    # Push to your registry
    # docker push your-registry/claims-reserve-service:latest
    \`\`\`
2.  **Deploy to Kubernetes**:
    \`\`\`bash
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/db-service.yaml
    kubectl apply -f k8s/deployment.yaml
    \`\`\`
\`\`\`
