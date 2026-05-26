# OG-RMM Platform — Production Deployment Guide

## Platform Overview

The **OG-RMM Platform** (Oil & Gas Remote Monitoring & Management) is a 7-tier enterprise-grade SCADA/IIoT platform for upstream and midstream oil and gas operations. It provides real-time telemetry, predictive analytics, regulatory compliance, digital twin visualization, and AI-powered optimization.

---

## Architecture Summary

| Layer | Technology | Purpose |
|---|---|---|
| **Web App** | React 19 + tRPC 11 + Tailwind 4 | PWA dashboard (68 pages) |
| **API Server** | Node.js + Express + tRPC | 49 routers, REST + WebSocket |
| **Database** | PostgreSQL 16 | 98 tables, Drizzle ORM |
| **Cache** | Redis 7 | Session, rate limiting, pub/sub |
| **Message Bus** | Redpanda (Kafka-compatible) | Telemetry ingestion, event streaming |
| **Time-Series** | InfluxDB 2 + TDengine | Sensor historian (millions of points/day) |
| **Stream Processing** | Fluvio | Real-time telemetry processing |
| **Workflow Engine** | Temporal | Long-running workflows, scheduling |
| **Identity** | Keycloak 24 | SSO, RBAC, OAuth2/OIDC |
| **API Gateway** | APISIX 3.9 | Rate limiting, auth, routing |
| **Observability** | Jaeger + OTel Collector + Grafana | Distributed tracing, metrics |
| **Object Storage** | MinIO (S3-compatible) | Documents, drone media, reports |
| **Microservices** | 8 Go services + 3 Python + 2 Rust | Domain-specific processing |
| **Mobile** | React Native + Flutter | iOS/Android companion apps |

---

## Quick Start

### Prerequisites

- Docker 24+ and Docker Compose 2.20+
- Node.js 22+ and pnpm 10+
- Go 1.22+ (for microservices)
- Python 3.11+ (for ML/analytics services)
- Rust 1.78+ (for physics engine)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/og-rmm-platform.git
cd og-rmm-platform
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Infrastructure

```bash
# Core services (database, cache, message bus)
docker compose --profile core up -d

# Observability stack (Jaeger, OTel, Grafana)
docker compose --profile observability up -d

# API Gateway (APISIX)
docker compose --profile gateway up -d

# Identity (Keycloak)
docker compose --profile auth up -d

# AI services (Ollama/Qwen)
docker compose --profile ai up -d
```

### 4. Run Database Migrations

```bash
pnpm db:push
```

### 5. Start Development Server

```bash
pnpm dev
```

The platform will be available at `http://localhost:3000`.

---

## Environment Variables

### Required for Production

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | Session signing secret (min 32 chars) |
| `VITE_APP_ID` | — | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` | OAuth portal URL |

### Payment Providers

| Variable | Default | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | — | Stripe secret key (sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLISHABLE_KEY` | — | Stripe publishable key (pk_live_...) |
| `PAYPAL_CLIENT_ID` | — | PayPal OAuth2 client ID |
| `PAYPAL_CLIENT_SECRET` | — | PayPal OAuth2 client secret |
| `PAYPAL_ENVIRONMENT` | `sandbox` | `sandbox` or `production` |

### Email (Optional)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `ALARM_ESCALATION_EMAILS` | — | Comma-separated escalation recipients |

### Messaging & Streaming

| Variable | Default | Description |
|---|---|---|
| `KAFKA_BROKERS` | `localhost:9092` | Redpanda/Kafka broker addresses |
| `KAFKA_TOPIC_TELEMETRY` | `og-telemetry` | Telemetry ingestion topic |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB URL |
| `INFLUXDB_TOKEN` | `og-rmm-influx-token` | InfluxDB API token |
| `INFLUXDB_ORG` | `og-rmm` | InfluxDB organization |
| `INFLUXDB_BUCKET` | `telemetry` | InfluxDB bucket |

### AI & ML Services

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `llama3.2` | Default Ollama model |
| `OLLAMA_VISION_MODEL` | `qwen2.5-vl:7b` | Vision model for drone AI |
| `BUILT_IN_FORGE_API_URL` | — | Manus built-in LLM API URL |
| `BUILT_IN_FORGE_API_KEY` | — | Manus built-in LLM API key |

### Observability

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTel collector gRPC endpoint |
| `OTEL_SERVICE_NAME` | `og-rmm-app` | Service name for traces |
| `JAEGER_UI_URL` | `http://localhost:16686` | Jaeger UI URL |

### External Integrations

| Variable | Default | Description |
|---|---|---|
| `PI_SERVER_URL` | `https://pi-server.example.com` | OSIsoft PI Server URL |
| `PI_USERNAME` | — | PI Server username |
| `PI_PASSWORD` | — | PI Server password |
| `OSDU_BASE_URL` | `https://osdu.example.com/api` | OSDU R3 API base URL |
| `OSDU_CLIENT_ID` | — | OSDU OAuth client ID |
| `SAP_BASE_URL` | `https://sap.example.com:8443` | SAP PM API URL |
| `MAXIMO_BASE_URL` | `https://maximo.example.com/maximo` | IBM Maximo API URL |

---

## 7-Tier Feature Matrix

