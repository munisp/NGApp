# Orchestration Architecture

## Overview

The Payment Switch platform uses **Temporal** as the orchestration engine to coordinate complex user journeys across multiple services and middleware components. This architecture ensures reliable, fault-tolerant execution of business workflows.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interfaces                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   Web    │  │  Mobile  │  │   API    │  │  Admin   │           │
│  │   App    │  │   App    │  │ Clients  │  │  Portal  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
└───────┼─────────────┼─────────────┼─────────────┼──────────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │       APISIX Gateway       │
        │   (API Gateway & Routing)  │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │      Temporal Server       │
        │   (Workflow Orchestrator)  │
        │                            │
        │  ┌──────────────────────┐  │
        │  │  Workflow Scheduler  │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │   Workflow Engine    │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │   Activity Workers   │  │
        │  └──────────────────────┘  │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │    Dapr Service Mesh       │
        │ (Service-to-Service Comm)  │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│   Go Workers     │      │  Python Workers  │
│                  │      │                  │
│ • Payment Proc   │      │ • ML Fraud Det   │
│ • Ledger Ops     │      │ • Analytics      │
│ • Notifications  │      │ • OCR Processing │
│ • Webhooks       │      │ • Report Gen     │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         └────────────┬────────────┘
                      │
        ┌─────────────▼─────────────┐
        │    Middleware Layer        │
        │                            │
        │  ┌──────────────────────┐  │
        │  │  Kafka (Events)      │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │  Redis (Cache)       │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │  Keycloak (Auth)     │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │  Permify (AuthZ)     │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │  TigerBeetle (Ledger)│  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │  Fluvio (Streaming)  │  │
        │  └──────────────────────┘  │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │     Data Layer             │
        │                            │
        │  ┌──────────────────────┐  │
        │  │  MySQL (OLTP)        │  │
        │  └──────────────────────┘  │
        │  ┌──────────────────────┐  │
        │  │  Lakehouse (OLAP)    │  │
        │  └──────────────────────┘  │
        └────────────────────────────┘
