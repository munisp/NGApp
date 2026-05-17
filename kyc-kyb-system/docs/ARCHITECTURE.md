# KYC/KYB System Architecture

## Overview

Comprehensive KYC (Know Your Customer) and KYB (Know Your Business) system built using platform middleware with full document verification, liveness detection, AML screening, risk scoring, and continuous monitoring.

## Architecture Principles

- **Microservices**: 6 independent services with clear boundaries
- **Event-Driven**: Kafka/Fluvio for async communication
- **Workflow Orchestration**: Temporal for complex multi-step processes
- **API Gateway**: APISix for routing, rate limiting, authentication
- **Identity & Access**: Keycloak for authentication, Permify for authorization
- **State Management**: Redis for caching, sessions, distributed locks
- **Financial Ledger**: TigerBeetle for audit trail and accounting
- **Data Lake**: Lakehouse for analytics and ML model training
- **Service Mesh**: Dapr for service-to-service communication

## System Components

### 1. Document Verification Service (Python)
- **Purpose**: Extract and verify data from identity documents
- **OCR Engines**: PaddleOCR, VLM (Vision Language Models), Docling
- **Supported Documents**: National ID, Passport, Driver's License, Utility Bills, CAC Certificate
- **Features**:
  - Multi-engine OCR with confidence scoring
  - Document authenticity checks (holograms, watermarks, fonts)
  - Data extraction and normalization
  - Cross-validation with NIN/CAC databases
  - Fraud detection (tampered documents, fake IDs)

### 2. Liveness Detection Service (Python)
- **Purpose**: Verify that biometric samples are from live persons
- **Features**:
  - Active liveness (blink detection, head movement, smile)
  - Passive liveness (texture analysis, depth sensing)
  - Anti-spoofing (detect photos, videos, masks, deepfakes)
  - Face matching against ID documents
  - Fingerprint liveness detection

### 3. AML Screening Service (Go)
- **Purpose**: Screen customers against sanctions lists and PEP databases
- **Data Sources**:
  - UN Sanctions List
  - OFAC (US Treasury)
  - EU Sanctions List
  - Nigerian PEP Database
  - Interpol Red Notices
  - Adverse Media (negative news)
- **Features**:
  - Real-time screening during onboarding
  - Fuzzy name matching
  - Date of birth verification
  - Nationality checks
  - Ongoing monitoring (daily updates)

### 4. Risk Scoring Service (Go)
- **Purpose**: Calculate customer risk scores for risk-based due diligence
- **Risk Factors**:
  - Customer type (individual, business, PEP)
  - Geographic risk (high-risk countries)
  - Product risk (high-value policies)
  - Transaction patterns
  - AML screening results
  - Document verification confidence
  - Historical behavior
- **Risk Levels**: LOW (0-30), MEDIUM (31-60), HIGH (61-85), CRITICAL (86-100)
- **Actions**: SDD (Simplified), CDD (Customer), EDD (Enhanced Due Diligence)

### 5. KYC Orchestrator Service (Go)
- **Purpose**: Orchestrate multi-step KYC/KYB workflows using Temporal
- **Workflows**:
  - Individual KYC workflow
  - Business KYB workflow
  - Enhanced Due Diligence (EDD) workflow
  - Re-verification workflow
- **Activities**:
  - Document collection
  - Document verification
  - Liveness detection
  - NIN/CAC verification
  - BVN verification
  - AML screening
  - Risk scoring
  - Decision making
  - Notification

### 6. Continuous Monitoring Service (Go)
- **Purpose**: Monitor customers for changes in risk profile
- **Features**:
  - Daily AML screening updates
  - Transaction monitoring
  - Behavior analysis
  - Adverse media monitoring
  - PEP status changes
  - Trigger-based re-verification
  - Compliance reporting

## Data Flow

### Individual KYC Flow

```
Customer → API Gateway (APISix) → KYC Orchestrator
                                        ↓
                            Temporal Workflow Started
                                        ↓
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
            Document Upload      Liveness Check      NIN Verification
                    │                   │                   │
            Document Verification   Face Matching    NIMC API Call
            (PaddleOCR + VLM)      (Anti-spoofing)        │
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ↓
                                  AML Screening
                                  (Sanctions, PEP)
                                        ↓
                                  Risk Scoring
                                  (0-100 score)
                                        ↓
                            Decision (Approve/Reject/EDD)
                                        ↓
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
            TigerBeetle Entry    Kafka Event       Customer Notification
            (Audit Trail)        (Verified)         (SMS/Email/WhatsApp)
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ↓
                                Lakehouse (Analytics)
```

