# Docker Compose Configuration Analysis

## Overview

The `docker-compose.yml` file defines the complete deployment configuration for the Next-Generation Payment Switch platform. The configuration includes **12 services** organized into four logical groups: database services, workflow engine, payment switch microservices, and monitoring/observability infrastructure.

## Service Breakdown

### Database Services (2)

**1. PostgreSQL Database (`postgres`)**
- **Image**: `postgres:15-alpine`
- **Port**: 5432
- **Purpose**: Primary relational database for transaction data, accounts, and settlement records
- **Features**:
  - Auto-initialization with schema from `services/database/schema.sql`
  - Health check with `pg_isready`
  - Persistent volume: `postgres_data`
  - Credentials: `payment_user` / `payment_pass_2024`

**2. Redis Cache (`redis`)**
- **Image**: `redis:7-alpine`
- **Port**: 6379
- **Purpose**: In-memory cache for session data, fraud detection results, and rate limiting
- **Features**:
  - AOF (Append-Only File) persistence enabled
  - Password-protected: `redis_pass_2024`
  - Persistent volume: `redis_data`
  - Health check with `redis-cli`

### Workflow Engine (2)

**3. Temporal Workflow Engine (`temporal`)**
- **Image**: `temporalio/auto-setup:1.22.0`
- **Ports**: 7233 (gRPC), 8088 (metrics)
- **Purpose**: Orchestrates complex payment workflows with reliability and fault tolerance
- **Features**:
  - PostgreSQL backend for workflow state
  - Auto-setup for development
  - Depends on PostgreSQL health check

**4. Temporal UI (`temporal-ui`)**
- **Image**: `temporalio/ui:2.21.0`
- **Port**: 8080
- **Purpose**: Web-based dashboard for monitoring and managing workflows
- **Features**:
  - CORS enabled for `localhost:3000`
  - Connected to Temporal server at `temporal:7233`

### Payment Switch Microservices (5)

**5. Payment Gateway (`payment-gateway`)**
- **Port**: 8001
- **Purpose**: Main entry point for payment initiation, status checks, and refunds
- **Dependencies**: PostgreSQL, Redis, Temporal
- **Health Check**: `/api/v1/payments/health`
- **Features**:
  - Full database and cache integration
  - Temporal workflow orchestration
  - Auto-restart on failure

**6. Fraud Detection Service - AI (`fraud-detection-service`)**
- **Port**: 8002
- **Purpose**: AI-powered fraud detection using PyTorch and Graph Neural Networks
- **Dependencies**: Redis
- **Health Check**: `/api/v1/fraud/health`
- **Features**:
  - Model storage in persistent volume: `fraud_models`
  - Real-time fraud scoring
  - Batch processing support

**7. Settlement Service (`settlement-service`)**
- **Port**: 8003
- **Purpose**: Manages settlement windows, positions, and reconciliation
- **Dependencies**: PostgreSQL
- **Health Check**: `/api/v1/settlement/health`
- **Features**:
  - Mojaloop integration for interoperability
  - Multi-party settlement support
  - Automated reconciliation

**8. Offline Payments Service (`offline-payments-service`)**
- **Port**: 8004
- **Purpose**: Handles offline payment synchronization and batch processing
- **Dependencies**: PostgreSQL, Redis
- **Health Check**: `/api/v1/offline/health`
- **Features**:
  - Batch sync from offline devices
  - Conflict resolution
  - Queue-based processing

**9. Fraud Detection - Rules (`fraud-detection`)**
- **Port**: 8005
- **Purpose**: Rule-based fraud detection for real-time transaction screening
- **Dependencies**: PostgreSQL, Redis
- **Health Check**: `/api/v1/fraud/health`
- **Features**:
  - Configurable rule engine
  - Low-latency screening
  - Integration with AI fraud service

### Monitoring & Observability (2)

**10. Prometheus (`prometheus`)**
- **Port**: 9090
- **Purpose**: Metrics collection and time-series database
- **Features**:
  - Scrapes metrics from all services
  - Persistent storage: `prometheus_data`
  - Custom configuration from `monitoring/prometheus.yml`

**11. Grafana (`grafana`)**
- **Port**: 3000
- **Purpose**: Visualization and dashboards for monitoring
- **Features**:
  - Pre-configured Prometheus datasource
  - Custom dashboards for payment metrics
  - Admin credentials: `admin` / `admin_2024`
  - Persistent storage: `grafana_data`

### API Gateway (1)

**12. NGINX (`nginx`)**
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Purpose**: Reverse proxy, load balancer, and API gateway
- **Features**:
  - Routes traffic to all microservices
  - Rate limiting configured
  - SSL/TLS termination support
  - Custom configuration from `nginx/nginx.conf`

