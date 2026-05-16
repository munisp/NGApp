# PolicyIssuanceWorkflow - Complete Go Implementation

**Complete Go implementation of the PolicyIssuanceWorkflow that the Python Dapr webhook service initiates.**

This is the **full, production-ready workflow** that orchestrates policy issuance with TigerBeetle integration, Temporal workflow engine, and comprehensive error handling with Saga pattern compensations.

## Overview

This workflow is initiated by the **Python Dapr Webhook Service** when a policy issuance request is received. It coordinates all steps required to issue an insurance policy, from NIN verification to payment processing to document generation.

## Architecture

```
Python Webhook Service → Temporal Server → Go Worker → PolicyIssuanceWorkflow
                                                             │
                                                             ├─ VerifyCustomerNINActivity
                                                             ├─ CalculateRiskAndPremiumActivity
                                                             ├─ CreatePolicyRecordActivity
                                                             ├─ ProcessPremiumPaymentActivity ◄── TigerBeetle
                                                             ├─ GeneratePolicyDocumentActivity
                                                             ├─ IssuePolicyActivity
                                                             ├─ SendPolicyNotificationsActivity
                                                             └─ SchedulePremiumRemindersActivity
```

## Workflow Steps

The `PolicyIssuanceWorkflow` executes **8 steps** in sequence:

### 1. **Verify Customer NIN** ✅
- Calls `VerifyCustomerNINActivity`
- Validates customer identity via NIN verification service
- **Non-retryable** if verification fails
- **Compensation**: None needed

### 2. **Calculate Risk and Premium** ✅
- Calls `CalculateRiskAndPremiumActivity`
- Calculates risk score and premium amount based on policy type
- Uses underwriting rules and actuarial models
- **Compensation**: None needed

### 3. **Create Policy Record** ✅
- Calls `CreatePolicyRecordActivity`
- Creates policy record in PostgreSQL with status `PENDING`
- Generates unique policy ID
- **Compensation**: `DeletePolicyRecordActivity` - Delete policy record

### 4. **Process Premium Payment** ✅ **[CRITICAL]**
- Calls `ProcessPremiumPaymentActivity`
- Processes payment via **TigerBeetle** distributed ledger
- Creates atomic transfer from customer account to insurance company account
- **Three scenarios handled:**
  - ✅ **Success**: Payment completed → Continue
  - ❌ **Business Failure**: Insufficient funds → Compensate → Return failed result
  - ⚠️ **Technical Failure**: TigerBeetle down → Compensate → Return error
- **Compensation**: `ProcessRefundActivity` - Refund customer via TigerBeetle

### 5. **Generate Policy Document** ✅
- Calls `GeneratePolicyDocumentActivity`
- Generates PDF policy document
- Uploads to storage (S3-compatible)
- **Compensation**: `DeletePolicyDocumentActivity` - Delete PDF from storage

### 6. **Issue Policy** ✅
- Calls `IssuePolicyActivity`
- Updates policy status from `PENDING` to `ACTIVE`
- Policy is now effective
- **Compensation**: `CancelPolicyActivity` - Update status to `CANCELLED`

### 7. **Send Notifications** ⚠️ **[Non-Critical]**
- Calls `SendPolicyNotificationsActivity`
- Sends SMS, email, and push notifications
- **Failure is logged but workflow continues**

### 8. **Schedule Premium Reminders** ⚠️ **[Non-Critical]**
- Calls `SchedulePremiumRemindersActivity`
- Schedules future premium payment reminders
- **Failure is logged but workflow continues**

## Payment Processing - Three Scenarios

### Scenario 1: Payment Success ✅

```go
var paymentResult models.PaymentResult
err = workflow.ExecuteActivity(ctx, "ProcessPremiumPaymentActivity", paymentRequest).
    Get(ctx, &paymentResult)

if err == nil && paymentResult.Status == models.PaymentStatusCompleted {
    // SUCCESS - Continue to next step
    workflowState.CompletedSteps = append(workflowState.CompletedSteps, "PAYMENT_COMPLETED")
    workflowState.PaymentResult = &paymentResult
    // Proceed to document generation...
}
```

### Scenario 2: Payment Failed (Business Logic) ❌

