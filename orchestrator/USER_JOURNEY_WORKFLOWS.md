# User Journey Workflows - Complete Integration Guide

This document maps all 30 user stories to their corresponding Temporal workflows and microservice integrations.

## Architecture Overview

```
User Action → Web Portal → tRPC API → Temporal Workflow → Activities → Microservices
                                                        ↓
                                                   Middleware
                                        (Kafka, Redis, Dapr, TigerBeetle, etc.)
```

## User Story Workflow Mappings

### Category 1: Merchant Onboarding (US-001 to US-005)

#### US-001: New Merchant Registration
**Workflow:** `MerchantOnboardingWorkflow`
**Microservices Used:**
- Email Verification Service (Port 8005)
- OCR Processing (Python worker)
- Compliance Service (Python worker)

**Flow:**
1. Merchant submits application via web portal
2. Portal calls `trpc.merchant.apply.useMutation()`
3. tRPC triggers `MerchantOnboardingWorkflow`
4. Workflow steps:
   - Send verification email (microservice)
   - Wait for email verification signal
   - Upload KYC documents (microservice)
   - OCR document processing (Python activity)
   - Compliance checks (Python activity)
   - Manual review (if required)
   - Create merchant account
   - Generate API credentials
   - Set up permissions (Permify)
   - Create ledger accounts (TigerBeetle)
   - Send welcome email

**Integration Points:**
```go
// In merchant_onboarding.go
workflow.ExecuteActivity(ctx, "SendVerificationEmail", ...)
workflow.ExecuteActivity(ctx, "ProcessKYCDocuments", ...)
workflow.ExecuteActivity(ctx, "RunComplianceChecks", ...)
```

#### US-002: Configure Webhooks
**Workflow:** `WebhookConfigurationWorkflow`
**Microservices Used:** None (direct tRPC)

**Flow:**
1. Merchant configures webhook URL in dashboard
2. Portal calls `trpc.webhook.configure.useMutation()`
3. System validates endpoint connectivity
4. Stores webhook configuration
5. Sends test webhook

#### US-003: Generate API Keys
**Workflow:** Embedded in `MerchantOnboardingWorkflow`
**Microservices Used:** None

**Flow:**
1. Merchant requests new API key
2. System generates secure key pair
3. Stores encrypted credentials
4. Returns keys (secret shown once)

#### US-004: View Transaction Analytics
**Workflow:** None (real-time query)
**Microservices Used:**
- Analytics Dashboard Service (Port 8006)
- Export Service (Port 8002)

**Flow:**
1. Merchant opens analytics dashboard
2. Portal calls `trpc.analytics.getDashboard.useQuery()`
3. tRPC queries database + Redis cache
4. Real-time metrics via WebSocket from analytics service
5. Export via export microservice

**Integration Points:**
```typescript
// Frontend
const { data } = trpc.analytics.getDashboard.useQuery({ period: 'week' })

// WebSocket connection
const socket = io('http://analytics-service:8006')
socket.emit('subscribe', { merchant_id: 1 })
socket.on('metrics_update', (data) => updateDashboard(data))
```

#### US-005: Enable 2FA
**Workflow:** `TwoFactorSetupWorkflow`
**Microservices Used:** None

**Flow:**
1. Merchant enables 2FA in settings
2. System generates TOTP secret
3. Shows QR code for authenticator app
4. Merchant scans and verifies code
5. Backup codes generated
6. 2FA enabled

### Category 2: Payment Processing (US-006 to US-014)

#### US-006: Process Card Payment
**Workflow:** `PaymentProcessingWorkflow`
**Microservices Used:**
- Email Receipt Service (Port 8004)
- QR Code Service (Port 8001) - if QR payment
- Retry Service (Port 8003) - if payment fails