### Business KYB Flow

```
Business → API Gateway (APISix) → KYC Orchestrator
                                        ↓
                            Temporal Workflow Started
                                        ↓
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
CAC Verification              Directors KYC                    UBO Identification
(CAC API)                     (Each director)                  (Ownership structure)
        │                               │                               │
Company Status Check          Individual KYC Flow              UBO KYC Flow
(Active/Inactive)             (For each director)              (For each UBO >25%)
        │                               │                               │
        └───────────────────────────────┼───────────────────────────────┘
                                        ↓
                                  AML Screening
                                  (Company + Directors + UBOs)
                                        ↓
                                  Risk Scoring
                                  (Business risk factors)
                                        ↓
                            Decision (Approve/Reject/EDD)
                                        ↓
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
            TigerBeetle Entry    Kafka Event       Business Notification
            (Audit Trail)        (Verified)         (Email)
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ↓
                                Lakehouse (Analytics)
```

## Middleware Integration

### Kafka/Fluvio (Event Streaming)
- **Topics**:
  - `kyc.document.uploaded`
  - `kyc.document.verified`
  - `kyc.liveness.completed`
  - `kyc.nin.verified`
  - `kyc.aml.screened`
  - `kyc.risk.scored`
  - `kyc.customer.verified`
  - `kyc.customer.rejected`
  - `kyb.company.verified`
  - `kyc.monitoring.alert`

### Temporal (Workflow Orchestration)
- **Workflows**:
  - `IndividualKYCWorkflow`
  - `BusinessKYBWorkflow`
  - `EnhancedDueDiligenceWorkflow`
  - `ReVerificationWorkflow`
  - `ContinuousMonitoringWorkflow`
- **Activities**:
  - `VerifyDocumentActivity`
  - `DetectLivenessActivity`
  - `VerifyNINActivity`
  - `VerifyCACActivity`
  - `ScreenAMLActivity`
  - `CalculateRiskScoreActivity`
  - `SendNotificationActivity`

### Keycloak (Authentication)
- **Realms**: `insurance-platform`
- **Clients**: `kyc-api`, `kyc-admin`, `kyc-agent`
- **Roles**: `customer`, `agent`, `kyc-officer`, `compliance-officer`, `admin`
- **Features**:
  - OAuth 2.0 / OpenID Connect
  - JWT tokens
  - Multi-factor authentication (MFA)
  - Social login (Google, Facebook)

### Permify (Authorization)
- **Entities**: `customer`, `document`, `verification`, `company`
- **Relations**: `owner`, `verifier`, `approver`, `viewer`
- **Permissions**: `read`, `write`, `verify`, `approve`, `reject`
- **Policies**:
  - Customers can only view their own documents
  - KYC officers can verify documents
  - Compliance officers can approve/reject
  - Admins have full access

### Redis (Caching & State)
- **Use Cases**:
  - Session management
  - Rate limiting
  - Distributed locks (prevent duplicate verification)
  - Caching (NIN/CAC lookup results)
  - Temporary storage (uploaded documents before processing)
  - Real-time counters (verification attempts)

### APISix (API Gateway)
- **Routes**:
  - `/api/v1/kyc/*` → KYC Orchestrator Service
  - `/api/v1/documents/*` → Document Verification Service
  - `/api/v1/liveness/*` → Liveness Detection Service
  - `/api/v1/aml/*` → AML Screening Service
  - `/api/v1/risk/*` → Risk Scoring Service
- **Plugins**:
  - `jwt-auth` (Keycloak integration)
  - `rate-limit` (100 req/min per customer)
  - `cors` (Cross-origin requests)
  - `prometheus` (Metrics)
  - `request-id` (Tracing)

### TigerBeetle (Financial Ledger)
- **Accounts**:
  - `kyc_verification_fees` (Revenue)
  - `kyc_operational_costs` (Expenses)
  - `customer_deposits` (Assets)
- **Transfers**:
  - Record KYC verification fees
  - Track operational costs (API calls, OCR processing)
  - Audit trail for compliance

