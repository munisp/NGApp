# OG RMM — Oil & Gas Remote Monitoring & Management Platform

> Enterprise-grade cloud-native platform for real-time monitoring, management, and financial settlement of oil and gas well operations.

---

## Architecture Overview

The platform is a **polyglot microservices monorepo** organized into four technology layers, each chosen for its strengths in the oil and gas operational domain.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATOR DASHBOARD (TypeScript/React)                │
│   Overview · Wells · Alarms · Field Map · Analytics · ML Insights · Financials │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ REST / WebSocket
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                    API GATEWAY (Go · Chi · JWT/Keycloak)                    │
│              Rate limiting · Auth · WebSocket hub · Service proxy           │
└──┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┘
   │              │              │              │              │
   ▼              ▼              ▼              ▼              ▼
Well Mgmt    Telemetry      Financial      Alarm Mgr     Analytics
(Go)         Ingestion      Ledger         (Go +         (Python)
             (Go)           (Go +          Temporal)
                            TigerBeetle)
   │              │                              │
   ▼              ▼                              ▼
PostgreSQL   InfluxDB +                    ML Pipeline
(primary)    Redpanda                      (Python +
             (Kafka)                       XGBoost/LSTM)
                │
                ▼
         Stream Processor
         (Rust · Tokio)
                │
                ▼
          Edge Agent
          (Rust · MQTT/Fluvio)
                │
                ▼
         Well RTUs / SCADA
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **UI** | TypeScript · React 19 · Recharts · Google Maps | Operator dashboard |
| **API Gateway** | Go · Chi · JWT/Keycloak · WebSocket | Auth, routing, real-time |
| **Well Management** | Go · pgx/v5 · PostgreSQL | Well registry, production data |
| **Telemetry Ingestion** | Go · InfluxDB v2 · Redpanda | Sensor data pipeline |
| **Financial Ledger** | Go · TigerBeetle · Mojaloop | Double-entry accounting, royalties |
| **Alarm Manager** | Go · Temporal · Redis | Alarm lifecycle, workflows |
| **Edge Agent** | Rust · Tokio · Rumqttc · Fluvio | MQTT/SCADA bridge |
| **Stream Processor** | Rust · Tokio · rdkafka · DataFusion | Real-time telemetry processing |
| **Analytics Service** | Python · FastAPI · DuckDB · Delta Lake | Lakehouse queries, KPIs |
| **ML Pipeline** | Python · XGBoost · LSTM · Scikit-learn | ESP failure prediction, anomaly detection |
| **Primary Database** | **PostgreSQL 16** (TimescaleDB + PostGIS) | All relational data |
| **Time-Series** | InfluxDB 2.7 | High-frequency sensor readings |
| **Message Bus** | Redpanda (Kafka-compatible) | Event streaming |
| **Workflow Engine** | Temporal 1.24 | Durable alarm workflows |
| **Cache / Pub-Sub** | Redis 7 | Session cache, real-time pub-sub |
| **Object Storage** | MinIO (S3-compatible) | Lakehouse Delta tables, models |
| **MQTT Broker** | Eclipse Mosquitto 2.0 | Well RTU/SCADA connectivity |

---

## Repository Structure

