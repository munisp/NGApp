# Payment Switch Orchestration Layer

## Overview

This directory contains the Temporal-based orchestration layer that coordinates all user journeys across the Payment Switch platform. The orchestrator integrates with multiple middleware components to provide reliable, fault-tolerant workflow execution.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

### Components

- **Temporal Server**: Workflow orchestration engine
- **Go Workers**: High-performance activities (payments, ledger, webhooks)
- **Python Workers**: ML and data-intensive activities (fraud detection, OCR, analytics)
- **Middleware**: Kafka, Redis, Dapr, Keycloak, Permify, TigerBeetle, Fluvio, APISIX, Lakehouse

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Go 1.21+ (for local development)
- Python 3.11+ (for local development)
- Access to Payment Switch database

### 1. Start Infrastructure

```bash
# Start all middleware services
cd orchestrator
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:

```env
# Temporal
TEMPORAL_HOST=localhost:7233
TEMPORAL_NAMESPACE=default
TASK_QUEUE=payment-switch
PYTHON_TASK_QUEUE=python-workers

# Database
DATABASE_URL=mysql://user:password@localhost:3306/payment_switch

# Kafka
KAFKA_BROKERS=localhost:9092

# Redis
REDIS_HOST=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Dapr
DAPR_HOST=localhost
DAPR_PORT=3500

# Keycloak
KEYCLOAK_URL=http://localhost:8081
KEYCLOAK_REALM=payment-switch
KEYCLOAK_CLIENT_ID=orchestrator

# Permify
PERMIFY_HOST=localhost
PERMIFY_PORT=3476

# TigerBeetle
TIGERBEETLE_HOST=localhost
TIGERBEETLE_PORT=3001

# Fluvio
FLUVIO_HOST=localhost:9003

# APISIX
APISIX_ADMIN_URL=http://localhost:9180
APISIX_ADMIN_KEY=your-admin-key

# Lakehouse
LAKEHOUSE_URL=http://localhost:8081

# Payment Gateway
PAYMENT_GATEWAY_URL=http://localhost:8000
PAYMENT_GATEWAY_API_KEY=your-api-key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@payment-switch.com

# Application
ENVIRONMENT=development
LOG_LEVEL=info
```

### 3. Build Workers

#### Go Worker

```bash
cd workers/go
go mod download
go build -o worker ./cmd/worker
./worker
```

#### Python Worker

```bash
cd workers/python
pip install -r requirements.txt
python worker.py
```

### 4. Access Temporal UI

Open http://localhost:8080 to view:
- Running workflows
- Workflow history
- Activity execution
- Task queues
- Worker status

## Workflows

### 1. Payment Processing Workflow

Orchestrates the complete payment flow:

1. Validate payment session
2. Check merchant permissions (Permify)
3. Fraud detection (Python ML worker)
4. Payment authorization
5. 3D Secure handling (if required)
6. Payment capture
7. Ledger recording (TigerBeetle)
8. Event publishing (Kafka)
9. Real-time streaming (Fluvio)
10. Webhook delivery
11. Email receipt
12. Analytics storage (Lakehouse)

**Trigger:**

```bash
temporal workflow start \
  --task-queue payment-switch \
  --type PaymentProcessingWorkflow \
  --workflow-id payment-$(date +%s) \
  --input '{"SessionID":"sess_123","MerchantID":1,"Amount":10000,"Currency":"USD","PaymentMethod":"card"}'
```

### 2. Merchant Onboarding Workflow

Orchestrates merchant onboarding:

1. Send email verification
2. Wait for email confirmation
3. OCR document processing (Python)
4. Data validation
5. Compliance check
6. Admin review (if required)
7. Generate API credentials
8. Create merchant account
9. Setup permissions (Permify)
10. Create ledger accounts (TigerBeetle)
11. Send welcome email
12. Create integration environment
13. Schedule reminder emails
14. Publish onboarding event (Kafka)
15. Write to analytics (Lakehouse)

**Trigger:**

```bash
temporal workflow start \
  --task-queue payment-switch \
  --type MerchantOnboardingWorkflow \
  --workflow-id onboarding-$(date +%s) \
  --input '{"ID":1,"BusinessName":"Acme Corp","Email":"merchant@acme.com","Documents":["doc1.pdf","doc2.pdf"]}'
```

### 3. Refund Processing Workflow

Orchestrates refund processing:

1. Validate transaction
2. Check refund eligibility
3. Process refund with gateway
4. Reverse ledger entry (TigerBeetle)
5. Publish event (Kafka)
6. Send webhook
7. Write to analytics (Lakehouse)

**Trigger:**

```bash
temporal workflow start \
  --task-queue payment-switch \
  --type RefundProcessingWorkflow \
  --workflow-id refund-$(date +%s) \
  --input '{"TransactionID":"txn_123","MerchantID":1,"Amount":5000,"Reason":"Customer request"}'
