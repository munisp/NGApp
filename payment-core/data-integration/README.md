# Data Integration Services

This directory contains all services and pipelines for bi-directional data integration between TigerBeetle, PostgreSQL, and the Lakehouse (Delta Lake).

## Directory Structure

```
data-integration/
├── tigerbeetle-cdc/                    # TigerBeetle CDC Connector
│   ├── tigerbeetle_cdc_connector.py    # Main CDC connector service
│   ├── Dockerfile                       # Container image
│   └── requirements.txt                 # Python dependencies
│
├── kafka-postgres-sync/                # Kafka to PostgreSQL Sync Service
│   ├── kafka_postgres_sync.py          # Main sync service
│   ├── Dockerfile                       # Container image
│   └── requirements.txt                 # Python dependencies
│
├── postgres-lakehouse-batch-sync/      # PostgreSQL to Lakehouse Batch Sync
│   ├── postgres_lakehouse_batch_sync.py # Batch sync service
│   ├── Dockerfile                       # Container image
│   └── requirements.txt                 # Python dependencies
│
├── fraud-gnn-training/                 # Fraud GNN Training Pipeline
│   ├── fraud_gnn_training_pipeline.py  # Training pipeline
│   ├── Dockerfile                       # Container image (GPU-enabled)
│   └── requirements.txt                 # Python dependencies
│
├── fraud-score-ingestion/              # Fraud Score Ingestion Service
│   ├── fraud_score_ingestion.py        # Ingestion service
│   ├── Dockerfile                       # Container image
│   └── requirements.txt                 # Python dependencies
│
└── lakehouse-feedback/                 # Lakehouse Feedback Services
    ├── lakehouse_postgres_feedback.py  # Lakehouse → PostgreSQL feedback
    ├── lakehouse_tigerbeetle_feedback.py # Lakehouse → TigerBeetle feedback
    ├── Dockerfile                       # Container image
    └── requirements.txt                 # Python dependencies
```

## Services Overview

### 1. TigerBeetle CDC Connector

**Purpose:** Capture changes from TigerBeetle and publish to Kafka topics.

**Key Features:**
- Polls TigerBeetle every 5 seconds for new accounts and transfers
- Publishes to Kafka topics: `tigerbeetle.accounts`, `tigerbeetle.transfers`
- Maintains cursor position for incremental processing
- Exposes Prometheus metrics

**Configuration:**
```bash
TIGERBEETLE_ADDRESS=tigerbeetle-0.tigerbeetle:3000
TIGERBEETLE_CLUSTER_ID=0
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC_ACCOUNTS=tigerbeetle.accounts
KAFKA_TOPIC_TRANSFERS=tigerbeetle.transfers
POLL_INTERVAL=5
```

**Deployment:**
```bash
kubectl apply -f deployment/kubernetes/data-integration/data-integration-services.yaml
```

### 2. Kafka to PostgreSQL Sync Service

**Purpose:** Consume Kafka topics and sync to PostgreSQL tables.

**Key Features:**
- Consumes from multiple Kafka topics
- Batches database writes (1000 records per batch)
- Uses upsert for idempotency
- Tracks consumer lag

**Configuration:**
```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPICS=tigerbeetle.accounts,tigerbeetle.transfers
KAFKA_GROUP_ID=kafka-postgres-sync
POSTGRES_DSN=postgresql://user:pass@postgres:5432/paymentdb
BATCH_SIZE=1000
```

### 3. PostgreSQL to Lakehouse Batch Sync

**Purpose:** Incremental batch sync from PostgreSQL to Delta Lake.

**Key Features:**
- Runs every 6 hours via CronJob
- Incremental sync using `updated_at` timestamp
- Parallel data loading with Spark
- Delta Lake merge for upsert semantics

**Configuration:**
```bash
POSTGRES_DSN=postgresql://user:pass@postgres:5432/paymentdb
DELTA_LAKE_PATH=s3a://lakehouse/delta
SYNC_MODE=incremental
BATCH_SIZE=100000
```

### 4. Fraud GNN Training Pipeline

**Purpose:** Train Graph Neural Network models on transaction graphs from Delta Lake.

**Key Features:**
- Reads transaction graphs from Delta Lake
- Trains GAT model with 3 layers
- Implements focal loss for imbalanced data
- Saves models to S3/MinIO with versioning
- Runs daily at 2 AM via CronJob

**Configuration:**
```bash
DELTA_LAKE_PATH=s3a://lakehouse/delta
MODEL_OUTPUT_PATH=s3a://lakehouse/models
TRAINING_WINDOW_DAYS=90
VALIDATION_SPLIT=0.2
BATCH_SIZE=1024
LEARNING_RATE=0.001
```

### 5. Fraud Score Ingestion Service