```
og-rmm-platform/
├── client/                          # TypeScript/React UI
│   └── src/
│       ├── pages/
│       │   ├── Overview.tsx         # Main operations dashboard
│       │   ├── Wells.tsx            # Well fleet list & search
│       │   ├── WellDetail.tsx       # Per-well sensor readings & history
│       │   ├── Alarms.tsx           # Alarm management & acknowledgment
│       │   ├── Map.tsx              # Geospatial field map (Google Maps)
│       │   ├── Analytics.tsx        # Production analytics & KPIs
│       │   ├── MLInsights.tsx       # ESP predictions & anomaly detection
│       │   └── Financials.tsx       # Revenue, royalties, TigerBeetle ledger
│       ├── components/
│       │   └── layout/
│       │       └── DashboardLayout.tsx
│       └── lib/
│           └── mock-data.ts         # Realistic mock data layer
│
├── services/
│   ├── go/
│   │   ├── api-gateway/             # HTTP gateway, JWT auth, WebSocket hub
│   │   ├── well-management/         # Well CRUD, production data, field registry
│   │   ├── telemetry-ingestion/     # Sensor data ingest → InfluxDB + Kafka
│   │   ├── financial-ledger/        # TigerBeetle double-entry, Mojaloop royalties
│   │   ├── alarm-manager/           # Alarm processor, Temporal workflows
│   │   └── workflow-engine/         # Temporal activity workers
│   │
│   ├── rust/
│   │   ├── edge-agent/              # MQTT/Fluvio → Kafka bridge (Tokio async)
│   │   ├── stream-processor/        # Real-time telemetry processing (rdkafka)
│   │   └── datafusion-query/        # Apache DataFusion query engine
│   │
│   └── python/
│       ├── analytics-service/       # FastAPI · DuckDB · Delta Lake lakehouse
│       └── ml-pipeline/             # XGBoost + LSTM ESP failure prediction
│
├── infra/
│   ├── postgres/
│   │   └── init.sql                 # Full schema: wells, telemetry, alarms,
│   │                                #   financials, ml, audit (TimescaleDB + PostGIS)
│   ├── redpanda/
│   │   └── console-config.yml
│   ├── mosquitto/
│   │   └── mosquitto.conf
│   └── temporal/
│       └── dynamicconfig/
│
├── docker-compose.yml               # Full platform orchestration
├── Dockerfile.ui                    # UI production build
└── README.md
```

---

## Go Microservices

### API Gateway (`services/go/api-gateway`)

The gateway is the single entry point for all external traffic. It handles JWT verification against Keycloak, rate limiting via Redis, request routing to downstream services, and a WebSocket hub for real-time alarm streaming to the dashboard.

**Key packages:** `chi` (router), `golang-jwt/jwt`, `gorilla/websocket`, `go-redis/redis`

**Endpoints:**
- `GET /health` — liveness probe
- `POST /api/v1/auth/token` — token exchange
- `GET /api/v1/wells/**` — proxied to well-management
- `POST /api/v1/telemetry/**` — proxied to telemetry-ingestion
- `GET /api/v1/alarms/**` — proxied to alarm-manager
- `GET /api/v1/financials/**` — proxied to financial-ledger
- `WS /ws` — real-time alarm and telemetry stream

### Well Management (`services/go/well-management`)

Manages the complete well registry including fields, wells, ESP configurations, and daily production records. Uses PostgreSQL with `pgx/v5` for type-safe queries and connection pooling.

**PostgreSQL tables:** `wells.fields`, `wells.wells`, `wells.esp_configurations`, `wells.production_daily` (TimescaleDB hypertable)

### Telemetry Ingestion (`services/go/telemetry-ingestion`)

High-throughput sensor data ingestion service. Accepts batched readings from SCADA systems, writes to InfluxDB for time-series storage, and publishes to Redpanda for downstream stream processing.

**Data flow:** SCADA → HTTP POST → InfluxDB (raw) + Redpanda (`og.telemetry.raw`)

### Financial Ledger (`services/go/financial-ledger`)

Implements double-entry bookkeeping using **TigerBeetle** as the authoritative ledger engine, with PostgreSQL storing the business-level transaction metadata. Integrates with **Mojaloop** for automated royalty settlement payments to state, federal, and private mineral rights holders.

**TigerBeetle accounts:** One account per well per currency, with debit/credit enforced at the ledger level for zero-balance guarantees.

### Alarm Manager (`services/go/alarm-manager`)

Processes alarm events from Redpanda, evaluates against configurable thresholds, and orchestrates alarm lifecycle through **Temporal** durable workflows. Supports acknowledgment, suppression, shelving, and auto-clear policies.

---

## Rust Services

### Edge Agent (`services/rust/edge-agent`)

An async Rust agent (Tokio runtime) that bridges field SCADA/RTU devices to the cloud platform. Supports MQTT (via `rumqttc`) and Fluvio streaming. Performs local buffering, protocol normalization, and TLS-secured upstream delivery to Redpanda.