```

### 4. Webhook Delivery Workflow

Reliable webhook delivery with retries:

1. Get merchant webhook URL
2. Deliver webhook with exponential backoff
3. Log delivery status
4. Publish failure event if all retries fail

### 5. Notification Delivery Workflow

Multi-channel notification delivery:

1. Get user notification preferences
2. Check if user wants this notification
3. Send via preferred channel (email/SMS/Slack/push)
4. Log delivery

### 6. Compliance Check Workflow

Automated compliance validation:

1. Run compliance checks (KYC, AML, sanctions)
2. Wait for manual review if required
3. Log result
4. Publish event

### 7. Settlement Processing Workflow

Batch settlement to merchants:

1. Calculate settlement amount
2. Create payout
3. Record in ledger
4. Send notification
5. Write to analytics

## Activities

### Go Activities

**Payment Activities:**
- `ValidatePaymentSession`: Validate payment session exists and is active
- `AuthorizePayment`: Authorize payment with gateway
- `CapturePayment`: Capture authorized payment
- `VoidAuthorization`: Void payment authorization
- `RefundPayment`: Process refund

**Ledger Activities:**
- `RecordLedgerEntry`: Record transaction in TigerBeetle
- `ReverseLedgerEntry`: Reverse ledger entry for refunds

**Notification Activities:**
- `SendWebhook`: Deliver webhook to merchant
- `SendEmail`: Send email via SMTP
- `SendNotification`: Send multi-channel notification

**Integration Activities:**
- `PublishToKafka`: Publish event to Kafka topic
- `StreamToFluvio`: Stream data to Fluvio
- `WriteLakehouse`: Write data to Lakehouse

**Security Activities:**
- `CheckPermission`: Check permission via Permify
- `ValidateToken`: Validate JWT token via Keycloak

**Caching Activities:**
- `CacheSet`: Set value in Redis
- `CacheGet`: Get value from Redis

### Python Activities

**ML Activities:**
- `DetectFraud`: ML-based fraud detection
- `TrainFraudModel`: Train fraud detection model
- `EvaluateFraudRules`: Evaluate fraud rules

**OCR Activities:**
- `ProcessDocuments`: Process documents with OCR
- `ExtractText`: Extract text from document
- `CorrectOCRErrors`: Correct OCR errors using patterns

**Analytics Activities:**
- `GenerateReport`: Generate analytics report
- `CalculateMetrics`: Calculate business metrics
- `AggregateData`: Aggregate transaction data

**Compliance Activities:**
- `RunComplianceCheck`: Run comprehensive compliance check
- `ValidateKYC`: Validate KYC information
- `CheckSanctions`: Check against sanctions lists

## Development

### Running Tests

#### Go Tests

```bash
cd workers/go
go test ./...
```

#### Python Tests

```bash
cd workers/python
pytest
```

### Adding New Workflows

1. Create workflow file in `workers/go/internal/workflows/` or `workers/python/workflows/`
2. Define workflow function with `@workflow.defn` decorator (Python) or workflow interface (Go)
3. Register workflow in worker main file
4. Add activities as needed
5. Write tests
6. Update documentation

### Adding New Activities

1. Create activity function in appropriate activities file
2. Decorate with `@activity.defn` (Python) or implement activity interface (Go)
3. Register activity in worker
4. Write tests
5. Update documentation

## Monitoring

### Temporal UI

- **Workflows**: http://localhost:8080/namespaces/default/workflows
- **Task Queues**: http://localhost:8080/namespaces/default/task-queues
- **Archival**: http://localhost:8080/namespaces/default/archival

### Metrics

Temporal exposes Prometheus metrics on port 9090:

```bash
curl http://localhost:9090/metrics
```

Key metrics:
- `temporal_workflow_completed`: Completed workflows
- `temporal_workflow_failed`: Failed workflows
- `temporal_activity_execution_latency`: Activity execution time
- `temporal_workflow_task_queue_latency`: Task queue latency

### Logs

View worker logs:

```bash
# Go worker
docker-compose logs -f go-worker

# Python worker
docker-compose logs -f python-worker

# Temporal server
docker-compose logs -f temporal
```

## Troubleshooting

### Workflow Stuck

1. Check Temporal UI for workflow status
2. View workflow history for failed activities
3. Check worker logs for errors
4. Verify middleware services are running

### Activity Timeout

1. Increase `StartToCloseTimeout` in workflow
2. Check activity logs for slow operations
3. Optimize activity implementation
4. Scale workers horizontally

### Worker Not Receiving Tasks

1. Verify worker is connected to Temporal
2. Check task queue name matches workflow
3. Ensure worker is registered for workflow/activity
4. Check network connectivity

### Database Connection Issues

1. Verify DATABASE_URL is correct
2. Check database is accessible from worker
3. Verify credentials
4. Check connection pool settings

## Production Deployment

### Kubernetes

See [kubernetes/](../kubernetes/) directory for Kubernetes manifests.

```bash
# Deploy Temporal
kubectl apply -f kubernetes/temporal/

# Deploy workers
kubectl apply -f kubernetes/workers/

# Deploy middleware
kubectl apply -f kubernetes/middleware/
```

### Scaling

**Horizontal Scaling:**

```bash
# Scale Go workers
kubectl scale deployment go-worker --replicas=10

# Scale Python workers
kubectl scale deployment python-worker --replicas=5
```

**Auto-scaling:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: go-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: go-worker
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### High Availability

- Run multiple Temporal server instances
- Use external database (PostgreSQL/MySQL) for persistence
- Configure Elasticsearch for visibility
- Use Kafka for event streaming
- Deploy workers across multiple availability zones

## Security

### Authentication

- All worker-to-Temporal communication uses mTLS
- Keycloak handles user authentication
- API keys for external integrations

### Authorization

- Permify enforces fine-grained permissions
- Role-based access control (RBAC)
- Resource-level policies

### Secrets Management

- Use Kubernetes secrets in production
- Dapr secret store integration
- Never commit secrets to git

### Network Security

- All services in private network
- APISIX as API gateway
- TLS for all external communication

## Support

For issues or questions:
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
- View Temporal UI for workflow debugging
- Check logs for error messages
- Contact platform team

## License

Copyright © 2024 Payment Switch. All rights reserved.
