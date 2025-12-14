# Document Intelligence Platform - User Stories

**Date:** November 12, 2025  
**Based on:** Existing platform components and capabilities  
**Purpose:** End-to-end user journeys with orchestration layer

---

## User Story #1: Automated Document Processing Pipeline

### Description
As a **document processor**, I want to upload a document and have it automatically processed through OCR, validated, stored in the lakehouse, and made searchable, so that I can access structured data without manual intervention.

### Existing Components Used
- ✅ React UI (document upload)
- ✅ OCR Ensemble Service (EasyOCR + Tesseract)
- ✅ Delta Lake (storage)
- ✅ API Gateway (lakehouse access)
- ✅ WebSocket (real-time updates)

### New Components Needed
- 🆕 Temporal workflow (orchestration)
- 🆕 Kafka (event streaming)
- 🆕 Redis (caching results)
- 🆕 APISIX (API routing)

### User Journey
1. User logs in via Keycloak SSO
2. User uploads document (PDF/image) via UI
3. UI sends document to APISIX gateway
4. APISIX routes to Temporal workflow starter
5. **Temporal Workflow Starts:**
   - Activity 1: Upload to S3 storage
   - Activity 2: Send to OCR ensemble service
   - Activity 3: Validate OCR results (confidence > 90%)
   - Activity 4: Structure data
   - Activity 5: Write to Delta Lake (Bronze layer)
   - Activity 6: Transform to Silver layer
   - Activity 7: Cache in Redis
   - Activity 8: Publish "document_processed" event to Kafka
6. UI receives WebSocket notification
7. User views processed document with extracted data
8. User can query document via lakehouse explorer

### Success Criteria
- Document processed end-to-end in < 5 seconds
- OCR accuracy > 95%
- Data available in lakehouse immediately
- Real-time progress updates
- Audit trail in TigerBeetle ledger

### Temporal Workflow (Go)
```go
func DocumentProcessingWorkflow(ctx workflow.Context, doc DocumentInput) error {
    // Activity 1: Upload
    // Activity 2: OCR
    // Activity 3: Validate
    // Activity 4: Structure
    // Activity 5: Store
    // Activity 6: Transform
    // Activity 7: Cache
    // Activity 8: Notify
}
```

### Kafka Events
- `document.uploaded`
- `document.ocr.started`
- `document.ocr.completed`
- `document.validated`
- `document.stored`
- `document.processed`

---

## User Story #2: Batch Document Processing with Progress Tracking

### Description
As a **bulk processor**, I want to upload 50 documents at once and track the progress of each document in real-time, so that I can efficiently process large volumes without manual monitoring.

### Existing Components Used
- ✅ React UI (batch upload)
- ✅ OCR service (concurrent processing)
- ✅ WebSocket (progress updates)
- ✅ Database (tracking)

### New Components Needed
- 🆕 Temporal batch workflow
- 🆕 Redis (progress state)
- 🆕 Kafka (parallel events)
- 🆕 Dapr (state management)

### User Journey
1. User selects 50 documents for upload
2. UI creates batch job via APISIX
3. **Temporal Batch Workflow Starts:**
   - Creates child workflow for each document
   - Tracks progress in Redis
   - Publishes batch events to Kafka
4. Each document processed in parallel (max 10 concurrent)
5. Progress bar updates in real-time via WebSocket
6. Failed documents automatically retry (max 3 attempts)
7. Batch completion notification sent
8. User views summary report (success/failure counts)

### Success Criteria
- Handle 50 documents concurrently
- Progress updates every 500ms
- Automatic retry on failures
- Complete batch in < 2 minutes
- Detailed error reporting

### Temporal Workflow (Go)
```go
func BatchProcessingWorkflow(ctx workflow.Context, batch BatchInput) error {
    // Create child workflows
    for _, doc := range batch.Documents {
        workflow.ExecuteChildWorkflow(ctx, DocumentProcessingWorkflow, doc)
    }
    // Track progress in Redis
    // Aggregate results
    // Send completion notification
}
```