**Crates:** `tokio`, `rumqttc`, `rdkafka`, `serde_json`, `tracing`

### Stream Processor (`services/rust/stream-processor`)

Real-time Kafka consumer that processes the `og.telemetry.raw` topic. Applies configurable alarm threshold evaluation, statistical outlier detection (Z-score, IQR), and publishes processed readings to `og.telemetry.processed` and alarm events to `og.alarms.raw`.

**Crates:** `rdkafka`, `tokio`, `statrs`, `serde`

### DataFusion Query Engine (`services/rust/datafusion-query`)

Exposes an Apache DataFusion query interface over Delta Lake tables stored in MinIO. Enables ad-hoc SQL analytics over the lakehouse without moving data to PostgreSQL.

---

## Python Services

### Analytics Service (`services/python/analytics-service`)

FastAPI service providing production analytics, KPI computation, and lakehouse queries. Uses **DuckDB** for in-process OLAP queries over Delta Lake Parquet files in MinIO, and **Apache Sedona** for geospatial analytics (well proximity, drainage area analysis).

**Endpoints:** `/api/v1/production/summary`, `/api/v1/kpi/fleet`, `/api/v1/geospatial/wells`, `/api/v1/lakehouse/query`

### ML Pipeline (`services/python/ml-pipeline`)

Implements the ESP failure prediction model using an **XGBoost + LSTM ensemble**. Features include vibration RMS, current imbalance, motor temperature deviation, frequency drift, and cumulative run hours. The anomaly detection module uses **Isolation Forest** for multivariate sensor anomalies.

**Model performance (validation set):**

| Metric | Value |
|---|---|
| Precision | 89.1% |
| Recall | 84.7% |
| F1 Score | 86.8% |
| AUC-ROC | 92.3% |
| False Positive Rate | 8.9% |

---

## PostgreSQL Schema Design

The database uses **PostgreSQL 16** with the following extensions:

- **TimescaleDB** — automatic time-series partitioning for `production_daily` and `telemetry.readings`
- **PostGIS** — geospatial indexing for well locations and field polygons
- **pg_stat_statements** — query performance monitoring

**Schemas:**

| Schema | Tables | Purpose |
|---|---|---|
| `wells` | `fields`, `wells`, `esp_configurations`, `production_daily` | Well registry and production |
| `telemetry` | `sensors`, `readings`, `readings_hourly` (continuous aggregate) | Sensor metadata and data |
| `alarms` | `alarm_definitions`, `alarms` | Alarm configuration and events |
| `financials` | `accounts`, `transactions`, `royalty_obligations`, `settlements` | Financial ledger |
| `ml` | `models`, `predictions`, `anomaly_events` | ML model registry and outputs |
| `audit` | `events` | Full audit trail |

Row-Level Security (RLS) is enabled on sensitive tables with service-role bypass policies for microservice access.

---

## Getting Started

### Prerequisites

- Docker 24+ and Docker Compose v2
- 16 GB RAM recommended (all services)
- 20 GB free disk space

### Quick Start

```bash
# Clone the repository
git clone https://github.com/apex-energy/og-rmm-platform
cd og-rmm-platform

# Copy and configure environment
cp config/config.example.yaml config/config.yaml
# Edit config.yaml with your credentials

# Start the full platform
docker compose up -d

# Wait for health checks (approx. 60 seconds)
docker compose ps

# Access services
# UI Dashboard:       http://localhost:3000
# API Gateway:        http://localhost:8000
# Redpanda Console:   http://localhost:8080
# Temporal UI:        http://localhost:8088
# InfluxDB:           http://localhost:8086
# MinIO Console:      http://localhost:9001
```

### Development Mode

```bash
# Start only infrastructure
docker compose up -d postgres redis influxdb redpanda mosquitto

# Run Go services locally
cd services/go/api-gateway && go run ./cmd/main.go
cd services/go/well-management && go run ./cmd/main.go

# Run Rust services locally
cd services/rust/stream-processor && cargo run

# Run Python services locally
cd services/python/analytics-service
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8005

# Run UI locally
pnpm dev
```

