# Orchestration Architecture Design

**Date:** November 12, 2025  
**Purpose:** Design document for Temporal-based orchestration layer

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Presentation Layer                       │
│  React UI (Port 3000) + Mobile App + API Clients               │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  APISIX (Port 9080) - Routing, Auth, Rate Limiting             │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                   Orchestration Layer (NEW)                      │
│  Temporal Server (Port 7233) + Workers (Go + Python)           │
│  - Workflow Definitions (Go)                                    │
│  - Activity Implementations (Python + Go)                       │
│  - State Management                                             │
│  - Retry Logic                                                  │
└─────┬──────────────────────────────────────────────────────┬────┘
      │                                                       │
┌─────▼──────────────────┐                    ┌──────────────▼─────┐
│   Event Streaming      │                    │   State & Cache    │
│  Kafka (Port 9092)     │                    │  Redis (Port 6379) │
│  - Document events     │                    │  - Session state   │
│  - Audit events        │                    │  - Workflow cache  │
│  - Sync events         │                    │  - Metrics         │
└─────┬──────────────────┘                    └──────────────┬─────┘
      │                                                       │
┌─────▼───────────────────────────────────────────────────────▼────┐
│                      Business Logic Layer                         │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ OCR Service  │  │ API Gateway │  │ Ingestion Framework  │   │
│  │ (Port 8001)  │  │ (Port 8002) │  │                      │   │
│  │ - EasyOCR    │  │ - Lakehouse │  │ - SFTP Connector     │   │
│  │ - Tesseract  │  │ - Analytics │  │ - File Parser        │   │
│  │ - Ensemble   │  │ - Spark     │  │ - Pipeline Engine    │   │
│  └──────────────┘  └─────────────┘  └──────────────────────┘   │
└────────────────────────────────┬──────────────────────────────────┘
                                 │
┌────────────────────────────────▼──────────────────────────────────┐
│                         Data Layer                                │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Delta Lake   │  │ MySQL/TiDB  │  │ S3 Storage           │   │
│  │ (Lakehouse)  │  │ (Metadata)  │  │ (Files)              │   │
│  └──────────────┘  └─────────────┘  └──────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                    Cross-Cutting Concerns                          │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ Keycloak     │  │ Permify     │  │ TigerBeetle          │   │
│  │ (Identity)   │  │ (AuthZ)     │  │ (Ledger)             │   │
│  │ Port 8080    │  │ Port 3476   │  │ Port 3000            │   │
│  └──────────────┘  └─────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌─────────────┐                             │
│  │ Dapr         │  │ Prometheus  │                             │
│  │ (Runtime)    │  │ (Monitoring)│                             │
│  │ Port 3500    │  │ Port 9090   │                             │
│  └──────────────┘  └─────────────┘                             │
└───────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Temporal Server

**Purpose:** Workflow orchestration and state management

**Components:**
- **Temporal Server** - Core workflow engine
- **Temporal Web UI** - Workflow visualization (Port 8088)
- **PostgreSQL** - Temporal metadata store

**Deployment:**
```bash
# Using Docker Compose
docker-compose -f temporal-docker-compose.yml up -d
```

**Configuration:**
```yaml
temporal:
  server:
    port: 7233
    metrics_port: 9090
  frontend:
    port: 7233
  history:
    num_shards: 4
  persistence:
    default_store: postgres
    visibility_store: postgres
```

### 2. Temporal Workers

**Go Workers** (for workflows):
- Document Processing Worker
- Batch Processing Worker
- Routing Worker
- Sync Worker
- Monitoring Worker

**Python Workers** (for activities):
- OCR Activity Worker
- Lakehouse Activity Worker
- Analytics Activity Worker
- Ingestion Activity Worker

**Deployment:**
```bash
# Go workers
cd /home/ubuntu/orchestration/workers/go
go run main.go

# Python workers
cd /home/ubuntu/orchestration/workers/python
python main.py
```

### 3. Kafka Cluster

**Purpose:** Event streaming and async communication

**Components:**
- **Zookeeper** (Port 2181) - Coordination
- **Kafka Broker** (Port 9092) - Message broker
- **Kafka UI** (Port 8080) - Management UI