### Redis Keys
- `batch:{batch_id}:progress` - Overall progress
- `batch:{batch_id}:status:{doc_id}` - Individual status
- `batch:{batch_id}:errors` - Error list

---

## User Story #3: Document Verification Workflow with Human Review

### Description
As a **compliance officer**, I want documents with low confidence scores to be automatically routed for human review, so that we maintain data quality standards.

### Existing Components Used
- ✅ OCR confidence scoring
- ✅ User authentication
- ✅ Document management UI

### New Components Needed
- 🆕 Temporal human task workflow
- 🆕 Permify (permission checks)
- 🆕 Keycloak (reviewer roles)
- 🆕 Kafka (review events)

### User Journey
1. Document processed via Story #1
2. OCR confidence < 90% triggers review workflow
3. **Temporal Review Workflow:**
   - Activity 1: Check Permify for available reviewers
   - Activity 2: Assign to reviewer queue
   - Activity 3: Send notification via Kafka
   - Activity 4: Wait for human decision (timeout: 24h)
   - Activity 5: If approved, continue to lakehouse
   - Activity 6: If rejected, send back to OCR with different engine
4. Reviewer receives notification
5. Reviewer opens document in UI
6. Reviewer corrects/approves extraction
7. Workflow continues or retries
8. Audit trail recorded in TigerBeetle

### Success Criteria
- Auto-route low confidence docs
- Reviewer notified within 1 minute
- Support multiple reviewers
- Timeout handling
- Complete audit trail

### Temporal Workflow (Go)
```go
func DocumentReviewWorkflow(ctx workflow.Context, doc DocumentInput) error {
    // Check confidence
    if confidence < 0.9 {
        // Assign to reviewer
        // Wait for human signal
        // Process decision
    }
    // Continue normal flow
}
```

### Permify Permissions
- `document:review` - Can review documents
- `document:approve` - Can approve documents
- `document:reject` - Can reject documents

---

## User Story #4: Scheduled Data Ingestion from External Sources

### Description
As a **data engineer**, I want to schedule daily ingestion of documents from SFTP servers, so that new documents are automatically processed without manual uploads.

### Existing Components Used
- ✅ Ingestion framework
- ✅ SFTP connector
- ✅ Delta Lake storage

### New Components Needed
- 🆕 Temporal scheduled workflow
- 🆕 Kafka (ingestion events)
- 🆕 Redis (ingestion state)

### User Journey
1. Admin configures SFTP ingestion job via UI
2. Job stored in database with cron schedule
3. **Temporal Scheduled Workflow (daily at 2 AM):**
   - Activity 1: Connect to SFTP server
   - Activity 2: List new files since last run
   - Activity 3: Download files to temp storage
   - Activity 4: For each file, trigger Document Processing Workflow
   - Activity 5: Update last run timestamp in Redis
   - Activity 6: Publish ingestion summary to Kafka
4. Admin receives email summary
5. Documents available in lakehouse

### Success Criteria
- Reliable daily execution
- Handle connection failures
- Skip already processed files
- Detailed logging
- Alert on failures

### Temporal Workflow (Go)
```go
func ScheduledIngestionWorkflow(ctx workflow.Context, config IngestionConfig) error {
    // Connect to source
    // List files
    // Process each file
    // Update state
    // Send summary
}
```

### Kafka Events
- `ingestion.started`
- `ingestion.file_discovered`
- `ingestion.file_processed`
- `ingestion.completed`
- `ingestion.failed`

---

## User Story #5: Analytics Report Generation with Caching

### Description
As a **business analyst**, I want to generate weekly analytics reports on document processing trends, so that I can track performance and identify bottlenecks.

### Existing Components Used
- ✅ Analytics API endpoints
- ✅ Spark processing
- ✅ Delta Lake (data source)

### New Components Needed
- 🆕 Temporal scheduled workflow
- 🆕 Redis (report caching)
- 🆕 Kafka (report events)