### Dapr (Service Mesh)
- **Components**:
  - `pubsub.kafka` (Event publishing/subscribing)
  - `statestore.redis` (State management)
  - `bindings.temporal` (Workflow invocation)
  - `secretstore.kubernetes` (Secret management)
- **Features**:
  - Service-to-service invocation
  - Retry policies
  - Circuit breakers
  - Distributed tracing

### Lakehouse (Data Analytics)
- **Data Sources**:
  - KYC verification events (Kafka)
  - Document metadata (PostgreSQL)
  - Risk scores (PostgreSQL)
  - AML screening results (PostgreSQL)
  - Customer behavior (Kafka)
- **Use Cases**:
  - ML model training (fraud detection, risk scoring)
  - Compliance reporting
  - Analytics dashboards
  - Trend analysis
  - Performance metrics

## Database Schema

### PostgreSQL Tables

#### `customers`
- `id` (UUID, PK)
- `customer_type` (ENUM: individual, business)
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `kyc_status` (ENUM: pending, in_progress, verified, rejected)
- `risk_level` (ENUM: low, medium, high, critical)
- `risk_score` (INT)
- `verification_date` (TIMESTAMP)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `documents`
- `id` (UUID, PK)
- `customer_id` (UUID, FK)
- `document_type` (ENUM: national_id, passport, drivers_license, utility_bill, cac_certificate)
- `document_number` (VARCHAR)
- `file_path` (VARCHAR)
- `ocr_engine` (ENUM: paddleocr, vlm, docling)
- `extracted_data` (JSONB)
- `confidence_score` (FLOAT)
- `verification_status` (ENUM: pending, verified, rejected)
- `verified_by` (UUID, FK to users)
- `verified_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

#### `liveness_checks`
- `id` (UUID, PK)
- `customer_id` (UUID, FK)
- `check_type` (ENUM: active, passive)
- `video_path` (VARCHAR)
- `liveness_score` (FLOAT)
- `anti_spoofing_score` (FLOAT)
- `face_match_score` (FLOAT)
- `status` (ENUM: passed, failed)
- `created_at` (TIMESTAMP)

#### `aml_screenings`
- `id` (UUID, PK)
- `customer_id` (UUID, FK)
- `screening_type` (ENUM: sanctions, pep, adverse_media)
- `data_source` (VARCHAR)
- `match_found` (BOOLEAN)
- `match_details` (JSONB)
- `match_score` (FLOAT)
- `status` (ENUM: clear, hit, false_positive)
- `reviewed_by` (UUID, FK to users)
- `reviewed_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

#### `risk_assessments`
- `id` (UUID, PK)
- `customer_id` (UUID, FK)
- `risk_score` (INT)
- `risk_level` (ENUM: low, medium, high, critical)
- `risk_factors` (JSONB)
- `due_diligence_level` (ENUM: sdd, cdd, edd)
- `assessment_date` (TIMESTAMP)
- `next_review_date` (TIMESTAMP)
- `created_at` (TIMESTAMP)