**Flow:**
1. Customer submits payment on checkout page
2. Portal calls `trpc.payment.process.useMutation()`
3. Workflow triggered with 15 steps:
   - Validate session (Keycloak)
   - Check permissions (Permify)
   - Fraud detection (Python ML model)
   - Authorization (payment gateway)
   - 3D Secure (if required)
   - Payment capture
   - Compensation (if capture fails)
   - Ledger recording (TigerBeetle)
   - Event publishing (Kafka)
   - Real-time streaming (Fluvio)
   - Webhook delivery
   - Email receipt (microservice)
   - QR generation (if applicable)
   - Analytics update (Lakehouse)
   - Cache update (Redis)

**Integration Points:**
```go
// In payment_processing.go
workflow.ExecuteActivity(ctx, "FraudDetection", ...)
workflow.ExecuteActivity(ctx, "AuthorizePayment", ...)
workflow.ExecuteActivity(ctx, "CapturePayment", ...)
workflow.ExecuteActivity(ctx, "RecordLedger", ...)
workflow.ExecuteActivity(ctx, "PublishKafkaEvent", ...)
workflow.ExecuteActivity(ctx, "SendEmailReceipt", ...)
workflow.ExecuteActivity(ctx, "GenerateQRCode", ...)
```

#### US-007: Initiate Refund
**Workflow:** `RefundProcessingWorkflow`
**Microservices Used:**
- Email Receipt Service (Port 8004)

**Flow:**
1. Merchant initiates refund
2. Portal calls `trpc.refund.initiate.useMutation()`
3. Workflow steps:
   - Validate refund eligibility
   - Check permissions
   - Process refund with gateway
   - Update ledger (TigerBeetle)
   - Publish event (Kafka)
   - Send webhook
   - Email customer
   - Update analytics

#### US-008: Handle Failed Payment
**Workflow:** `PaymentRetryWorkflow`
**Microservices Used:**
- Retry Service (Port 8003)

**Flow:**
1. Payment fails during processing
2. System automatically triggers retry workflow
3. Retry service schedules retries with exponential backoff
4. Attempts alternative payment methods if configured
5. Notifies customer of status

**Integration Points:**
```go
// In payment_processing.go (on failure)
workflow.ExecuteActivity(ctx, "SchedulePaymentRetry", RetryRequest{
    TransactionID: txnID,
    RetryStrategy: "exponential",
    MaxAttempts: 3,
    RetryInterval: 300,
})
```

#### US-009: Bulk Refund Processing
**Workflow:** `BulkRefundWorkflow`
**Microservices Used:**
- Email Receipt Service (Port 8004)

**Flow:**
1. Merchant uploads CSV of refunds
2. Portal calls `trpc.refund.bulkProcess.useMutation()`
3. Workflow spawns child workflows for each refund
4. Parallel processing with rate limiting
5. Progress tracking
6. Summary report generation

#### US-010: Receive Webhook Notification
**Workflow:** `WebhookDeliveryWorkflow`
**Microservices Used:** None

**Flow:**
1. Payment event occurs
2. Workflow retrieves merchant webhook config
3. Constructs payload with signature
4. Attempts delivery with retries
5. Logs delivery status
6. Alerts on persistent failures

#### US-011: Download Receipt
**Workflow:** None (on-demand)
**Microservices Used:**
- Email Receipt Service (Port 8004)

**Flow:**
1. Customer requests receipt
2. Portal calls `trpc.receipt.generate.useMutation()`
3. Email service generates HTML receipt
4. Returns PDF or sends email
5. Receipt cached for 24 hours

#### US-012: Bank Transfer Payment
**Workflow:** `BankTransferWorkflow`
**Microservices Used:**
- Email Receipt Service (Port 8004)

**Flow:**
1. Customer selects bank transfer
2. System generates unique reference number
3. Shows bank details and instructions
4. Workflow waits for payment confirmation signal
5. Once confirmed, completes payment
6. Sends receipt

#### US-013: QR Code Payment
**Workflow:** `QRPaymentWorkflow`
**Microservices Used:**
- QR Code Service (Port 8001)

**Flow:**
1. Customer selects QR payment
2. System generates QR code (microservice)
3. Customer scans with mobile wallet
4. Payment authorization received
5. Workflow completes payment
6. Sends receipt