### User Journey
1. System runs weekly report workflow (Monday 8 AM)
2. **Temporal Report Workflow:**
   - Activity 1: Check Redis cache for recent report
   - Activity 2: If cache miss, query Delta Lake via Spark
   - Activity 3: Aggregate processing trends
   - Activity 4: Calculate category statistics
   - Activity 5: Identify error patterns
   - Activity 6: Generate PDF report
   - Activity 7: Cache results in Redis (TTL: 7 days)
   - Activity 8: Publish report to Kafka
3. Subscribers receive report notification
4. Report available in UI dashboard
5. Users can download PDF or view interactive charts

### Success Criteria
- Report generated in < 30 seconds
- Cached results served in < 100ms
- Support 1M+ documents
- Interactive visualizations
- Export to PDF/Excel

### Temporal Workflow (Go)
```go
func AnalyticsReportWorkflow(ctx workflow.Context, params ReportParams) error {
    // Check cache
    // Query data
    // Aggregate
    // Generate report
    // Cache
    // Notify
}
```

### Redis Keys
- `report:weekly:{week}:trends`
- `report:weekly:{week}:categories`
- `report:weekly:{week}:errors`

---

## User Story #6: Multi-User Document Collaboration with Permissions

### Description
As a **team member**, I want to collaborate on document review with my team, with role-based access control, so that only authorized users can view sensitive documents.

### Existing Components Used
- ✅ User authentication
- ✅ Document management
- ✅ WebSocket (real-time updates)

### New Components Needed
- 🆕 Keycloak (SSO, user management)
- 🆕 Permify (fine-grained permissions)
- 🆕 Redis (real-time collaboration state)
- 🆕 Kafka (collaboration events)

### User Journey
1. User logs in via Keycloak SSO
2. User opens document
3. **Permission Check (Permify):**
   - Check user role (viewer/editor/admin)
   - Check document sensitivity level
   - Check team membership
4. If authorized, document loads
5. User actions broadcast via Kafka:
   - Document opened
   - Field edited
   - Comment added
6. Other team members see real-time updates via WebSocket
7. Redis tracks active users on document
8. All changes logged in TigerBeetle audit trail

### Success Criteria
- Sub-second permission checks
- Real-time collaboration (< 100ms latency)
- Support 10+ concurrent users per document
- Complete audit trail
- Granular permissions (field-level)

### Keycloak Roles
- `document_viewer` - Read-only access
- `document_editor` - Can edit
- `document_admin` - Full control

### Permify Rules
```yaml
entity document {
  relation viewer @user
  relation editor @user
  relation admin @user
  
  action view = viewer or editor or admin
  action edit = editor or admin
  action delete = admin
}
```

---

## User Story #7: Immutable Document Audit Trail

### Description
As a **compliance auditor**, I want an immutable audit trail of all document operations, so that I can prove regulatory compliance.

### Existing Components Used
- ✅ Document metadata
- ✅ User actions
- ✅ Database logging

### New Components Needed
- 🆕 TigerBeetle (distributed ledger)
- 🆕 Temporal workflow (audit logging)
- 🆕 Kafka (audit events)

### User Journey
1. Any document operation triggers audit event
2. **Temporal Audit Workflow:**
   - Activity 1: Capture event details (who, what, when, where)
   - Activity 2: Write to TigerBeetle ledger (immutable)
   - Activity 3: Write to Delta Lake (queryable)
   - Activity 4: Publish to Kafka audit topic
3. Auditor queries audit trail via UI
4. System generates compliance reports
5. External auditors can verify ledger integrity

### Success Criteria
- All operations logged (no exceptions)
- Immutable audit trail
- Query performance < 1 second
- Support 10M+ events
- Cryptographic verification

### TigerBeetle Entries
```go
type AuditEntry struct {
    ID        uint128
    Timestamp int64
    UserID    string
    Action    string
    DocumentID string
    Details   string
    Hash      [32]byte
}
```