### Tier 1 — Core SCADA & Monitoring
- Real-time telemetry ingestion (MQTT, OPC-UA, Modbus, HART)
- ISA-18.2 alarm management with escalation
- Well, field, and equipment monitoring
- Production allocation and targets
- **IEC 62443** cybersecurity compliance framework
- **SIL 2** functional safety assessment (HIPPS/EDP)
- **SOC 2** audit trail with TSC mapping

### Tier 2 — Data Historian & Analytics
- QuestDB/TimescaleDB time-series historian
- Continuous aggregate tuning
- InfluxDB 2 integration
- TDengine ultra-high-frequency data
- Recharts-powered trend visualization

### Tier 3 — Digital Twin
- Three.js 3D asset visualization
- Unreal Engine Pixel Streaming FPSO twin
- Real-time sensor overlay on 3D models
- Asset health scoring

### Tier 4 — AI & Machine Learning
- **PINN** (Physics-Informed Neural Networks) well performance models
- **Agentic AI** workflow automation
- **Federated learning** framework for multi-operator collaboration
- OpenSTEF production forecasting
- Anomaly detection (Isolation Forest + LSTM)
- AI Copilot with streaming LLM responses

### Tier 5 — Enterprise Integrations
- **OSDU R3** full compliance (datasets, schemas, search)
- **OPC-UA** server mode + client subscriptions
- **WITSML 2.0** well data adapter
- **PRODML** production data adapter
- **SAP PM** work order integration
- **IBM Maximo** CMMS integration
- OSIsoft PI Connector
- Fledge IoT gateway

### Tier 6 — Advanced Operations
- Production allocation engine (Muskat/Vogel/Fetkovich IPR)
- Reservoir simulation job management
- Emissions/carbon accounting (Scope 1/2/3, EPA Subpart W)
- Drone inspection management with AI defect detection
- Wellbore integrity and geomechanics
- Sand and mud management
- Heavy oil optimization

### Tier 7 — SaaS & Platform
- White-label multi-tenant SaaS
- **Stripe** subscription billing with webhooks
- **PayPal** payment integration
- Bank transfer payment option
- Analytics plugin marketplace
- Tenant isolation and RBAC

---

## Microservices

| Service | Language | Port | Protocol | Description |
|---|---|---|---|---|
| `telemetry-ingestion` | Go | 4000 | gRPC + Kafka | MQTT/OPC-UA/Modbus ingestion |
| `alarm-engine` | Go | 4001 | gRPC + Kafka | ISA-18.2 alarm processing |
| `analytics-service` | Go | 4002 | gRPC | Production analytics |
| `ml-service` | Python | 4003 | REST | OpenSTEF + Ollama AI |
| `physics-engine` | Rust | 50051 | gRPC | IPR/VLP/Nodal analysis |
| `dataplane` | Go | 50052 | gRPC | Kafka consumer + data routing |
| `erp-connector` | Go | 4004 | REST | SAP PM + Maximo integration |
| `edgex-device-service` | Go | 4005 | REST | EdgeX Foundry device service |

---

## Middleware Stack

| Component | Version | Purpose |
|---|---|---|
| **Kafka/Redpanda** | 3.x | Event streaming, telemetry bus |
| **Dapr** | 1.13 | Service mesh, pub/sub, state |
| **Fluvio** | 0.x | Real-time stream processing |
| **Temporal** | 1.x | Workflow orchestration |
| **Keycloak** | 24 | Identity, SSO, RBAC |
| **Permify** | 0.x | Fine-grained authorization |
| **Redis** | 7 | Cache, sessions, rate limiting |
| **APISIX** | 3.9 | API gateway, rate limiting |
| **TigerBeetle** | 0.x | Financial-grade ledger |
| **Lakehouse** | Delta Lake | Analytics data lake |

---

## Production Deployment

### Kubernetes

```bash
# Apply namespace and secrets
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets-template.yaml  # Edit first!

# Deploy application
kubectl apply -f k8s/app-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Deploy microservices
kubectl apply -f k8s/microservices.yaml
```

### Docker Compose (Single Node)

```bash
# Full production stack
docker compose --profile production up -d

# Check health
docker compose ps
```

---

## Monitoring & Observability

| Service | URL | Credentials |
|---|---|---|
| **Grafana** | http://localhost:3002 | admin / og_rmm_grafana |
| **Jaeger** | http://localhost:16686 | — |
| **Prometheus** | http://localhost:9090 | — |
| **APISIX Dashboard** | http://localhost:9180 | admin / edd1c9f034335f136f87ad84b625c8f1 |
| **Keycloak** | http://localhost:8081 | admin / og_rmm_keycloak_admin |
| **Redpanda Console** | http://localhost:8080 | — |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin |
| **Temporal UI** | http://localhost:8088 | — |

---

## Testing

```bash
# Unit tests (93 tests)
pnpm test

# Integration tests
pnpm test:integration

# Load tests (requires k6)
pnpm test:load

# TypeScript check
npx tsc --noEmit
```

---

## Security

- All service-to-service communication uses **mTLS** (certificates in `services/go/mtls/`)
- API rate limiting: 200 req/min (API), 20 req/min (auth endpoints)
- **IEC 62443** security zones enforced at network level
- **SOC 2** audit trail for all user actions
- Secrets managed via Kubernetes Secrets or environment variables
- Never commit `.env` files — use `.env.example` as template

---

## Support

- Platform documentation: `/docs`
- API reference: `/api/docs` (Swagger UI)
- Health check: `/api/health`
- Metrics: `/api/metrics` (Prometheus format)
- Version info: `/api/version`