**Integration Points:**
```go
// In payment_processing.go
workflow.ExecuteActivity(ctx, "GenerateQRCode", QRCodeRequest{
    SessionID: sessionID,
    Amount: amount,
    Currency: "USD",
    MerchantID: merchantID,
})
```

#### US-014: Retry Failed Payment
**Workflow:** `PaymentRetryWorkflow`
**Microservices Used:**
- Retry Service (Port 8003)

**Flow:**
1. Customer clicks "Retry Payment"
2. Portal calls `trpc.payment.retry.useMutation()`
3. Retry service schedules immediate retry
4. Attempts with same or alternative method
5. Updates customer on result

### Category 3: Compliance & Security (US-015 to US-020)

#### US-015: Submit Compliance Report
**Workflow:** `ComplianceReportingWorkflow`
**Microservices Used:**
- Export Service (Port 8002)

**Flow:**
1. Admin generates compliance report
2. System queries transactions for period
3. Export service generates report
4. Applies required formatting
5. Encrypts and uploads to secure storage
6. Notifies compliance team

#### US-016: Fraud Alert Investigation
**Workflow:** `FraudInvestigationWorkflow`
**Microservices Used:** None

**Flow:**
1. Fraud detection flags transaction
2. Workflow creates investigation case
3. Notifies fraud team
4. Gathers evidence (transaction history, device info)
5. Awaits manual review decision
6. Takes action (block, allow, request verification)

#### US-017: Real-time Monitoring
**Workflow:** None (streaming)
**Microservices Used:**
- Analytics Dashboard Service (Port 8006)

**Flow:**
1. Admin opens monitoring dashboard
2. WebSocket connection to analytics service
3. Real-time metrics streamed every second
4. Alerts triggered on thresholds
5. Historical data from Lakehouse

**Integration Points:**
```typescript
// Frontend
const socket = io('http://analytics-service:8006')
socket.on('metrics_update', (metrics) => {
  updateDashboard(metrics)
  checkAlerts(metrics)
})
```

#### US-018: Update Security Settings
**Workflow:** `SecurityUpdateWorkflow`
**Microservices Used:** None

**Flow:**
1. Merchant updates security settings
2. System validates changes
3. Updates Keycloak policies
4. Updates Permify permissions
5. Logs security event
6. Notifies merchant

#### US-019: Access Audit Logs
**Workflow:** None (query)
**Microservices Used:**
- Export Service (Port 8002)

**Flow:**
1. Admin requests audit logs
2. System queries audit table
3. Filters by criteria
4. Export service generates report
5. Returns encrypted file

#### US-020: Automated Compliance Checks
**Workflow:** `AutomatedComplianceWorkflow` (scheduled)
**Microservices Used:**
- Compliance Service (Python worker)

**Flow:**
1. Scheduled daily at midnight
2. Workflow runs compliance checks:
   - Transaction limits
   - Velocity checks
   - Sanctions screening
   - PEP checks
3. Generates report
4. Alerts on violations

### Category 4: Customer Experience (US-021 to US-025)

#### US-021: Customize Checkout Branding
**Workflow:** None (configuration)
**Microservices Used:** None

**Flow:**
1. Merchant uploads logo and sets colors
2. Portal calls `trpc.branding.update.useMutation()`
3. System validates and stores settings
4. Generates preview link
5. Updates checkout script

#### US-022: Multi-currency Support
**Workflow:** Embedded in `PaymentProcessingWorkflow`
**Microservices Used:** None

**Flow:**
1. Customer selects currency
2. System converts amount using real-time rates
3. Processes payment in selected currency
4. Records both amounts in ledger

#### US-023: Saved Payment Methods
**Workflow:** None (CRUD)
**Microservices Used:** None

**Flow:**
1. Customer saves card during checkout
2. System tokenizes card (PCI compliant)
3. Stores token with customer profile
4. Customer can select saved card for future payments

#### US-024: Payment Status Tracking
**Workflow:** None (query)
**Microservices Used:** None

**Flow:**
1. Customer checks payment status
2. Portal queries transaction table
3. Shows real-time status
4. Provides timeline of events