**Purpose:** Ingest fraud scores from Kafka to Delta Lake.

**Key Features:**
- Consumes from `fraud.scores` Kafka topic
- Micro-batching with 10-second timeout
- Schema validation and data quality checks
- Exposes ingestion lag metrics

**Configuration:**
```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_TOPIC=fraud.scores
KAFKA_GROUP_ID=fraud-score-ingestion
DELTA_LAKE_PATH=s3a://lakehouse/delta/fraud_scores
BATCH_SIZE=1000
BATCH_TIMEOUT=10.0
```

### 6. Lakehouse to PostgreSQL Feedback

**Purpose:** Update PostgreSQL with analytics insights from Lakehouse.

**Key Features:**
- Computes account risk scores
- Aggregates velocity patterns
- Generates fraud alerts
- Runs every 15 minutes via CronJob

**Configuration:**
```bash
DELTA_LAKE_PATH=s3a://lakehouse/delta
POSTGRES_DSN=postgresql://user:pass@postgres:5432/paymentdb
RISK_SCORE_THRESHOLD=0.7
VELOCITY_THRESHOLD=50
```

### 7. Lakehouse to TigerBeetle Feedback

**Purpose:** Apply risk-based controls to TigerBeetle based on Lakehouse analytics.

**Key Features:**
- Adjusts account limits based on risk scores
- Applies velocity controls
- Sets fraud flags via Ledger Service gRPC
- Runs every 30 minutes via CronJob

**Configuration:**
```bash
DELTA_LAKE_PATH=s3a://lakehouse/delta
TIGERBEETLE_ADDRESS=ledger-service.payment-switch:50051
TIGERBEETLE_CLUSTER_ID=0
LOW_RISK_DAILY_LIMIT=1000000
MEDIUM_RISK_DAILY_LIMIT=500000
HIGH_RISK_DAILY_LIMIT=100000
```

## Building Docker Images

Each service has a Dockerfile for containerization:

```bash
# Build TigerBeetle CDC Connector
cd tigerbeetle-cdc
docker build -t nextgen-payment-switch/tigerbeetle-cdc-connector:latest .

# Build Kafka to PostgreSQL Sync
cd kafka-postgres-sync
docker build -t nextgen-payment-switch/kafka-postgres-sync:latest .

# Build PostgreSQL to Lakehouse Batch Sync
cd postgres-lakehouse-batch-sync
docker build -t nextgen-payment-switch/postgres-lakehouse-batch-sync:latest .

# Build Fraud GNN Training
cd fraud-gnn-training
docker build -t nextgen-payment-switch/fraud-gnn-training:latest .

# Build Fraud Score Ingestion
cd fraud-score-ingestion
docker build -t nextgen-payment-switch/fraud-score-ingestion:latest .

# Build Lakehouse Feedback Services
cd lakehouse-feedback
docker build -t nextgen-payment-switch/lakehouse-postgres-feedback:latest .
docker build -t nextgen-payment-switch/lakehouse-tigerbeetle-feedback:latest .
```

## Deployment

Deploy all data integration services to Kubernetes:

```bash
# Create namespace
kubectl create namespace data-integration

# Create secrets for credentials
kubectl create secret generic postgres-credentials \
  --from-literal=dsn='postgresql://user:pass@postgres:5432/paymentdb' \
  -n data-integration

kubectl create secret generic s3-credentials \
  --from-literal=access-key='minioadmin' \
  --from-literal=secret-key='minioadmin' \
  -n data-integration

# Deploy all services
kubectl apply -f deployment/kubernetes/data-integration/data-integration-services.yaml

# Verify deployments
kubectl get pods -n data-integration
kubectl get cronjobs -n data-integration
```

## Monitoring

All services expose Prometheus metrics on port 8080:

```bash
# View metrics for TigerBeetle CDC Connector
kubectl port-forward -n data-integration deployment/tigerbeetle-cdc-connector 8080:8080
curl http://localhost:8080/metrics

# View Flink JobManager UI
kubectl port-forward -n data-integration svc/flink-jobmanager-postgres-lakehouse 8081:8081
# Open http://localhost:8081 in browser
```

### Key Metrics

**TigerBeetle CDC Connector:**
- `tigerbeetle_cdc_accounts_processed_total`
- `tigerbeetle_cdc_transfers_processed_total`
- `tigerbeetle_cdc_processing_duration_seconds`
- `tigerbeetle_cdc_errors_total`

**Kafka to PostgreSQL Sync:**
- `kafka_postgres_sync_messages_consumed_total`
- `kafka_postgres_sync_records_written_total`
- `kafka_postgres_sync_lag_seconds`
- `kafka_postgres_sync_batch_duration_seconds`