```

## Component Responsibilities

### 1. APISIX Gateway
**Purpose**: API Gateway and traffic management

**Responsibilities:**
- Route incoming requests to appropriate services
- Rate limiting and throttling
- Authentication and authorization
- Request/response transformation
- Load balancing
- Circuit breaking

**Integration:**
- Receives all external API requests
- Routes workflow initiation requests to Temporal
- Handles webhook callbacks
- Manages API versioning

### 2. Temporal Server
**Purpose**: Workflow orchestration and coordination

**Responsibilities:**
- Execute long-running workflows
- Maintain workflow state
- Handle failures and retries
- Schedule delayed activities
- Coordinate distributed transactions
- Provide workflow visibility

**Workflows:**
- Merchant onboarding
- Payment processing
- Refund handling
- Webhook delivery
- Compliance checks
- Notification delivery
- Settlement processing

### 3. Dapr Service Mesh
**Purpose**: Service-to-service communication

**Responsibilities:**
- Service discovery
- Pub/sub messaging
- State management
- Secret management
- Distributed tracing
- Observability

**Integration:**
- Connects Temporal workers to middleware
- Manages service-to-service calls
- Handles retries and timeouts
- Provides telemetry

### 4. Go Workers
**Purpose**: High-performance, low-latency operations

**Responsibilities:**
- Payment transaction processing
- TigerBeetle ledger operations
- Real-time webhook delivery
- Notification sending
- API request handling

**Activities:**
- `ProcessPayment`: Authorize and capture payments
- `RecordLedgerEntry`: Double-entry bookkeeping
- `SendWebhook`: HTTP webhook delivery
- `SendNotification`: Multi-channel notifications
- `ValidateFraudScore`: Rule-based fraud checks

### 5. Python Workers
**Purpose**: Data-intensive and ML operations

**Responsibilities:**
- Machine learning fraud detection
- OCR document processing
- Analytics and reporting
- Data transformation
- Batch processing

**Activities:**
- `DetectFraud`: ML-based fraud scoring
- `ProcessOCR`: Extract data from documents
- `GenerateReport`: Create analytics reports
- `TransformData`: ETL operations
- `TrainModel`: Update ML models

### 6. Middleware Components

#### Kafka
**Purpose**: Event streaming and pub/sub

**Use Cases:**
- Transaction events
- Payment status updates
- Webhook events
- Audit log streaming
- Analytics events

**Topics:**
- `payment.created`
- `payment.completed`
- `payment.failed`
- `refund.processed`
- `merchant.onboarded`
- `webhook.delivered`

#### Redis
**Purpose**: Caching and session management

**Use Cases:**
- API response caching
- Session storage
- Rate limiting counters
- Temporary data storage
- Distributed locks

**Data Structures:**
- `session:{userId}`: User session data
- `cache:api:{endpoint}`: API response cache
- `ratelimit:{apiKey}`: Rate limit counters
- `lock:{resource}`: Distributed locks

#### Keycloak
**Purpose**: Identity and access management

**Use Cases:**
- User authentication
- OAuth 2.0 / OIDC flows
- Single sign-on (SSO)
- User federation
- Identity brokering

**Integration:**
- Authenticate API requests
- Issue JWT tokens
- Manage user identities
- Handle social login

#### Permify
**Purpose**: Fine-grained authorization

**Use Cases:**
- Role-based access control (RBAC)
- Attribute-based access control (ABAC)
- Resource-level permissions
- API endpoint authorization
- Data access control

**Policies:**
- Merchant can view own transactions
- Admin can approve onboarding
- Developer can access sandbox only
- Customer can view own payment history

#### TigerBeetle
**Purpose**: High-performance ledger

**Use Cases:**
- Double-entry bookkeeping
- Account balances
- Transaction ledger
- Settlement calculations
- Financial reconciliation

**Accounts:**
- Merchant revenue accounts
- Platform fee accounts
- Settlement accounts
- Reserve accounts

#### Fluvio
**Purpose**: Real-time data streaming

**Use Cases:**
- Real-time analytics
- Event sourcing
- Change data capture (CDC)
- Stream processing
- Real-time dashboards

**Streams:**
- Transaction stream
- Payment method stream
- Fraud detection stream
- User activity stream

#### Lakehouse
**Purpose**: Unified analytics storage

**Use Cases:**
- Historical analytics
- Data warehousing
- Business intelligence
- Machine learning training
- Long-term data retention

**Tables:**
- `fact_transactions`
- `dim_merchants`
- `dim_customers`
- `fact_refunds`
- `fact_webhooks`

## Workflow Patterns

### 1. Saga Pattern
**Use Case**: Distributed transactions with compensating actions

**Example**: Payment Processing
```
1. Reserve funds → Compensate: Release funds
2. Validate fraud → Compensate: N/A
3. Authorize payment → Compensate: Void authorization
4. Capture payment → Compensate: Refund payment
5. Record ledger → Compensate: Reverse entry
6. Send webhook → Compensate: N/A
```

### 2. Event-Driven Pattern
**Use Case**: Asynchronous event processing

**Example**: Webhook Delivery
```
1. Payment completed → Emit event to Kafka
2. Kafka consumer → Trigger Temporal workflow
3. Workflow → Send webhook via Go worker
4. Worker → Retry on failure with exponential backoff
5. Success → Update webhook log
6. Failure → Send to dead letter queue
```

### 3. Orchestration Pattern
**Use Case**: Coordinating multiple services

**Example**: Merchant Onboarding
```
1. Submit application → Store in database
2. Verify email → Send verification email
3. Upload documents → OCR processing (Python)
4. Compliance check → Validate documents
5. Admin review → Manual approval
6. Generate credentials → Create API keys
7. Send welcome email → Notification service
8. Enable account → Update merchant status
```

### 4. Choreography Pattern
**Use Case**: Decentralized event-driven coordination

**Example**: Transaction Analytics
```
1. Payment completed → Emit to Kafka
2. Analytics service → Consume event
3. Transform data → Python worker
4. Store in Lakehouse → Analytics storage
5. Update dashboard → Real-time metrics
6. Trigger alerts → If thresholds exceeded
```

## Workflow Examples

### Payment Processing Workflow (Go)

```go
// workflows/payment_processing.go
package workflows

import (
    "time"
    "go.temporal.io/sdk/workflow"
)

type PaymentRequest struct {
    SessionID string
    Amount    int
    Currency  string
    Method    string
}

type PaymentResult struct {
    TransactionID string
    Status        string
    FraudScore    int
}