**Topics:**
```
document.uploaded
document.ocr.started
document.ocr.completed
document.validated
document.stored
document.processed
batch.started
batch.completed
audit.document.created
audit.document.viewed
sync.document.created
alert.quality.low
```

### 4. Redis

**Purpose:** Caching, session state, metrics

**Deployment:**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

**Key Patterns:**
```
session:{user_id}
batch:{batch_id}:progress
metrics:ocr:confidence:avg
cache:report:weekly:{week}
workflow:{workflow_id}:state
```

### 5. APISIX

**Purpose:** Production API gateway

**Features:**
- Request routing
- Authentication (JWT)
- Rate limiting
- Load balancing
- Circuit breaking

**Routes:**
```yaml
/api/ocr/* → OCR Service (8001)
/api/lakehouse/* → API Gateway (8002)
/api/workflows/* → Temporal (7233)
/api/auth/* → Keycloak (8080)
```

### 6. Keycloak

**Purpose:** Identity and access management

**Features:**
- OAuth 2.0 / OIDC
- User federation
- SSO
- Role management

**Realms:**
- `document-intelligence` - Main realm

**Clients:**
- `web-ui` - React application
- `mobile-app` - Mobile client
- `api-gateway` - Backend service

### 7. Permify

**Purpose:** Fine-grained authorization

**Schema:**
```yaml
entity user {}

entity document {
  relation viewer @user
  relation editor @user
  relation admin @user
  relation owner @user
  
  action view = viewer or editor or admin or owner
  action edit = editor or admin or owner
  action delete = admin or owner
  action share = owner
}

entity department {
  relation member @user
  relation manager @user
  
  action view_documents = member or manager
  action assign_documents = manager
}
```

### 8. TigerBeetle

**Purpose:** Financial ledger and audit trail

**Accounts:**
```go
// Document operations ledger
type DocumentAuditAccount struct {
    ID     uint128  // Account ID
    Ledger uint32   // Ledger ID (1 = audit)
    Code   uint16   // Operation type
}
```

**Transfers:**
```go
// Each document operation = transfer
type AuditTransfer struct {
    ID              uint128
    DebitAccountID  uint128  // Source
    CreditAccountID uint128  // Destination
    Amount          uint64   // Timestamp or count
    Ledger          uint32
    Code            uint16   // Operation code
}
```

### 9. Dapr

**Purpose:** Distributed application runtime

**Components:**
- State management (Redis backend)
- Pub/sub (Kafka backend)
- Service invocation
- Bindings

**Configuration:**
```yaml
# state-store.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore
spec:
  type: state.redis
  metadata:
  - name: redisHost
    value: localhost:6379

# pubsub.yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
spec:
  type: pubsub.kafka
  metadata:
  - name: brokers
    value: localhost:9092
```

---

## Workflow Patterns

### Pattern 1: Simple Sequential Workflow

```go
func DocumentProcessingWorkflow(ctx workflow.Context, doc DocumentInput) error {
    ao := workflow.ActivityOptions{
        StartToCloseTimeout: 10 * time.Minute,
        RetryPolicy: &temporal.RetryPolicy{
            MaximumAttempts: 3,
        },
    }
    ctx = workflow.WithActivityOptions(ctx, ao)
    
    // Activity 1: Upload to S3
    var uploadResult UploadResult
    err := workflow.ExecuteActivity(ctx, UploadToS3, doc).Get(ctx, &uploadResult)
    if err != nil {
        return err
    }
    
    // Activity 2: OCR Processing
    var ocrResult OCRResult
    err = workflow.ExecuteActivity(ctx, ProcessOCR, uploadResult.URL).Get(ctx, &ocrResult)
    if err != nil {
        return err
    }
    
    // Activity 3: Validate
    var validationResult ValidationResult
    err = workflow.ExecuteActivity(ctx, ValidateOCR, ocrResult).Get(ctx, &validationResult)
    if err != nil {
        return err
    }
    
    // Activity 4: Store in Lakehouse
    err = workflow.ExecuteActivity(ctx, StoreInLakehouse, validationResult).Get(ctx, nil)
    if err != nil {
        return err
    }
    
    return nil
}
```