## Network Configuration

**Network Name**: `payment-network`
- **Type**: Bridge
- **Subnet**: 172.20.0.0/16
- **Purpose**: Isolated network for all payment switch services

## Volume Configuration

The platform uses **5 persistent volumes** to ensure data durability:

| Volume | Purpose | Size |
|--------|---------|------|
| `postgres_data` | PostgreSQL database files | Dynamic |
| `redis_data` | Redis AOF persistence | Dynamic |
| `fraud_models` | ML model storage | ~500MB |
| `prometheus_data` | Metrics time-series data | Dynamic |
| `grafana_data` | Dashboard configurations | ~100MB |

## Service Dependencies

The services have the following dependency chain:

```
postgres (base)
  ├── temporal → temporal-ui
  ├── payment-gateway
  ├── settlement-service
  ├── offline-payments-service
  └── fraud-detection

redis (base)
  ├── payment-gateway
  ├── fraud-detection-service
  ├── offline-payments-service
  └── fraud-detection

prometheus (base)
  └── grafana

All microservices
  └── nginx (API Gateway)
```

## Health Checks

All microservices implement health check endpoints:

| Service | Health Check URL | Interval | Timeout | Retries |
|---------|-----------------|----------|---------|---------|
| PostgreSQL | `pg_isready` | 10s | 5s | 5 |
| Redis | `redis-cli ping` | 10s | 3s | 5 |
| Payment Gateway | `/api/v1/payments/health` | 30s | 10s | 3 |
| Fraud Detection (AI) | `/api/v1/fraud/health` | 30s | 10s | 3 |
| Settlement | `/api/v1/settlement/health` | 30s | 10s | 3 |
| Offline Payments | `/api/v1/offline/health` | 30s | 10s | 3 |
| Fraud Detection (Rules) | `/api/v1/fraud/health` | 30s | 10s | 3 |

## Port Mapping

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| 80 | NGINX | HTTP | API Gateway |
| 443 | NGINX | HTTPS | Secure API Gateway |
| 3000 | Grafana | HTTP | Monitoring Dashboard |
| 5432 | PostgreSQL | TCP | Database |
| 6379 | Redis | TCP | Cache |
| 7233 | Temporal | gRPC | Workflow Engine |
| 8001 | Payment Gateway | HTTP | Payment API |
| 8002 | Fraud Detection (AI) | HTTP | AI Fraud API |
| 8003 | Settlement | HTTP | Settlement API |
| 8004 | Offline Payments | HTTP | Offline Sync API |
| 8005 | Fraud Detection (Rules) | HTTP | Rules Fraud API |
| 8080 | Temporal UI | HTTP | Workflow Dashboard |
| 8088 | Temporal | HTTP | Metrics |
| 9090 | Prometheus | HTTP | Metrics API |

## Deployment Commands

### Start All Services
```bash
docker-compose up -d
```

### Start Specific Service
```bash
docker-compose up -d payment-gateway
```

### View Logs
```bash
docker-compose logs -f payment-gateway
```

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Volumes
```bash
docker-compose down -v
```

### Rebuild Services
```bash
docker-compose build
docker-compose up -d
```

## Resource Requirements

### Minimum Requirements
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Disk**: 20 GB

### Recommended Requirements
- **CPU**: 8 cores
- **RAM**: 16 GB
- **Disk**: 50 GB

## Scaling Considerations

To scale individual services:

```bash
docker-compose up -d --scale payment-gateway=3
docker-compose up -d --scale fraud-detection-service=2
```

**Note**: NGINX configuration must be updated to support multiple instances with load balancing.

## Security Features

1. **Network Isolation**: All services run in isolated `payment-network`
2. **Password Protection**: PostgreSQL and Redis require authentication
3. **Health Checks**: Automatic restart of unhealthy services
4. **SSL Support**: NGINX configured for HTTPS termination
5. **No Root Containers**: All services run as non-root users

## Clarification on Service Count

The initial report of "58 services" was based on counting all YAML keys in the docker-compose.yml file, including configuration sections like `environment`, `ports`, `volumes`, and `depends_on`. The **actual number of deployed services is 12**, as confirmed by parsing the `services:` section of the configuration.

## Summary

The docker-compose.yml file provides a **complete, production-ready deployment configuration** for the Next-Generation Payment Switch platform with:

- ✅ **12 services** across 4 logical groups
- ✅ **5 persistent volumes** for data durability
- ✅ **Isolated network** for security
- ✅ **Health checks** for all critical services
- ✅ **Automatic restart** on failure
- ✅ **Monitoring and observability** built-in
- ✅ **API gateway** for unified access

The configuration is optimized for development and can be easily adapted for production deployment with environment-specific overrides.