func PaymentProcessingWorkflow(ctx workflow.Context, req PaymentRequest) (*PaymentResult, error) {
    logger := workflow.GetLogger(ctx)
    logger.Info("Starting payment processing workflow", "sessionID", req.SessionID)
    
    // Step 1: Validate payment session
    var sessionValid bool
    err := workflow.ExecuteActivity(ctx, ValidatePaymentSession, req.SessionID).Get(ctx, &sessionValid)
    if err != nil || !sessionValid {
        return nil, err
    }
    
    // Step 2: Fraud detection (Python worker)
    var fraudScore int
    err = workflow.ExecuteActivity(ctx, DetectFraud, req).Get(ctx, &fraudScore)
    if err != nil {
        return nil, err
    }
    
    if fraudScore > 80 {
        // High fraud risk - decline
        workflow.ExecuteActivity(ctx, DeclinePayment, req.SessionID)
        return &PaymentResult{Status: "declined", FraudScore: fraudScore}, nil
    }
    
    // Step 3: Authorize payment
    var authResult AuthResult
    err = workflow.ExecuteActivity(ctx, AuthorizePayment, req).Get(ctx, &authResult)
    if err != nil {
        return nil, err
    }
    
    // Step 4: Capture payment
    var captureResult CaptureResult
    err = workflow.ExecuteActivity(ctx, CapturePayment, authResult.AuthID).Get(ctx, &captureResult)
    if err != nil {
        // Compensate: Void authorization
        workflow.ExecuteActivity(ctx, VoidAuthorization, authResult.AuthID)
        return nil, err
    }
    
    // Step 5: Record in ledger (TigerBeetle)
    err = workflow.ExecuteActivity(ctx, RecordLedgerEntry, captureResult)
    if err != nil {
        // Compensate: Refund payment
        workflow.ExecuteActivity(ctx, RefundPayment, captureResult.TransactionID)
        return nil, err
    }
    
    // Step 6: Send webhook notification
    workflow.ExecuteActivity(ctx, SendWebhook, WebhookPayload{
        Event: "payment.completed",
        Data:  captureResult,
    })
    
    // Step 7: Publish to Kafka
    workflow.ExecuteActivity(ctx, PublishToKafka, "payment.completed", captureResult)
    
    return &PaymentResult{
        TransactionID: captureResult.TransactionID,
        Status:        "completed",
        FraudScore:    fraudScore,
    }, nil
}
```

### Merchant Onboarding Workflow (Go)

```go
// workflows/merchant_onboarding.go
package workflows

import (
    "time"
    "go.temporal.io/sdk/workflow"
)

func MerchantOnboardingWorkflow(ctx workflow.Context, application Application) error {
    logger := workflow.GetLogger(ctx)
    
    // Step 1: Send email verification
    var emailVerified bool
    err := workflow.ExecuteActivity(ctx, SendVerificationEmail, application.Email).Get(ctx, nil)
    if err != nil {
        return err
    }
    
    // Wait for email verification (with timeout)
    selector := workflow.NewSelector(ctx)
    var verified bool
    
    workflow.Go(ctx, func(ctx workflow.Context) {
        workflow.Sleep(ctx, 24*time.Hour) // 24 hour timeout
    })
    
    err = workflow.GetSignalChannel(ctx, "email_verified").Receive(ctx, &verified)
    if err != nil || !verified {
        workflow.ExecuteActivity(ctx, RejectApplication, application.ID, "Email not verified")
        return err
    }
    
    // Step 2: OCR document processing (Python worker)
    var ocrResult OCRResult
    err = workflow.ExecuteActivity(ctx, ProcessDocuments, application.Documents).Get(ctx, &ocrResult)
    if err != nil {
        return err
    }
    
    // Step 3: Compliance check
    var complianceResult ComplianceResult
    err = workflow.ExecuteActivity(ctx, CheckCompliance, ocrResult).Get(ctx, &complianceResult)
    if err != nil {
        return err
    }
    
    if !complianceResult.Passed {
        workflow.ExecuteActivity(ctx, RejectApplication, application.ID, complianceResult.Reason)
        return nil
    }
    
    // Step 4: Wait for admin approval
    var approved bool
    err = workflow.GetSignalChannel(ctx, "admin_approval").Receive(ctx, &approved)
    if err != nil || !approved {
        workflow.ExecuteActivity(ctx, RejectApplication, application.ID, "Admin rejected")
        return nil
    }
    
    // Step 5: Generate API credentials
    var credentials APICredentials
    err = workflow.ExecuteActivity(ctx, GenerateAPICredentials, application.ID).Get(ctx, &credentials)
    if err != nil {
        return err
    }
    
    // Step 6: Create merchant account
    err = workflow.ExecuteActivity(ctx, CreateMerchantAccount, application, credentials)
    if err != nil {
        return err
    }
    
    // Step 7: Send welcome email
    workflow.ExecuteActivity(ctx, SendWelcomeEmail, application.Email, credentials)
    
    // Step 8: Publish event
    workflow.ExecuteActivity(ctx, PublishToKafka, "merchant.onboarded", application)
    
    return nil
}
```

## Data Flow

### Payment Transaction Flow

```
1. Customer submits payment
   ↓
