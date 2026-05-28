# OG-RMM Platform — Deployment Guide

**Version:** v54.0  
**Last Updated:** 2026-04-14  
**Platform:** Oil & Gas Remote Monitoring & Management

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Local Development](#local-development)
5. [Docker Compose (Full Stack)](#docker-compose-full-stack)
6. [Production Deployment](#production-deployment)
7. [Service Ports](#service-ports)
8. [Database Setup](#database-setup)
9. [Stripe Billing Setup](#stripe-billing-setup)
10. [PINN Surrogate Model](#pinn-surrogate-model)
11. [Rust Physics Engine](#rust-physics-engine)
12. [Monitoring & Health Checks](#monitoring--health-checks)
13. [CI/CD Pipeline](#cicd-pipeline)
14. [Rollback Procedure](#rollback-procedure)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    OG-RMM Platform v54.0                        │
├─────────────────┬──────────────────┬────────────────────────────┤
│  React 19 UI    │  Express/tRPC    │  Rust Physics Engine       │
│  (Vite + TS)    │  (Node.js 22)    │  (Axum, port 8000)         │
│  port 3000      │  port 3000       │                            │
├─────────────────┴──────────────────┼────────────────────────────┤
│  Python ML Service                 │  PostgreSQL (primary DB)   │
│  (FastAPI + PyTorch, port 8001)    │  Redis (cache/pub-sub)     │
│  PINN Surrogate with MC Dropout    │  InfluxDB (time-series)    │
└────────────────────────────────────┴────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x | Required for the main app |
| pnpm | 10.x | Package manager |
| Rust | 1.82+ | For physics engine |
| Python | 3.11+ | For ML service |
| Docker | 24+ | For containerized deployment |
| PostgreSQL | 14+ | Primary database |
| Redis | 7+ | Cache and pub-sub |

---

## Environment Variables

All environment variables are injected automatically when deployed on Manus. For self-hosted deployments, create a `.env` file:

```bash
# ─── Core ─────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000

# ─── Database ─────────────────────────────────────────────────────────────────
POSTGRES_URL=postgresql://ogrmm:ogrmm_secret@localhost:5432/ogrmm
REDIS_URL=redis://localhost:6379

# ─── Authentication (Manus OAuth) ─────────────────────────────────────────────
JWT_SECRET=your-32-char-minimum-jwt-secret-here
VITE_APP_ID=your-manus-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Your Name

# ─── Manus Built-in APIs ──────────────────────────────────────────────────────
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# ─── Stripe Billing ───────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── S3 Storage ───────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=og-rmm-platform

# ─── Services ─────────────────────────────────────────────────────────────────
PHYSICS_ENGINE_URL=http://localhost:8000
ML_SERVICE_URL=http://localhost:8001
PINN_MODEL_S3_KEY=models/pinn/latest.pt
PINN_VERSION_S3_KEY=models/pinn/versions.json

# ─── Push Notifications (VAPID) ───────────────────────────────────────────────
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

---

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Push database schema
pnpm db:push

# 3. Start the development server (Node.js + React)
pnpm dev

# 4. (Optional) Start Rust physics engine
cd services/physics-engine
cargo run

# 5. (Optional) Start Python ML service
cd services/ml-service
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload
```

The app will be available at `http://localhost:3000`.

---

## Docker Compose (Full Stack)

### Start all infrastructure services

```bash
# Start PostgreSQL, Redis, InfluxDB, Redpanda, MinIO
docker compose -f docker-compose.middleware.yml up -d

# Verify all services are healthy
docker compose -f docker-compose.middleware.yml ps
```

### Build and start all application services

```bash
# Build all images
docker compose build

# Start everything
docker compose up -d

# View logs
docker compose logs -f og-rmm-ui
docker compose logs -f physics-engine
docker compose logs -f ml-service
```

### Stop everything

```bash
docker compose down
docker compose -f docker-compose.middleware.yml down
```

---

## Production Deployment

### On Manus Platform (Recommended)

1. Click the **Publish** button in the Manus Management UI
2. All environment variables are automatically injected
3. The platform handles SSL, CDN, and scaling automatically

### Self-Hosted (Docker)

```bash
# 1. Build production image
docker build -t og-rmm-ui:v54.0 -f Dockerfile.ui .

# 2. Build physics engine
docker build -t og-rmm-physics:v54.0 ./services/physics-engine/

# 3. Build ML service
docker build -t og-rmm-ml:v54.0 ./services/ml-service/

# 4. Push to your registry
docker push your-registry/og-rmm-ui:v54.0
docker push your-registry/og-rmm-physics:v54.0
docker push your-registry/og-rmm-ml:v54.0

# 5. Deploy with docker compose
REGISTRY=your-registry docker compose up -d
```

---

## Service Ports

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| Main App (UI + API) | 3000 | HTTP | React + Express/tRPC |
| Rust Physics Engine | 8000 | HTTP | Axum REST API |
| Python ML Service | 8001 | HTTP | FastAPI + PINN |
| PostgreSQL | 5432 | TCP | Primary database |
| Redis | 6379 | TCP | Cache + pub-sub |
| InfluxDB | 8086 | HTTP | Time-series data |
| Redpanda | 9092 | TCP | Kafka-compatible |
| MinIO | 9000 | HTTP | S3-compatible storage |

---

## Database Setup

```bash
# Generate and apply migrations
pnpm db:push

# Seed with demo data (development only)
pnpm db:seed

# Connect to the database directly
psql $POSTGRES_URL

# Run SQL migrations manually
psql $POSTGRES_URL -f drizzle/migrations/0000_initial.sql
```

### Schema overview

The platform uses **Drizzle ORM** with a PostgreSQL database. Key tables:

- `users` — Manus OAuth users with role-based access
- `wells` — Well registry with coordinates and metadata
- `telemetry` — Real-time sensor readings (also mirrored to InfluxDB)
- `alarms` — Alarm events with severity and acknowledgment state
- `saas_subscriptions` — Stripe subscription records
- `saas_plans` — Available subscription tiers
- `pinn_models` — PINN model registry (DB-backed)
- `audit_logs` — Full audit trail for all user actions

---

## Stripe Billing Setup

### Test Mode (Sandbox)

1. Claim your Stripe sandbox at:  
   `https://dashboard.stripe.com/claim_sandbox/YWNjdF8xVExwZVBRSVM2RnFQemt0LDE3NzY3MTE2ODIv100iBVp90xl`  
   **Deadline: 2026-06-12**

2. Test with card: `4242 4242 4242 4242` (any future expiry, any CVC)

3. Subscription plans available:
   - **Starter** — $499/mo (up to 10 wells)
   - **Professional** — $1,499/mo (up to 50 wells)
   - **Enterprise** — $3,999/mo (unlimited wells)

### Webhook Setup

The webhook endpoint is at `/api/stripe/webhook`. Configure it in the Stripe Dashboard:

```
https://your-domain.com/api/stripe/webhook
```

Events to enable:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Go Live

1. Complete Stripe KYC verification
2. Update `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY` with live keys
3. Update `STRIPE_WEBHOOK_SECRET` with the live webhook secret
4. In Manus: **Settings → Payment** to configure live keys

---

## PINN Surrogate Model

The Physics-Informed Neural Network (PINN) surrogate runs in the Python ML service.

### Training a model

```bash
# Via the UI: AI Advanced → PINN Surrogate → Train (150 epochs)
# Or via API:
curl -X POST http://localhost:8001/pinn/train \
  -H "Content-Type: application/json" \
  -d '{"n_epochs": 150, "n_samples": 300, "lr": 0.001, "physics_weight": 0.1}'
```

### Saving to S3

```bash
# Via the UI: AI Advanced → PINN Surrogate → Save to S3
# Or via API:
curl -X POST http://localhost:8001/pinn/save \
  -H "Content-Type: application/json" \
  -d '{"s3_key": "models/pinn/latest.pt", "version_key": "models/pinn/versions.json"}'
```

### Auto-loading on startup

The server automatically attempts to load the latest PINN model from S3 on startup. Configure the S3 key via:

```bash
PINN_MODEL_S3_KEY=models/pinn/latest.pt
PINN_VERSION_S3_KEY=models/pinn/versions.json
```

---

## Rust Physics Engine

The physics engine provides multi-physics simulation for well performance analysis.

### Available endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/compute/nodal` | POST | Nodal analysis (IPR/VLP) |
| `/compute/geomechanics` | POST | 1D MEM geomechanics |
| `/compute/sand_onset` | POST | Sand onset critical drawdown |
| `/compute/coupled` | POST | Coupled multi-physics solve |
| `/compute/decline` | POST | Arps decline curve analysis |

### Building

```bash
cd services/physics-engine
cargo build --release
./target/release/physics-engine
```

### Docker

```bash
docker build -t og-rmm-physics:v54.0 ./services/physics-engine/
docker run -p 8000:8000 og-rmm-physics:v54.0
```

---

## Monitoring & Health Checks

### Application health

```bash
# Main app
curl http://localhost:3000/health

# Physics engine
curl http://localhost:8000/health

# ML service
curl http://localhost:8001/health
```

### Expected health response (main app)

```json
{
  "status": "ok",
  "version": "v54.0",
  "platform": "OG-RMM",
  "timestamp": "2026-04-14T10:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "physicsEngine": "reachable",
    "mlService": "reachable"
  }
}
```

### Logs

```bash
# Application logs
tail -f .manus-logs/devserver.log
tail -f .manus-logs/browserConsole.log
tail -f .manus-logs/networkRequests.log

# Docker logs
docker compose logs -f --tail=100
```

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

1. **TypeScript + Vitest** — type check and unit tests
2. **Build** — production build verification
3. **Rust tests** — `cargo test` for physics engine
4. **Python tests** — `pytest` for ML service
5. **E2E tests** — Playwright browser tests
6. **Trivy scan** — container vulnerability scanning
7. **Security audit** — `pnpm audit`
8. **Production gate** — runs `scripts/validate-production.sh` on `main` branch

---

## Rollback Procedure

### On Manus Platform

1. Open the Management UI → **Version History**
2. Click **Rollback** on the desired checkpoint
3. The platform restores the exact file system state

### Docker rollback

```bash
# List available image tags
docker images og-rmm-ui

# Roll back to a previous version
docker compose down
docker tag og-rmm-ui:v53.0 og-rmm-ui:latest
docker compose up -d
```

### Database rollback

> **Warning:** Database rollback is destructive. Always back up before rolling back.

```bash
# Restore from backup
pg_restore -d $POSTGRES_URL backup.dump
```

---

## Support

- **Platform documentation:** https://docs.manus.im
- **Issue tracker:** https://github.com/your-org/og-rmm-platform/issues
- **Stripe support:** https://dashboard.stripe.com/claim_sandbox/YWNjdF8xVExwZVBRSVM2RnFQemt0LDE3NzY3MTE2ODIv100iBVp90xl
- **Manus support:** https://help.manus.im