```go
if paymentResult.Status != models.PaymentStatusCompleted {
    // BUSINESS FAILURE (e.g., insufficient funds)
    logger.Error("Payment processing failed",
        "status", paymentResult.Status,
        "reason", paymentResult.FailureReason)
    
    // Execute compensations
    executeCompensations(ctx, &workflowState)
    
    // Return failed result (NOT an error)
    return &PolicyIssuanceResult{
        Success:       false,
        PolicyID:      policyID,
        FailureReason: fmt.Sprintf("Payment failed: %s", paymentResult.FailureReason),
        FailureStep:   "PAYMENT_PROCESSING",
    }, nil
}
```

### Scenario 3: Payment Activity Error (Technical Failure) ⚠️

```go
err = workflow.ExecuteActivity(ctx, "ProcessPremiumPaymentActivity", paymentRequest).
    Get(ctx, &paymentResult)

if err != nil {
    // TECHNICAL FAILURE (TigerBeetle down, network error, etc.)
    logger.Error("Payment processing activity failed with error", "error", err)
    
    // Execute compensations
    executeCompensations(ctx, &workflowState)
    
    // Return error
    return nil, err
}
```

## Saga Pattern Compensation

When any step fails after payment, **compensating actions** are executed in **reverse order**:

```
Execution Order:     NIN → Premium → Policy → Payment → Document → Issue
                                                  ↑ FAILS HERE
Compensation Order:                   Issue → Document → Payment → Policy
```

### Compensation Logic

```go
func executeCompensations(ctx workflow.Context, state *PolicyIssuanceState) {
    // Execute in REVERSE order
    for i := len(state.CompletedSteps) - 1; i >= 0; i-- {
        step := state.CompletedSteps[i]
        
        switch step {
        case "POLICY_ISSUED":
            // Cancel policy (update status to CANCELLED)
            workflow.ExecuteActivity(ctx, "CancelPolicyActivity", state.PolicyID)
            
        case "DOCUMENT_GENERATED":
            // Delete policy document from storage
            workflow.ExecuteActivity(ctx, "DeletePolicyDocumentActivity", state.PolicyID)
            
        case "PAYMENT_COMPLETED":
            // REFUND THE CUSTOMER via TigerBeetle
            refundRequest := models.RefundRequest{
                PaymentID: state.PaymentResult.PaymentID,
                Amount:    state.PremiumDetails.Amount,
                Reason:    "Policy issuance failed - automatic refund",
            }
            workflow.ExecuteActivity(ctx, "ProcessRefundActivity", refundRequest)
            
        case "POLICY_CREATED":
            // Delete policy record from database
            workflow.ExecuteActivity(ctx, "DeletePolicyRecordActivity", state.PolicyID)
        }
    }
}
```

## Complete File Structure

```
policy-workflow-go/
├── workflows/
│   ├── policy_issuance_workflow.go      # Main workflow (350 lines)
│   ├── activities.go                     # All activities (500 lines)
│   ├── compensating_activities.go        # Saga compensations (150 lines)
│   ├── policy_issuance_workflow_test.go # Tests (500 lines)
│   └── README.md                         # Workflow documentation
├── ledger/
│   ├── tigerbeetle_client.go            # TigerBeetle client (650 lines)
│   └── tigerbeetle_client_test.go       # Tests (300 lines)
├── service/
│   ├── payment_service.go               # Payment service (400 lines)
│   └── payment_service_test.go          # Tests (500 lines)
├── models/
│   └── models.go                        # All data models (200 lines)
├── repository/
│   └── payment_repository.go            # Database repository (300 lines)
├── cmd/worker/
│   └── main.go                          # Worker startup (250 lines)
├── examples/
│   └── start_workflow.go                # Client examples (200 lines)
├── go.mod                               # Go dependencies
├── schema.sql                           # Database schema
├── QUICKSTART.md                        # Quick start guide
└── README_COMPLETE.md                   # This file
```

**Total: 4,300+ lines of production Go code**

## Key Components

### 1. PolicyIssuanceWorkflow (workflows/policy_issuance_workflow.go)

**Main workflow function:**
```go
func PolicyIssuanceWorkflow(ctx workflow.Context, input PolicyIssuanceInput) (*PolicyIssuanceResult, error)
```

**Input:**
```go
type PolicyIssuanceInput struct {
    CustomerID       string
    PolicyType       string
    SumAssured       float64
    PremiumFrequency string
    DurationMonths   int
    StartDate        time.Time
    PaymentMethod    string
}
```

