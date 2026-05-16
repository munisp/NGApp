# Actuarial Data Lake Service Design

## 1. Goal
Implement a production-ready Go service (`actuarial-lake-service`) to manage Apache Iceberg tables for actuarial data, ensuring full integration with existing systems and adherence to production-readiness standards.

## 2. Architecture Overview
The service will be a **Dapr-enabled Go microservice** that acts as the primary interface for all actuarial data operations.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Core Service** | Go, Dapr | Business logic, Iceberg table management, API exposure, Observability. |
| **Data Lake** | Apache Iceberg, S3/MinIO | Storage format for actuarial data. S3/MinIO for data files, REST Catalog for metadata. |
| **Asynchronous Processing** | Temporal | Orchestrate complex, long-running data pipeline workflows (e.g., monthly loss ratio calculation). |
| **Real-time Ingestion** | Kafka | Event-driven ingestion of raw data from OpenIMIS and Insurance Operations services. |
| **Observability** | Prometheus, OpenTelemetry | Metrics collection and structured logging with trace IDs. |
| **Deployment** | Kubernetes | Container orchestration via standard K8s manifests. |

## 3. Iceberg Table Schemas and Partitioning

All tables will be created in the `actuarial` namespace.

### 3.1. `dim_actuarial_products` (Dimension)
*   **Purpose:** Stores static product definitions.
*   **Schema:**
    | Field | Type | Description |
    | :--- | :--- | :--- |
    | `product_id` | `int` | Unique product identifier. |
    | `product_name` | `string` | Name of the insurance product. |
    | `start_date` | `date` | Product launch date. |
    | `end_date` | `date` | Product retirement date (nullable). |
    | `underwriting_rules` | `string` | JSON string of underwriting rules. |
*   **Partitioning:** Unpartitioned.
*   **Retention:** Keep indefinitely.

### 3.2. `fact_premium_calculations` (Fact)
*   **Purpose:** Stores detailed records of premium calculations.
*   **Schema:**
    | Field | Type | Description |
    | :--- | :--- | :--- |
    | `calculation_id` | `uuid` | Unique calculation record ID. |
    | `policy_id` | `uuid` | Foreign key to the policy. |
    | `product_id` | `int` | Foreign key to `dim_actuarial_products`. |
    | `calculation_date` | `timestamp` | Date and time of calculation. |
    | `premium_amount` | `decimal(18, 2)` | Calculated premium amount. |
    | `risk_score` | `float` | Calculated risk score. |
    | `version` | `int` | Schema version for evolution testing. |
*   **Partitioning:** `day(calculation_date)`, `product_id`.
*   **Retention:** 5 years.

### 3.3. `fact_risk_assessments` (Fact)
*   **Purpose:** Stores results of individual risk assessments.
*   **Schema:**
    | Field | Type | Description |
    | :--- | :--- | :--- |
    | `assessment_id` | `uuid` | Unique assessment record ID. |
    | `policy_id` | `uuid` | Foreign key to the policy. |
    | `product_id` | `int` | Foreign key to `dim_actuarial_products`. |
    | `assessment_date` | `timestamp` | Date and time of assessment. |
    | `risk_factors` | `map<string, string>` | Key-value pairs of risk factors. |
    | `final_score` | `float` | Final risk score. |
*   **Partitioning:** `month(assessment_date)`, `product_id`.
*   **Retention:** 7 years.

### 3.4. `fact_claim_reserves` (Fact)
*   **Purpose:** Stores records of claim reserve calculations and updates.
*   **Schema:**
    | Field | Type | Description |
    | :--- | :--- | :--- |
    | `reserve_id` | `uuid` | Unique reserve record ID. |
    | `claim_id` | `uuid` | Foreign key to the claim. |
    | `product_id` | `int` | Foreign key to `dim_actuarial_products`. |
    | `reserve_date` | `timestamp` | Date and time of reserve calculation. |
    | `reserved_amount` | `decimal(18, 2)` | Amount reserved. |
    | `status` | `string` | Reserve status (e.g., "Initial", "Updated", "Closed"). |
*   **Partitioning:** `year(reserve_date)`, `product_id`.
*   **Retention:** 10 years.

### 3.5. `fact_loss_ratios` (Fact)
*   **Purpose:** Stores aggregated monthly loss ratio calculations.
*   **Schema:**
    | Field | Type | Description |
    | :--- | :--- | :--- |
    | `ratio_id` | `uuid` | Unique ratio record ID. |
    | `product_id` | `int` | Foreign key to `dim_actuarial_products`. |
    | `reporting_period` | `date` | The first day of the reporting month. |
    | `earned_premium` | `decimal(18, 2)` | Total earned premium for the period. |
    | `incurred_losses` | `decimal(18, 2)` | Total incurred losses for the period. |
    | `loss_ratio` | `float` | Calculated loss ratio (Incurred Losses / Earned Premium). |
*   **Partitioning:** `month(reporting_period)`.
*   **Retention:** Keep indefinitely.

## 4. Implementation Plan (Go Service)

1.  **Iceberg Client Setup:** Initialize the `apache/iceberg-go` client with a mock/local REST catalog and S3/MinIO configuration (using environment variables).
2.  **Table Management Logic:** Implement functions to:
    *   Create all 5 tables with defined schemas and partitioning.
    *   Demonstrate **Schema Evolution** (e.g., adding a column to `fact_premium_calculations`).
    *   Implement **Data Retention** logic using Iceberg's snapshot expiration (via Temporal activity).
3.  **Service Layer:** Implement a Go service with REST endpoints (via Dapr) for:
    *   `POST /v1/data/premium`: Ingest a premium calculation record.
    *   `GET /v1/data/loss-ratio/{product_id}/{month}`: Query a loss ratio record (simulating materialized view access).
4.  **Temporal Integration:**
    *   Define a **Workflow** (`CalculateLossRatioWorkflow`) that runs monthly.
    *   Define **Activities** for: 1) Querying `fact_premium_calculations` and `fact_claim_reserves`, 2) Calculating the loss ratio, 3) Writing to `fact_loss_ratios`, and 4) Running Iceberg maintenance (e.g., `ExpireSnapshotsActivity`).
5.  **Kafka Integration:** Implement a Kafka consumer (using Dapr Pub/Sub) to listen for `premium.calculated` events and ingest data into `fact_premium_calculations`.
6.  **Observability:**
    *   Integrate **Prometheus** metrics (e.g., ingestion rate, query latency).
    *   Implement **Structured Logging** (e.g., `zap` or `slog`) with Dapr/OpenTelemetry trace IDs.
7.  **Deployment:** Create `Dockerfile`, `config.yaml`, and `k8s/deployment.yaml` (including Dapr sidecar).
8.  **Cleanup:** Archive and submit.