**Fraud Score Ingestion:**
- `fraud_score_ingestion_scores_processed_total`
- `fraud_score_ingestion_batch_size`
- `fraud_score_ingestion_lag_seconds`

**Lakehouse Feedback Services:**
- `lakehouse_feedback_accounts_updated_total`
- `lakehouse_feedback_duration_seconds`
- `lakehouse_feedback_errors_total`

## Troubleshooting

### High Consumer Lag

**Symptoms:** Kafka consumer lag exceeds 60 seconds

**Solutions:**
1. Scale up consumer replicas:
   ```bash
   kubectl scale deployment kafka-postgres-sync -n data-integration --replicas=4
   ```
2. Increase batch size in configuration
3. Check Kafka broker health

### Flink Job Failure

**Symptoms:** Flink job fails or restarts frequently

**Solutions:**
1. Check Flink logs:
   ```bash
   kubectl logs -n data-integration deployment/flink-jobmanager-postgres-lakehouse
   ```
2. Verify Kafka connectivity
3. Check S3/MinIO credentials
4. Restart from last checkpoint

### Batch Sync Failure

**Symptoms:** CronJob fails to complete

**Solutions:**
1. Check job logs:
   ```bash
   kubectl logs -n data-integration job/postgres-lakehouse-batch-sync-<timestamp>
   ```
2. Verify PostgreSQL connectivity
3. Check S3/MinIO credentials
4. Run manual reconciliation

### CDC Connector Down

**Symptoms:** CDC connector unavailable for 5+ minutes

**Solutions:**
1. Check pod status:
   ```bash
   kubectl get pods -n data-integration -l app=tigerbeetle-cdc
   ```
2. View pod logs:
   ```bash
   kubectl logs -n data-integration deployment/tigerbeetle-cdc-connector
   ```
3. Verify TigerBeetle connectivity
4. Restart deployment if necessary

## Performance Tuning

### TigerBeetle CDC Connector

- **Poll Interval:** Reduce for lower latency, increase for lower load
- **Batch Size:** Increase for better throughput
- **Replicas:** Scale based on TigerBeetle load

### Kafka to PostgreSQL Sync

- **Batch Size:** Increase for better throughput (trade-off: latency)
- **Consumer Threads:** Increase for parallel processing
- **Replicas:** Scale based on Kafka partition count

### Flink Streaming Pipeline

- **Parallelism:** Increase for higher throughput
- **Task Slots:** Increase TaskManager replicas
- **Checkpoint Interval:** Adjust based on latency/throughput trade-off

### Fraud Score Ingestion

- **Batch Size:** Increase for better throughput
- **Batch Timeout:** Decrease for lower latency
- **Replicas:** Scale based on fraud detection load

## Data Quality

All pipelines implement data quality checks:

- **Schema Validation:** Ensure data conforms to expected schema
- **Range Validation:** Check numeric values are within expected ranges
- **Referential Integrity:** Validate foreign key relationships
- **Duplicate Detection:** Identify and handle duplicate records
- **Completeness:** Track missing or null values

Data quality metrics are exposed via Prometheus and visualized in Grafana dashboards.

## Security

### Authentication

- **TigerBeetle:** Client authentication using cluster ID
- **PostgreSQL:** Username/password stored in Kubernetes secrets
- **Kafka:** SASL/SCRAM authentication with ACLs
- **S3/MinIO:** Access key and secret key stored in Kubernetes secrets

### Network Isolation

- **Kubernetes Network Policies:** Restrict traffic between namespaces
- **Private Subnets:** Data integration services in private subnets
- **No Public Access:** All services accessible only within cluster

### Encryption

- **In Transit:** TLS 1.3 for all network communication
- **At Rest:** Server-side encryption for S3/MinIO storage

## Testing

### Unit Tests

Run unit tests for each service:

```bash
# TigerBeetle CDC Connector
cd tigerbeetle-cdc
python -m pytest tests/

# Kafka to PostgreSQL Sync
cd kafka-postgres-sync
python -m pytest tests/

# Other services...
```

### Integration Tests

Run integration tests with Docker Compose:

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
python -m pytest integration_tests/

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### End-to-End Tests

Run end-to-end tests in Kubernetes:

```bash
# Deploy test environment
kubectl apply -f deployment/kubernetes/test/

# Run E2E tests
python -m pytest e2e_tests/

# Cleanup
kubectl delete -f deployment/kubernetes/test/
```

## Contributing

When adding new data integration services:

1. Create a new directory under `data-integration/`
2. Implement the service with proper error handling and logging
3. Add Dockerfile and requirements.txt
4. Expose Prometheus metrics
5. Add Kubernetes deployment manifests
6. Update this README
7. Add unit and integration tests
8. Update monitoring dashboards

## License

Copyright © 2025 Next-Generation Payment Switch Platform. All rights reserved.