### Kafka Events
- `audit.document.created`
- `audit.document.viewed`
- `audit.document.edited`
- `audit.document.deleted`
- `audit.permission.granted`
- `audit.permission.revoked`

---

## User Story #8: Intelligent Document Routing Based on Classification

### Description
As a **document coordinator**, I want documents to be automatically routed to the correct department based on their type, so that processing is streamlined.

### Existing Components Used
- ✅ Document classification (OCR pipeline)
- ✅ Category detection
- ✅ User management

### New Components Needed
- 🆕 Temporal routing workflow
- 🆕 Kafka (routing events)
- 🆕 Permify (department permissions)
- 🆕 Redis (routing rules cache)

### User Journey
1. Document processed and classified (passport, invoice, etc.)
2. **Temporal Routing Workflow:**
   - Activity 1: Get document category
   - Activity 2: Load routing rules from Redis
   - Activity 3: Determine target department
   - Activity 4: Check Permify for department access
   - Activity 5: Assign document to department queue
   - Activity 6: Notify department via Kafka
3. Department members receive notification
4. Document appears in department's queue
5. Department processes document
6. Routing logged in audit trail

### Success Criteria
- Accurate routing (> 95%)
- Route in < 1 second
- Support custom routing rules
- Handle routing conflicts
- Audit all routing decisions

### Routing Rules (Redis)
```json
{
  "passport": "immigration_dept",
  "drivers_license": "identity_verification",
  "utility_bill": "address_verification",
  "pay_stub": "income_verification",
  "tax_return": "financial_dept"
}
```

### Temporal Workflow (Go)
```go
func DocumentRoutingWorkflow(ctx workflow.Context, doc DocumentInput) error {
    // Classify document
    // Load routing rules
    // Determine target
    // Check permissions
    // Assign to queue
    // Notify
}
```

---

## User Story #9: Data Quality Monitoring with Automated Alerts

### Description
As a **quality assurance manager**, I want to be automatically alerted when OCR confidence drops below thresholds, so that I can investigate quality issues proactively.

### Existing Components Used
- ✅ OCR confidence scores
- ✅ Error tracking
- ✅ Analytics API

### New Components Needed
- 🆕 Temporal monitoring workflow
- 🆕 Kafka (alert events)
- 🆕 Redis (metrics aggregation)
- 🆕 Dapr (notification service)

### User Journey
1. **Temporal Monitoring Workflow (runs every 5 minutes):**
   - Activity 1: Query recent OCR results from Delta Lake
   - Activity 2: Calculate average confidence
   - Activity 3: Compare against threshold (90%)
   - Activity 4: If below threshold, aggregate error patterns
   - Activity 5: Publish alert to Kafka
   - Activity 6: Update metrics in Redis
2. Alert subscribers receive notification (email/Slack)
3. QA manager opens quality dashboard
4. Dashboard shows:
   - Confidence trends
   - Error patterns
   - Affected document types
5. QA manager investigates root cause

### Success Criteria
- Real-time monitoring (5-minute intervals)
- Alert latency < 1 minute
- Detailed error analysis
- Historical trend visualization
- Configurable thresholds

### Temporal Workflow (Go)
```go
func QualityMonitoringWorkflow(ctx workflow.Context) error {
    // Query recent results
    // Calculate metrics
    // Check thresholds
    // Generate alerts
    // Update dashboard
}
```

### Redis Metrics
- `metrics:ocr:confidence:avg` - Rolling average
- `metrics:ocr:confidence:min` - Minimum
- `metrics:ocr:errors:count` - Error count
- `metrics:ocr:processing_time:avg` - Avg processing time

---

## User Story #10: Cross-Platform Document Synchronization

### Description
As a **mobile user**, I want my documents to sync across web and mobile apps in real-time, so that I can access them from any device.

### Existing Components Used
- ✅ Document storage (S3)
- ✅ Database (metadata)
- ✅ API endpoints

### New Components Needed
- 🆕 Dapr (state management)
- 🆕 Kafka (sync events)
- 🆕 Temporal (sync workflow)
- 🆕 Redis (sync state)