2. APISIX receives request
   ↓
3. Keycloak validates merchant API key
   ↓
4. Permify checks merchant permissions
   ↓
5. APISIX routes to Temporal
   ↓
6. Temporal starts PaymentProcessingWorkflow
   ↓
7. Go worker validates session (MySQL)
   ↓
8. Python worker detects fraud (ML model)
   ↓
9. Go worker authorizes payment (Payment Gateway API)
   ↓
10. Go worker captures payment
   ↓
11. Go worker records in TigerBeetle ledger
   ↓
12. Go worker publishes to Kafka
   ↓
13. Go worker sends webhook (via Dapr)
   ↓
14. Fluvio streams to analytics
   ↓
15. Python worker transforms data
   ↓
16. Data stored in Lakehouse
   ↓
17. Redis caches transaction
   ↓
18. Workflow completes
```

## Error Handling

### Retry Strategies

**Transient Errors** (network, timeout):
- Exponential backoff
- Max 5 retries
- 1s, 2s, 4s, 8s, 16s intervals

**Permanent Errors** (invalid data, auth failure):
- No retry
- Immediate failure
- Compensating action

**Timeout Errors**:
- Custom timeout per activity
- Payment authorization: 30s
- Fraud detection: 10s
- Webhook delivery: 5s

### Compensation

**Failed Payment**:
1. Void authorization
2. Release reserved funds
3. Update transaction status
4. Send failure webhook
5. Notify customer

**Failed Onboarding**:
1. Delete partial merchant record
2. Revoke API credentials
3. Send rejection email
4. Log rejection reason

## Monitoring & Observability

### Metrics
- Workflow execution time
- Activity success/failure rates
- Retry counts
- Queue depths
- Worker utilization

### Tracing
- Distributed tracing with OpenTelemetry
- Trace workflows across services
- Visualize workflow execution
- Identify bottlenecks

### Logging
- Structured logging (JSON)
- Correlation IDs
- Workflow execution logs
- Activity execution logs
- Error logs with stack traces

### Alerting
- Workflow failures
- High retry rates
- Long-running workflows
- Worker health issues
- Queue backlog

## Deployment

### Docker Compose (Development)
```yaml
services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
  
  temporal-ui:
    image: temporalio/ui:latest
    ports:
      - "8080:8080"
  
  go-worker:
    build: ./orchestrator/workers/go
    depends_on:
      - temporal
  
  python-worker:
    build: ./orchestrator/workers/python
    depends_on:
      - temporal
```

### Kubernetes (Production)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: temporal-worker-go
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: worker
        image: payment-switch/temporal-worker-go:latest
        env:
        - name: TEMPORAL_HOST
          value: "temporal.default.svc.cluster.local:7233"
```

## Security

### Authentication
- Keycloak for user authentication
- mTLS for service-to-service
- API keys for external clients

### Authorization
- Permify for fine-grained access control
- Role-based permissions
- Resource-level policies

### Encryption
- TLS for all network traffic
- Encryption at rest for sensitive data
- Secret management via Dapr

### Audit
- All workflow executions logged
- Activity execution history
- Permission checks logged
- Compliance audit trail

## Scalability

### Horizontal Scaling
- Scale workers independently
- Auto-scaling based on queue depth
- Load balancing across workers

### Vertical Scaling
- Increase worker resources
- Optimize activity performance
- Batch processing for efficiency

### Performance Optimization
- Cache frequently accessed data (Redis)
- Async processing where possible
- Batch operations
- Connection pooling

## Next Steps

1. Set up Temporal server
2. Implement Go workers
3. Implement Python workers
4. Configure middleware
5. Deploy to development
6. Test workflows end-to-end
7. Monitor and optimize
8. Deploy to production