#### US-025: Dispute Management
**Workflow:** `DisputeManagementWorkflow`
**Microservices Used:**
- Email Receipt Service (Port 8004)

**Flow:**
1. Customer files dispute
2. Workflow creates dispute case
3. Notifies merchant
4. Gathers evidence
5. Submits to payment network
6. Awaits resolution
7. Updates parties on outcome

### Category 5: Platform Management (US-026 to US-030)

#### US-026: Merchant Approval
**Workflow:** Part of `MerchantOnboardingWorkflow`
**Microservices Used:** None

**Flow:**
1. Admin reviews merchant application
2. Checks compliance results
3. Approves or rejects
4. Workflow receives signal
5. Continues or terminates onboarding

#### US-027: Settlement Processing
**Workflow:** `SettlementWorkflow` (scheduled)
**Microservices Used:**
- Export Service (Port 8002)

**Flow:**
1. Scheduled daily for settlement
2. Workflow calculates merchant balances
3. Deducts platform fees
4. Initiates bank transfers
5. Records in ledger (TigerBeetle)
6. Generates settlement report
7. Emails merchants

#### US-028: Platform Analytics
**Workflow:** None (query)
**Microservices Used:**
- Analytics Dashboard Service (Port 8006)
- Export Service (Port 8002)

**Flow:**
1. Admin views platform-wide analytics
2. Queries Lakehouse for aggregated data
3. Real-time metrics from Redis
4. Export reports as needed

#### US-029: API Rate Limiting
**Workflow:** None (middleware)
**Microservices Used:** None

**Flow:**
1. API request received by APISIX
2. APISIX checks rate limit (Redis)
3. Allows or rejects request
4. Logs rate limit events

#### US-030: System Health Monitoring
**Workflow:** None (monitoring)
**Microservices Used:**
- All microservices (health endpoints)

**Flow:**
1. Prometheus scrapes health endpoints
2. Grafana displays metrics
3. Alerts triggered on failures
4. Incident workflow initiated

## Workflow Execution Examples

### Example 1: Complete Payment Journey

```bash
# Customer initiates payment
POST /api/trpc/payment.process
{
  "sessionID": "sess_123",
  "amount": 10000,
  "currency": "USD",
  "paymentMethod": "card",
  "customerEmail": "customer@example.com"
}

# Temporal Workflow Started
Workflow ID: payment_sess_123
Run ID: abc-def-ghi

# Workflow Steps (15 total)
[Step 1] ✓ Validate session
[Step 2] ✓ Check permissions
[Step 3] ✓ Fraud detection (score: 0.95 - PASS)
[Step 4] ✓ Authorize payment
[Step 5] ✓ 3D Secure (not required)
[Step 6] ✓ Capture payment
[Step 7] ✓ Record ledger (TigerBeetle)
[Step 8] ✓ Publish event (Kafka)
[Step 9] ✓ Stream event (Fluvio)
[Step 10] ✓ Deliver webhook
[Step 11] ✓ Send email receipt (microservice)
[Step 12] ✓ Update analytics (Lakehouse)
[Step 13] ✓ Update cache (Redis)
[Step 14] ✓ Complete workflow

# Result
{
  "status": "completed",
  "transactionID": "txn_456",
  "amount": 10000,
  "currency": "USD"
}
```

### Example 2: Merchant Onboarding Journey

```bash
# Merchant submits application
POST /api/trpc/merchant.apply
{
  "businessName": "Acme Corp",
  "email": "merchant@acme.com",
  "website": "https://acme.com"
}

# Temporal Workflow Started
Workflow ID: merchant_onboarding_789
Run ID: xyz-uvw-rst

# Workflow Steps (15 total)
[Step 1] ✓ Send verification email (microservice)
[Step 2] ⏳ Waiting for email verification...
         (Workflow paused, waiting for signal)

# Merchant clicks verification link
Signal: email_verified = true

[Step 3] ✓ Upload KYC documents (microservice)
[Step 4] ✓ OCR processing (Python worker)
[Step 5] ✓ Compliance checks (Python worker)
[Step 6] ⏳ Waiting for manual review...
         (Workflow paused, waiting for admin approval)

# Admin approves application
Signal: application_approved = true

[Step 7] ✓ Create merchant account
[Step 8] ✓ Generate API credentials
[Step 9] ✓ Set permissions (Permify)
[Step 10] ✓ Create ledger accounts (TigerBeetle)
[Step 11] ✓ Send welcome email
[Step 12] ✓ Create integration environment
[Step 13] ✓ Publish event (Kafka)
[Step 14] ✓ Update analytics
[Step 15] ✓ Complete workflow

# Result
{
  "status": "approved",
  "merchantID": 123,
  "apiKey": "pk_live_...",
  "dashboardURL": "https://dashboard.payment-switch.com/merchant/123"
}
```

