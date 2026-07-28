# ERPNext Integration Service

**Author**: Manus AI  
**Date**: January 28, 2026

## Overview

The ERPNext Integration Service is a dedicated microservice that provides bidirectional synchronization between the insurance platform and ERPNext. It consumes events from Kafka and syncs data to ERPNext via REST API, enabling the insurance platform to leverage ERPNext's robust accounting, CRM, and HR capabilities.

## Architecture

The service acts as a bridge between the insurance platform and ERPNext, consuming events from Kafka topics and syncing data to ERPNext in real-time. It implements four key synchronization flows:

1. **Financial Synchronization**: Syncs financial transactions from TigerBeetle to ERPNext General Ledger
2. **CRM Synchronization**: Syncs customer data to ERPNext CRM
3. **HR Synchronization**: Syncs agent data to ERPNext HR & Payroll
4. **Document Synchronization**: Syncs policy documents and claims evidence to ERPNext Document Management System

## Features

- **Event-Driven Architecture**: Consumes events from Kafka for asynchronous processing
- **Comprehensive Financial Sync**: Maps TigerBeetle transfers to ERPNext Journal Entries with proper double-entry accounting
- **Customer Data Sync**: Creates and updates customer records in ERPNext CRM
- **Agent Management**: Syncs agent data to ERPNext HR as employees
- **Commission Processing**: Creates Payment Entries for agent commissions
- **Document Management**: Uploads policy documents and claims evidence to ERPNext DMS
- **Error Handling**: Robust error handling with logging for troubleshooting
- **Scalable**: Can be deployed with multiple replicas for high availability

## Technology Stack

- **Language**: Go 1.21
- **Messaging**: Apache Kafka (Sarama client)
- **API**: ERPNext REST API
- **Deployment**: Docker & Kubernetes

## Configuration

The service is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ERPNEXT_BASE_URL` | Base URL of ERPNext instance | `https://erpnext.example.com` |
| `ERPNEXT_API_KEY` | ERPNext API key | (required) |
| `ERPNEXT_API_SECRET` | ERPNext API secret | (required) |
| `ERPNEXT_COMPANY` | ERPNext company name | `Insurance Company` |
| `KAFKA_BROKERS` | Comma-separated list of Kafka brokers | `localhost:9092` |
| `KAFKA_GROUP_ID` | Kafka consumer group ID | `erpnext-integration` |
| `KAFKA_TOPICS` | Comma-separated list of Kafka topics | `payment-events,customer-events,agent-events,document-events` |

## Event Types

The service processes the following event types:

### Financial Events

- **`premium.paid`**: Premium payment event
  - Creates a Journal Entry: Debit Bank Account, Credit Unearned Premium Revenue
  
- **`claim.paid`**: Claim payment event
  - Creates a Journal Entry: Debit Claim Expense, Credit Bank Account
  
- **`commission.paid`**: Commission payment event
  - Creates a Journal Entry: Debit Commission Expense, Credit Commission Payable
  - Creates a Payment Entry: Pay commission to agent

### CRM Events

- **`customer.created`**: New customer created
  - Creates a Customer record in ERPNext CRM
  
- **`customer.updated`**: Customer information updated
  - Updates the Customer record in ERPNext CRM

### HR Events

- **`agent.created`**: New agent onboarded
  - Creates an Employee record in ERPNext HR

### Document Events

- **`document.created`**: New document uploaded
  - Downloads the document from S3 and uploads it to ERPNext DMS

## Deployment

### Local Development

```bash
# Set environment variables
export ERPNEXT_BASE_URL="https://erpnext.example.com"
export ERPNEXT_API_KEY="your-api-key"
export ERPNEXT_API_SECRET="your-api-secret"
export KAFKA_BROKERS="localhost:9092"

# Run the service
go run cmd/main.go
```

### Docker

```bash
# Build the Docker image
docker build -t insurance-platform/erpnext-integration-service:latest .

# Run the container
docker run -d \
  -e ERPNEXT_BASE_URL="https://erpnext.example.com" \
  -e ERPNEXT_API_KEY="your-api-key" \
  -e ERPNEXT_API_SECRET="your-api-secret" \
  -e KAFKA_BROKERS="kafka:9092" \
  insurance-platform/erpnext-integration-service:latest
```

### Kubernetes

```bash
# Apply the deployment manifest
kubectl apply -f k8s/deployment.yaml

# Check the deployment status
kubectl get pods -n insurance-platform -l app=erpnext-integration-service

# View logs
kubectl logs -n insurance-platform -l app=erpnext-integration-service --tail=100 -f
```

## ERPNext Setup

### 1. Create API Credentials

1. Log in to ERPNext as Administrator
2. Go to **User** → **API Access**
3. Click **Generate Keys**
4. Copy the API Key and API Secret

### 2. Create Chart of Accounts

Ensure the following accounts exist in your ERPNext Chart of Accounts:

- **Bank Account - Main** (Asset)
- **Unearned Premium Revenue - Main** (Liability)
- **Claim Expense - Main** (Expense)
- **Commission Expense - Main** (Expense)
- **Commission Payable - Main** (Liability)

### 3. Configure Company

Ensure the company name in ERPNext matches the `ERPNEXT_COMPANY` environment variable.

## Financial Mapping

The service maps TigerBeetle transfers to ERPNext Journal Entries as follows:

| TigerBeetle Transfer | ERPNext Journal Entry | Debit Account | Credit Account |
|----------------------|-----------------------|---------------|----------------|
| `PREMIUM_PAYMENT` | Premium Payment | Bank Account - Main | Unearned Premium Revenue - Main |
| `CLAIM_PAYMENT` | Claim Payment | Claim Expense - Main | Bank Account - Main |
| `COMMISSION_PAYMENT` | Commission Payment | Commission Expense - Main | Commission Payable - Main |

## Monitoring

The service logs all operations to stdout. Key log messages include:

- `Syncing premium payment: PolicyID=..., Amount=...`
- `Created Journal Entry: ...`
- `Submitted Journal Entry: ...`
- `Error processing message: ...`

Monitor these logs to track synchronization status and troubleshoot issues.

## Error Handling

The service implements robust error handling:

- **Kafka Consumer Errors**: Logged and retried automatically
- **ERPNext API Errors**: Logged with full error details
- **Network Errors**: Logged and retried with exponential backoff

Failed messages are logged but do not stop the consumer, ensuring continuous operation.

## Future Enhancements

- **Sync Status Tracking**: Store sync status in PostgreSQL for reconciliation
- **Retry Queue**: Implement a dead-letter queue for failed messages
- **Reconciliation Report**: Generate daily reconciliation reports comparing TigerBeetle and ERPNext
- **Bidirectional Sync**: Sync data from ERPNext back to the insurance platform
- **Webhook Support**: Support ERPNext webhooks for real-time updates

## License

Proprietary - Insurance Platform

## Support

For issues or questions, contact the platform team.