#### `monitoring_alerts`
- `id` (UUID, PK)
- `customer_id` (UUID, FK)
- `alert_type` (ENUM: aml_hit, risk_increase, suspicious_transaction, pep_status_change)
- `alert_details` (JSONB)
- `severity` (ENUM: low, medium, high, critical)
- `status` (ENUM: open, investigating, resolved, false_positive)
- `assigned_to` (UUID, FK to users)
- `resolved_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

#### `companies`
- `id` (UUID, PK)
- `cac_number` (VARCHAR, UNIQUE)
- `company_name` (VARCHAR)
- `company_type` (VARCHAR)
- `registration_date` (DATE)
- `company_status` (ENUM: active, inactive, dissolved)
- `share_capital` (DECIMAL)
- `kyb_status` (ENUM: pending, in_progress, verified, rejected)
- `risk_level` (ENUM: low, medium, high, critical)
- `verification_date` (TIMESTAMP)
- `created_at` (TIMESTAMP)

#### `directors`
- `id` (UUID, PK)
- `company_id` (UUID, FK)
- `customer_id` (UUID, FK)
- `director_type` (ENUM: executive, non_executive, chairman)
- `appointment_date` (DATE)
- `resignation_date` (DATE, nullable)
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMP)

#### `beneficial_owners`
- `id` (UUID, PK)
- `company_id` (UUID, FK)
- `customer_id` (UUID, FK)
- `ownership_percentage` (FLOAT)
- `control_type` (ENUM: direct, indirect, voting_rights, other)
- `verification_status` (ENUM: pending, verified, rejected)
- `created_at` (TIMESTAMP)

## API Endpoints

### KYC Orchestrator Service (Go)

#### Individual KYC
- `POST /api/v1/kyc/individual/start` - Start individual KYC workflow
- `GET /api/v1/kyc/individual/{customer_id}/status` - Get KYC status
- `POST /api/v1/kyc/individual/{customer_id}/documents` - Upload documents
- `POST /api/v1/kyc/individual/{customer_id}/liveness` - Submit liveness check
- `POST /api/v1/kyc/individual/{customer_id}/verify-nin` - Verify NIN
- `POST /api/v1/kyc/individual/{customer_id}/verify-bvn` - Verify BVN
- `GET /api/v1/kyc/individual/{customer_id}/risk-score` - Get risk score
- `POST /api/v1/kyc/individual/{customer_id}/approve` - Approve KYC
- `POST /api/v1/kyc/individual/{customer_id}/reject` - Reject KYC

#### Business KYB
- `POST /api/v1/kyb/business/start` - Start business KYB workflow
- `GET /api/v1/kyb/business/{company_id}/status` - Get KYB status
- `POST /api/v1/kyb/business/{company_id}/verify-cac` - Verify CAC
- `POST /api/v1/kyb/business/{company_id}/directors` - Add directors
- `POST /api/v1/kyb/business/{company_id}/beneficial-owners` - Add UBOs
- `GET /api/v1/kyb/business/{company_id}/risk-score` - Get risk score
- `POST /api/v1/kyb/business/{company_id}/approve` - Approve KYB
- `POST /api/v1/kyb/business/{company_id}/reject` - Reject KYB

### Document Verification Service (Python)
- `POST /api/v1/documents/verify` - Verify document with OCR
- `POST /api/v1/documents/extract` - Extract data from document
- `GET /api/v1/documents/{document_id}` - Get document details
- `POST /api/v1/documents/{document_id}/validate` - Validate extracted data

### Liveness Detection Service (Python)
- `POST /api/v1/liveness/active` - Perform active liveness check
- `POST /api/v1/liveness/passive` - Perform passive liveness check
- `POST /api/v1/liveness/face-match` - Match face against ID
- `GET /api/v1/liveness/{check_id}` - Get liveness check result

### AML Screening Service (Go)
- `POST /api/v1/aml/screen` - Screen customer against AML databases
- `GET /api/v1/aml/{screening_id}` - Get screening result
- `POST /api/v1/aml/{screening_id}/review` - Review AML hit
- `GET /api/v1/aml/customer/{customer_id}/history` - Get screening history

### Risk Scoring Service (Go)
- `POST /api/v1/risk/calculate` - Calculate risk score
- `GET /api/v1/risk/{assessment_id}` - Get risk assessment
- `GET /api/v1/risk/customer/{customer_id}/current` - Get current risk score
- `GET /api/v1/risk/customer/{customer_id}/history` - Get risk score history

### Continuous Monitoring Service (Go)
- `POST /api/v1/monitoring/enable` - Enable monitoring for customer
- `GET /api/v1/monitoring/alerts` - Get all alerts
- `GET /api/v1/monitoring/alerts/{alert_id}` - Get alert details
- `POST /api/v1/monitoring/alerts/{alert_id}/resolve` - Resolve alert
- `GET /api/v1/monitoring/customer/{customer_id}/alerts` - Get customer alerts

## Security & Compliance

### Security Measures
- **Authentication**: Keycloak OAuth 2.0 / OpenID Connect
- **Authorization**: Permify RBAC
- **Encryption**: TLS 1.3 for data in transit, AES-256 for data at rest
- **API Security**: JWT tokens, rate limiting, CORS
- **Data Masking**: PII masked in logs and non-production environments
- **Audit Trail**: All actions logged to TigerBeetle and Lakehouse

### Regulatory Compliance
- **CBN KYC Requirements**: Full compliance
- **NAICOM Requirements**: Full compliance
- **NDPR (Data Protection)**: Full compliance
- **AML/CFT**: Sanctions screening, PEP checks, transaction monitoring
- **Data Retention**: 7 years for KYC records

## Performance Targets

| Metric | Target | SLA |
|--------|--------|-----|
| Document Verification | < 30s | 95% |
| Liveness Detection | < 10s | 95% |
| AML Screening | < 5s | 99% |
| Risk Scoring | < 2s | 99% |
| Full KYC Workflow | < 15min | 90% |
| System Availability | 99.95% | - |
| API Latency (p95) | < 500ms | - |

## Deployment Architecture

### Kubernetes Deployment
- **Namespaces**: `kyc-system`
- **Services**: 6 microservices
- **Replicas**: 3 per service (HA)
- **Autoscaling**: HPA based on CPU/memory
- **Ingress**: APISix gateway
- **Storage**: PVC for document storage
- **Secrets**: Kubernetes secrets for API keys

### Infrastructure Requirements
- **Compute**: 24 vCPUs, 48GB RAM (for 6 services × 3 replicas)
- **Storage**: 500GB SSD (documents, videos)
- **Database**: PostgreSQL 14+ (16GB RAM, 100GB storage)
- **Cache**: Redis cluster (8GB RAM)
- **Message Queue**: Kafka cluster (3 brokers, 50GB storage)
- **Workflow Engine**: Temporal cluster (3 nodes)

## Monitoring & Observability

### Metrics (Prometheus)
- Request rate, latency, error rate per endpoint
- Document verification success rate
- Liveness detection pass rate
- AML screening hit rate
- Risk score distribution
- Workflow execution time
- Queue depth (Kafka)

### Logging (OpenSearch)
- Structured JSON logs
- Log levels: DEBUG, INFO, WARN, ERROR
- Correlation IDs for tracing
- PII redaction

### Tracing (Jaeger)
- Distributed tracing across services
- Workflow execution traces
- API call traces

### Alerting (Alertmanager)
- High error rate (> 5%)
- High latency (> 1s p95)
- Service down
- AML hit detected
- High-risk customer detected
- Workflow failure

## Cost Estimation

### Monthly Operating Costs (₦)

| Component | Cost (₦) | Cost (USD) |
|-----------|----------|------------|
| Infrastructure (Kubernetes) | 500,000 | $325 |
| Database (PostgreSQL) | 150,000 | $97 |
| Redis Cluster | 100,000 | $65 |
| Kafka Cluster | 200,000 | $130 |
| Temporal Cluster | 150,000 | $97 |
| OCR Processing (PaddleOCR, VLM) | 300,000 | $195 |
| AML Data Subscriptions | 500,000 | $325 |
| API Calls (NIMC, CAC, BVN) | 400,000 | $260 |
| Storage (500GB) | 50,000 | $32 |
| Monitoring & Logging | 100,000 | $65 |
| **Total** | **2,450,000** | **$1,591** |

### Per-Verification Costs

| Verification Type | Cost (₦) | Cost (USD) |
|-------------------|----------|------------|
| Individual KYC | 500 | $0.32 |
| Business KYB | 2,000 | $1.30 |
| Enhanced Due Diligence | 5,000 | $3.25 |
| Re-verification | 200 | $0.13 |

## Roadmap

### Phase 1 (Months 1-2) - Core Implementation ✅
- Document verification service
- Liveness detection service
- AML screening service
- Risk scoring service
- KYC orchestrator service
- Basic Temporal workflows

### Phase 2 (Months 3-4) - Advanced Features
- Continuous monitoring service
- Enhanced Due Diligence workflows
- BVN verification integration
- Address verification
- UBO identification

### Phase 3 (Months 5-6) - Optimization & Scale
- ML-based risk scoring
- Automated decision making
- Advanced fraud detection
- Performance optimization
- Load testing

### Phase 4 (Months 7-8) - Compliance & Reporting
- Compliance dashboards
- Regulatory reporting
- Audit trail enhancements
- Data retention policies
- Security audit

## Success Metrics

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Verification Success Rate | 75% | 95% |
| Onboarding Time | 3 days | 15 minutes |
| False Positive Rate | 15% | 2% |
| Compliance Score | 60% | 100% |
| Customer Satisfaction | 70% | 90% |
| Fraud Detection Rate | 85% | 98% |

---

**Status**: Production-Ready Architecture  
**Version**: 1.0.0  
**Last Updated**: 2026-01-28