### User Journey
1. User uploads document on web app
2. **Temporal Sync Workflow:**
   - Activity 1: Write to Dapr state store
   - Activity 2: Publish sync event to Kafka
   - Activity 3: Update Redis cache
   - Activity 4: Trigger push notification to mobile devices
3. Mobile app receives push notification
4. Mobile app pulls updated document list
5. User opens mobile app and sees new document
6. User edits document on mobile
7. Changes sync back to web app in real-time

### Success Criteria
- Sync latency < 2 seconds
- Conflict resolution (last-write-wins)
- Offline support (queue changes)
- Support 1000+ concurrent users
- Cross-platform consistency

### Dapr Components
- State store (Redis backend)
- Pub/sub (Kafka backend)
- Service invocation

### Temporal Workflow (Go)
```go
func DocumentSyncWorkflow(ctx workflow.Context, change ChangeEvent) error {
    // Detect change
    // Update state
    // Publish event
    // Notify devices
    // Handle conflicts
}
```

### Kafka Events
- `sync.document.created`
- `sync.document.updated`
- `sync.document.deleted`
- `sync.conflict.detected`

---

## Summary

### User Stories Overview

| # | Story | Complexity | Components | Priority |
|---|-------|------------|------------|----------|
| 1 | Automated Processing | High | Temporal, Kafka, Redis, APISIX | P0 |
| 2 | Batch Processing | High | Temporal, Redis, Kafka, Dapr | P0 |
| 3 | Human Review | Medium | Temporal, Permify, Keycloak | P1 |
| 4 | Scheduled Ingestion | Medium | Temporal, Kafka, Redis | P1 |
| 5 | Analytics Reports | Medium | Temporal, Redis, Kafka | P2 |
| 6 | Collaboration | High | Keycloak, Permify, Redis, Kafka | P1 |
| 7 | Audit Trail | High | TigerBeetle, Temporal, Kafka | P0 |
| 8 | Intelligent Routing | Medium | Temporal, Kafka, Permify, Redis | P2 |
| 9 | Quality Monitoring | Medium | Temporal, Kafka, Redis, Dapr | P2 |
| 10 | Cross-Platform Sync | High | Dapr, Kafka, Temporal, Redis | P2 |

### Middleware Usage

| Component | Used In Stories | Purpose |
|-----------|-----------------|---------|
| Temporal | All 10 | Workflow orchestration |
| Kafka | All 10 | Event streaming |
| Redis | 1,2,4,5,6,8,9,10 | Caching, state |
| APISIX | 1 | API gateway |
| Keycloak | 1,3,6 | Identity |
| Permify | 3,6,8 | Authorization |
| TigerBeetle | 1,7 | Ledger |
| Dapr | 2,9,10 | Runtime |
| Fluvio | - | Alternative to Kafka |

### Implementation Order

**Phase 1 (Core Infrastructure):**
1. Install all middleware
2. Configure Temporal
3. Set up Kafka
4. Deploy Redis

**Phase 2 (Foundation Stories):**
1. Story #1 - Automated Processing
2. Story #7 - Audit Trail
3. Story #2 - Batch Processing

**Phase 3 (Security & Permissions):**
4. Story #6 - Collaboration
5. Story #3 - Human Review
6. Story #8 - Intelligent Routing

**Phase 4 (Advanced Features):**
7. Story #4 - Scheduled Ingestion
8. Story #5 - Analytics Reports
9. Story #9 - Quality Monitoring
10. Story #10 - Cross-Platform Sync

---

## Next Steps

1. ✅ User stories defined
2. ⏳ Design orchestration architecture
3. ⏳ Install middleware stack
4. ⏳ Implement workflows (Go)
5. ⏳ Implement activities (Python)
6. ⏳ Integration testing
7. ⏳ End-to-end validation

All user stories are based on **existing platform components** and add orchestration/middleware layers to create complete end-to-end journeys.