**Output:**
```go
type PolicyIssuanceResult struct {
    Success         bool
    PolicyID        string
    PolicyNumber    string
    TransactionID   string
    PaymentID       int
    DocumentURL     string
    Premium         float64
    RiskScore       float64
    CompletedSteps  []string
    CompletedAt     time.Time
    FailureReason   string
    FailureStep     string
}
```

### 2. Activities (workflows/activities.go)

All activities are implemented in the `Activities` struct:

```go
type Activities struct {
    PaymentService      *service.PaymentService
    VerificationService *service.VerificationService
    DocumentService     *service.DocumentService
    NotificationService *service.NotificationService
    PolicyRepository    *repository.PolicyRepository
}
```

**Activity Methods:**
- `VerifyCustomerNINActivity(ctx context.Context, customerID string) (*models.VerificationResult, error)`
- `CalculateRiskAndPremiumActivity(ctx context.Context, policy models.Policy) (*models.PremiumDetails, error)`
- `CreatePolicyRecordActivity(ctx context.Context, policy models.Policy) (string, error)`
- `ProcessPremiumPaymentActivity(ctx context.Context, req models.PaymentRequest) (*models.PaymentResult, error)`
- `GeneratePolicyDocumentActivity(ctx context.Context, policyID string) (string, error)`
- `IssuePolicyActivity(ctx context.Context, policyID string) error`
- `SendPolicyNotificationsActivity(ctx context.Context, req models.NotificationRequest) error`
- `SchedulePremiumRemindersActivity(ctx context.Context, policyID string) error`

### 3. Compensating Activities (workflows/compensating_activities.go)

**Compensation Methods:**
- `CancelPolicyActivity(ctx context.Context, policyID string) error`
- `DeletePolicyDocumentActivity(ctx context.Context, policyID string) error`
- `ProcessRefundActivity(ctx context.Context, req models.RefundRequest) error`
- `DeletePolicyRecordActivity(ctx context.Context, policyID string) error`

### 4. TigerBeetle Client (ledger/tigerbeetle_client.go)

**Complete TigerBeetle integration:**
- `CreateAccount(accountID uint128, ledger uint32, code uint16) error`
- `CreateTransfer(transferID uint128, debitAccountID, creditAccountID uint128, amount uint64) error`
- `GetAccountBalance(accountID uint128) (uint64, error)`
- `LookupAccounts(accountIDs []uint128) ([]tigerbeetle.Account, error)`
- `LookupTransfers(transferIDs []uint128) ([]tigerbeetle.Transfer, error)`

### 5. Payment Service (service/payment_service.go)

**Payment processing with TigerBeetle:**
- `ProcessPremiumPayment(ctx context.Context, req models.PaymentRequest) (*models.PaymentResponse, error)`
- `ProcessRefund(ctx context.Context, req models.RefundRequest) (*models.RefundResponse, error)`
- `ProcessCommissionPayment(ctx context.Context, req models.CommissionPaymentRequest) (*models.PaymentResponse, error)`
- `GetPaymentStatus(ctx context.Context, paymentID int) (*models.PaymentStatusResponse, error)`

### 6. Worker (cmd/worker/main.go)

**Temporal worker that registers workflow and activities:**

```go
func main() {
    // Connect to Temporal
    c, err := client.Dial(client.Options{
        HostPort: temporalAddress,
    })
    
    // Create worker
    w := worker.New(c, "policy-task-queue", worker.Options{})
    
    // Register workflow
    w.RegisterWorkflow(workflows.PolicyIssuanceWorkflow)
    
    // Register activities
    activities := &workflows.Activities{
        PaymentService:      paymentService,
        VerificationService: verificationService,
        // ... other services
    }
    
    w.RegisterActivity(activities.VerifyCustomerNINActivity)
    w.RegisterActivity(activities.ProcessPremiumPaymentActivity)
    // ... all activities
    
    // Register compensating activities
    w.RegisterActivity(activities.CancelPolicyActivity)
    w.RegisterActivity(activities.ProcessRefundActivity)
    // ... all compensations
    
    // Start worker
    w.Run(worker.InterruptCh())
}
```

## Integration with Python Webhook Service

### Python Service Starts Workflow

```python
# Python Dapr Webhook Service
workflow_input = {
    "customer_id": "12345678901",
    "policy_type": "LIFE",
    "sum_assured": 1000000.0,
    "premium_frequency": "MONTHLY",
    "duration_months": 12,
    "start_date": "2026-01-28T10:00:00Z",
    "payment_method": "CARD",
}

handle = await temporal_client.start_workflow(
    "PolicyIssuanceWorkflow",  # Go workflow name
    workflow_input,
    id="policy-issuance-12345678901-1706437200",
    task_queue="policy-task-queue",  # Must match Go worker
)
```