### Pattern 2: Parallel Execution

```go
func BatchProcessingWorkflow(ctx workflow.Context, batch BatchInput) error {
    // Create child workflows in parallel
    childWorkflows := make([]workflow.Future, len(batch.Documents))
    
    for i, doc := range batch.Documents {
        childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
            WorkflowID: fmt.Sprintf("doc-process-%s", doc.ID),
        })
        childWorkflows[i] = workflow.ExecuteChildWorkflow(childCtx, DocumentProcessingWorkflow, doc)
    }
    
    // Wait for all to complete
    for _, future := range childWorkflows {
        err := future.Get(ctx, nil)
        if err != nil {
            // Handle error
        }
    }
    
    return nil
}
```

### Pattern 3: Human-in-the-Loop

```go
func DocumentReviewWorkflow(ctx workflow.Context, doc DocumentInput) error {
    // Process document
    var ocrResult OCRResult
    err := workflow.ExecuteActivity(ctx, ProcessOCR, doc).Get(ctx, &ocrResult)
    if err != nil {
        return err
    }
    
    // Check confidence
    if ocrResult.Confidence < 0.9 {
        // Wait for human review (with timeout)
        var reviewResult ReviewResult
        selector := workflow.NewSelector(ctx)
        
        // Signal channel for human decision
        reviewChannel := workflow.GetSignalChannel(ctx, "review-decision")
        selector.AddReceive(reviewChannel, func(c workflow.ReceiveChannel, more bool) {
            c.Receive(ctx, &reviewResult)
        })
        
        // Timeout after 24 hours
        timer := workflow.NewTimer(ctx, 24*time.Hour)
        selector.AddFuture(timer, func(f workflow.Future) {
            reviewResult.Decision = "timeout"
        })
        
        selector.Select(ctx)
        
        if reviewResult.Decision == "reject" {
            // Retry with different OCR engine
            return workflow.ExecuteActivity(ctx, ProcessOCRWithDifferentEngine, doc).Get(ctx, &ocrResult)
        }
    }
    
    // Continue normal flow
    return workflow.ExecuteActivity(ctx, StoreInLakehouse, ocrResult).Get(ctx, nil)
}
```

### Pattern 4: Saga Pattern (Compensation)

```go
func DocumentProcessingWithCompensationWorkflow(ctx workflow.Context, doc DocumentInput) error {
    // Track completed steps for compensation
    var completedSteps []string
    
    defer func() {
        if r := recover(); r != nil {
            // Compensate completed steps in reverse order
            for i := len(completedSteps) - 1; i >= 0; i-- {
                workflow.ExecuteActivity(ctx, CompensateStep, completedSteps[i])
            }
        }
    }()
    
    // Step 1: Upload
    err := workflow.ExecuteActivity(ctx, UploadToS3, doc).Get(ctx, nil)
    if err != nil {
        return err
    }
    completedSteps = append(completedSteps, "upload")
    
    // Step 2: OCR
    err = workflow.ExecuteActivity(ctx, ProcessOCR, doc).Get(ctx, nil)
    if err != nil {
        panic(err) // Trigger compensation
    }
    completedSteps = append(completedSteps, "ocr")
    
    // Step 3: Store
    err = workflow.ExecuteActivity(ctx, StoreInLakehouse, doc).Get(ctx, nil)
    if err != nil {
        panic(err)
    }
    completedSteps = append(completedSteps, "store")
    
    return nil
}
```

### Pattern 5: Scheduled Workflow

```go
func ScheduledIngestionWorkflow(ctx workflow.Context, config IngestionConfig) error {
    // This workflow is triggered by cron schedule
    // Cron: "0 2 * * *" (daily at 2 AM)
    
    // Activity 1: Connect to SFTP
    var files []string
    err := workflow.ExecuteActivity(ctx, ListSFTPFiles, config).Get(ctx, &files)
    if err != nil {
        return err
    }
    
    // Activity 2: Process each file
    for _, file := range files {
        var doc DocumentInput
        err = workflow.ExecuteActivity(ctx, DownloadFile, file).Get(ctx, &doc)
        if err != nil {
            continue // Skip failed files
        }
        
        // Trigger document processing workflow
        workflow.ExecuteChildWorkflow(ctx, DocumentProcessingWorkflow, doc)
    }
    
    return nil
}
```