---

## Kafka Topics

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `og.telemetry.raw` | Edge Agent, Telemetry Ingestion | Stream Processor | Raw sensor readings |
| `og.telemetry.processed` | Stream Processor | Analytics, ML Pipeline | Normalized readings |
| `og.alarms.raw` | Stream Processor | Alarm Manager | Threshold breach events |
| `og.alarms.processed` | Alarm Manager | API Gateway (WebSocket) | Enriched alarm events |
| `og.production.daily` | Well Management | Analytics, Financial Ledger | Daily production records |
| `og.financial.transactions` | Financial Ledger | Audit Service | Transaction events |
| `og.ml.predictions` | ML Pipeline | Alarm Manager, UI | ESP failure predictions |

---

## Security

- **Authentication:** Keycloak OIDC with JWT bearer tokens; role-based access (Operator, Engineer, Manager, Admin)
- **Authorization:** Row-Level Security in PostgreSQL; API-level RBAC in the gateway
- **Transport:** TLS 1.3 on all external endpoints; mTLS between services in production
- **Secrets:** HashiCorp Vault integration for production credential management
- **Audit:** All data mutations recorded in `audit.events` with user identity and IP address

---

## Monitoring & Observability

- **Metrics:** Prometheus exporters on all services; Grafana dashboards
- **Tracing:** OpenTelemetry with Jaeger backend
- **Logging:** Structured JSON logs (zerolog in Go, tracing in Rust, structlog in Python)
- **Alerting:** Alertmanager → PagerDuty / OpsGenie integration

---

## License

Copyright © 2026 Apex Energy Operations. All rights reserved.

---

## Changelog

### v55.0 (2026-04-14)
- **Production Landing Page** — full-featured Home.tsx with feature grid, stats, and CTA
- **Coupled Multi-Physics Solver** — Rust `/compute/coupled` endpoint (nodal + 1D MEM + sand-onset in one pass)
- **PINN Surrogate AI** — 5-layer MLP with MC Dropout, physics residual loss, 7 outputs with 95% CI
- **PINN S3 Persistence** — save/load/versions endpoints; auto-load on server startup
- **EquipmentViewer3D** — glTF/PBR 3D viewer with live telemetry overlays (5 procedural models)
- **Digital Twin v42** — Coupled Solver tab (IPR/VLP chart), PINN Surrogate tab, Equipment 3D tab
- **Well KPI Dashboard** — PINN Uncertainty tab with 95% CI bands for all 6 wells
- **Data Export Center** — CSV/JSON export for production, alarms, KPI, audit log, physics results
- **PINN Model Management UI** — save/load/versions in AiAdvanced page
- **Rust Dockerfile** — multi-stage production build for physics-engine service
- **GitHub Actions CI** — Rust, Python, and Docker build jobs added
- **DEPLOYMENT.md** — comprehensive Kubernetes and Docker deployment guide
- **docker-compose.yml** — physics-engine port fixed (4001 HTTP), PINN torch added to requirements
- **All version strings** — APP_VERSION=v55.0, MODEL_VERSION=og-physics-55.0.0

### v54.0 (2026-04-13)
- EquipmentViewer3D tab wired into Digital Twin v42
- PINN S3 auto-load on startup
- PINN model management UI in AiAdvanced page
- Regulatory report download implemented
- docker-compose.yml path fixed (physics-engine-rust → physics-engine)
- All 70+ routes verified against DashboardLayout nav

### v53.0 (2026-04-12)
- Coupled multi-physics Rust solver (initial)
- PINN surrogate ML service (initial)
- PINN S3 persistence endpoints
- tRPC pinnRouter (predict, train, status, saveModel, loadModel, modelVersions)
- IPR/VLP ComposedChart in Coupled Solver tab
- PINN Uncertainty tab in Well KPI Dashboard
- Data Export router and page
- Production constants (APP_VERSION, physicsUrl, mlUrl, pinnS3Key)