### Go Worker Executes Workflow

```go
// Go Worker picks up workflow from task queue
func PolicyIssuanceWorkflow(ctx workflow.Context, input PolicyIssuanceInput) (*PolicyIssuanceResult, error) {
    // Execute all 8 steps...
    // Handle payment with 3 scenarios...
    // Execute compensations if needed...
    return result, nil
}
```

## Running the Complete System

### 1. Start Infrastructure

```bash
# TigerBeetle
docker run -p 3000:3000 ghcr.io/tigerbeetle/tigerbeetle:latest

# PostgreSQL
docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14

# Temporal
docker run -p 7233:7233 -p 8080:8080 temporalio/auto-setup:latest

# Kafka
docker-compose up kafka

# Redis
docker run -p 6379:6379 redis:7

# Dapr
dapr init
```

### 2. Start Go Worker

```bash
cd policy-workflow-go

# Set environment variables
export TIGERBEETLE_ADDRESSES=localhost:3000
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/insurance_db
export TEMPORAL_SERVICE_URL=localhost:7233
export TEMPORAL_TASK_QUEUE=policy-task-queue

# Run worker
go run cmd/worker/main.go
```

### 3. Start Python Webhook Service

```bash
cd policy-webhook-service

# Start Dapr sidecar
dapr run --app-id policy-webhook-service \
         --app-port 8000 \
         --components-path ./dapr

# Run service
python -m app.main
```

### 4. Send Webhook Request

```bash
curl -X POST http://localhost:8000/api/v1/webhooks/policy-issuance \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "12345678901",
    "policy_type": "LIFE",
    "sum_assured": 1000000.0,
    "premium_frequency": "MONTHLY",
    "duration_months": 12,
    "payment_method": "CARD"
  }'
```

### 5. Monitor Workflow

```bash
# Temporal UI
open http://localhost:8080

# Check workflow status via Python service
curl -X POST http://localhost:8000/api/v1/webhooks/policy-issuance/status \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "policy-issuance-12345678901-1706437200"}'
```

## Testing

### Run Go Tests

```bash
# All tests
go test ./... -v

# Workflow tests
go test ./workflows -v

# Payment service tests
go test ./service -v

# TigerBeetle client tests
go test ./ledger -v

# With coverage
go test ./... -cover
```

### Test Scenarios

1. ✅ **Success Path** - All steps complete
2. ❌ **Payment Failed** - Insufficient funds → Compensations
3. ⚠️ **Payment Activity Error** - TigerBeetle down → Compensations
4. ❌ **Document Generation Failed** - Refund triggered
5. ❌ **NIN Verification Failed** - Early termination
6. ⚠️ **Notification Failure** - Non-critical, continues
7. 🔄 **Full Compensation Flow** - All compensations executed

## Production Considerations

### 1. **Idempotency**
- All activities are idempotent
- TigerBeetle transfers use deterministic IDs
- Safe to retry any activity

### 2. **Error Handling**
- Automatic retries with exponential backoff
- Non-retryable errors for business failures
- Comprehensive logging

### 3. **Monitoring**
- Temporal UI for workflow visibility
- Structured logging for debugging
- Metrics for payment success/failure rates

### 4. **Scalability**
- Run multiple workers for high throughput
- TigerBeetle cluster for high availability
- PostgreSQL connection pooling

### 5. **Security**
- TLS for Temporal connections
- Encrypted database connections
- Secrets management via environment variables

## Key Features

✅ **Complete Workflow Implementation** - All 8 steps fully implemented  
✅ **Saga Pattern** - Compensating actions for distributed transactions  
✅ **TigerBeetle Integration** - Atomic financial transactions  
✅ **Payment Handling** - 3 scenarios (success, business failure, technical failure)  
✅ **Automatic Refunds** - Via TigerBeetle when workflow fails  
✅ **Comprehensive Error Handling** - Retries, timeouts, non-retryable errors  
✅ **Production-Ready** - Logging, monitoring, testing, deployment configs  
✅ **Python Integration** - Works seamlessly with Python Dapr webhook service  

## License

Copyright © 2026 Insurance Platform. All rights reserved.