## Monitoring Workflows

### Temporal UI

Access workflow execution details:
```
http://localhost:8088
```

View:
- Workflow history
- Activity results
- Retry attempts
- Signals received
- Timers
- Child workflows

### Grafana Dashboards

Monitor workflow metrics:
```
http://localhost:3001
```

Metrics:
- Workflow success rate
- Average execution time
- Activity failures
- Retry counts
- Queue depth

## Testing User Journeys

### Integration Tests

```bash
# Test complete payment journey
cd orchestrator/test
go test -v ./integration/payment_journey_test.go

# Test merchant onboarding journey
go test -v ./integration/merchant_journey_test.go

# Test all user stories
go test -v ./integration/...
```

### Manual Testing

```bash
# Start all services
docker-compose up -d

# Trigger payment workflow
curl -X POST http://localhost:3000/api/trpc/payment.process \
  -H "Content-Type: application/json" \
  -d @test/fixtures/payment_request.json

# Check workflow status
temporal workflow describe \
  --workflow-id payment_sess_123

# Query workflow result
temporal workflow query \
  --workflow-id payment_sess_123 \
  --query-type getStatus
```

## Troubleshooting

### Workflow Stuck

```bash
# Check workflow history
temporal workflow show --workflow-id <id>

# Check activity status
temporal activity list --workflow-id <id>

# Send signal to unblock
temporal workflow signal \
  --workflow-id <id> \
  --name email_verified \
  --input '{"verified": true}'
```

### Microservice Unavailable

```bash
# Check service health
curl http://qr-service:8001/health
curl http://email-service:8004/health

# Restart service
docker-compose restart qr-service

# Check logs
docker-compose logs -f qr-service
```

### Activity Failure

```bash
# View activity error
temporal activity list --workflow-id <id>

# Retry activity manually
temporal workflow reset \
  --workflow-id <id> \
  --event-id <activity-scheduled-event-id>
```

## Performance Optimization

### Workflow Caching

```go
// Cache frequently accessed data
var cachedMerchantConfig MerchantConfig
if err := workflow.SideEffect(ctx, func(ctx workflow.Context) interface{} {
    return getMerchantConfig(merchantID)
}).Get(&cachedMerchantConfig); err != nil {
    return err
}
```

### Parallel Activities

```go
// Execute activities in parallel
var futures []workflow.Future

for _, item := range items {
    future := workflow.ExecuteActivity(ctx, "ProcessItem", item)
    futures = append(futures, future)
}

// Wait for all
for _, future := range futures {
    future.Get(ctx, nil)
}
```

### Activity Heartbeats

```go
// Long-running activity with heartbeats
func ProcessLargeFile(ctx context.Context, fileURL string) error {
    for i := 0; i < totalChunks; i++ {
        // Process chunk
        processChunk(i)
        
        // Send heartbeat
        activity.RecordHeartbeat(ctx, i)
    }
    return nil
}
```

## Conclusion

All 30 user stories are now integrated with Temporal workflows and microservices, providing end-to-end orchestrated journeys with:

- ✅ Reliable execution with automatic retries
- ✅ Distributed tracing and monitoring
- ✅ Scalable microservice architecture
- ✅ Event-driven communication
- ✅ Complete audit trail
- ✅ Real-time analytics
- ✅ Fault tolerance and compensation

The platform is production-ready with full orchestration capabilities.