---

## Activity Implementations

### Python Activities (OCR, Lakehouse)

```python
# /home/ubuntu/orchestration/workers/python/activities/ocr_activities.py

from temporalio import activity
import sys
sys.path.append('/home/ubuntu/document_intelligence_platform')
from ocr_pipeline.ensemble_ocr import EnsembleOCR

@activity.defn
async def process_ocr(document_url: str) -> dict:
    """Process document through OCR ensemble."""
    ocr = EnsembleOCR()
    result = await ocr.process_document(document_url)
    return {
        'text': result.text,
        'confidence': result.confidence,
        'metadata': result.metadata
    }

@activity.defn
async def store_in_lakehouse(data: dict) -> None:
    """Store processed data in Delta Lake."""
    from lakehouse import DeltaLakeManager
    delta = DeltaLakeManager()
    delta.write_table('bronze_documents', data)
```

### Go Activities (Routing, Notifications)

```go
// /home/ubuntu/orchestration/workers/go/activities/routing.go

package activities

import (
    "context"
    "go.temporal.io/sdk/activity"
)

func RouteDocument(ctx context.Context, doc Document) (string, error) {
    logger := activity.GetLogger(ctx)
    
    // Load routing rules from Redis
    rules, err := loadRoutingRules(ctx)
    if err != nil {
        return "", err
    }
    
    // Determine target department
    department := rules[doc.Category]
    
    logger.Info("Routing document", "category", doc.Category, "department", department)
    
    // Publish to Kafka
    err = publishRoutingEvent(ctx, doc.ID, department)
    if err != nil {
        return "", err
    }
    
    return department, nil
}
```

---

## Event Schemas

### Kafka Event Schema

```json
{
  "event_id": "uuid",
  "event_type": "document.processed",
  "timestamp": "2025-11-12T10:00:00Z",
  "source": "ocr-service",
  "data": {
    "document_id": "doc-123",
    "user_id": "user-456",
    "status": "completed",
    "confidence": 0.96,
    "processing_time_ms": 425
  },
  "metadata": {
    "workflow_id": "wf-789",
    "run_id": "run-012",
    "correlation_id": "corr-345"
  }
}
```

---

## Deployment Architecture

### Development Environment
```
Single machine:
- All services via Docker Compose
- Temporal + PostgreSQL
- Kafka + Zookeeper
- Redis
- Keycloak
- APISIX
```

### Production Environment
```
Kubernetes cluster:
- Temporal Helm chart
- Kafka Operator
- Redis Operator
- Keycloak Operator
- APISIX Ingress Controller
- TigerBeetle StatefulSet
```

---

## Next Steps

1. ✅ Architecture designed
2. ⏳ Install Temporal server
3. ⏳ Install Kafka cluster
4. ⏳ Install Redis
5. ⏳ Install APISIX
6. ⏳ Install Keycloak
7. ⏳ Install Permify
8. ⏳ Install TigerBeetle
9. ⏳ Install Dapr
10. ⏳ Implement workflows (Go)
11. ⏳ Implement activities (Python)
12. ⏳ Integration testing

---

## Technology Versions

| Component | Version | Language |
|-----------|---------|----------|
| Temporal Server | 1.22.0 | Go |
| Temporal Go SDK | 1.25.0 | Go |
| Temporal Python SDK | 1.5.0 | Python |
| Kafka | 3.6.0 | Java/Scala |
| Redis | 7.2 | C |
| APISIX | 3.7.0 | Lua/OpenResty |
| Keycloak | 23.0 | Java |
| Permify | 0.6.0 | Go |
| TigerBeetle | 0.15.0 | Zig |
| Dapr | 1.12.0 | Go |

---

This architecture provides a robust, scalable foundation for orchestrating all 10 user stories with proper separation of concerns, fault tolerance, and observability.
