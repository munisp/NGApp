# CRM Platform

Standalone Enterprise Banking CRM — a central hub for Core Banking, Agent Banking, and Remittance customer data management.

## Structure

```
crm-platform/
├── services/
│   ├── go/
│   │   ├── crm-services/         # Core CRM backend (Go)
│   │   │   ├── cmd/              # Entry point
│   │   │   ├── internal/
│   │   │   │   ├── analytics/    # Analytics service
│   │   │   │   ├── apikey/       # API key self-service
│   │   │   │   ├── banking/      # Core banking integration
│   │   │   │   ├── campaign/     # Campaign management & cross-sell
│   │   │   │   ├── churn/        # Churn prediction
│   │   │   │   ├── communication/# Multi-channel (WhatsApp, Telegram, SMS)
│   │   │   │   ├── consent/      # NDPR consent management
│   │   │   │   ├── crm/          # CRM profiles & models
│   │   │   │   ├── customer/     # Customer CRUD
│   │   │   │   ├── events/       # Event sourcing
│   │   │   │   ├── gamification/ # Agent gamification
│   │   │   │   ├── inventory/    # Inventory management
│   │   │   │   ├── journey/      # Journey orchestration (Temporal)
│   │   │   │   ├── lead/         # Lead management
│   │   │   │   ├── sandbox/      # Sandbox environment isolation
│   │   │   │   ├── sdk/          # SDK generation (OpenAPI)
│   │   │   │   ├── tenant/       # Multi-tenant service & middleware
│   │   │   │   └── webhook/      # Webhook HMAC signing & delivery
│   │   │   └── protos/           # Protobuf definitions
│   │   └── telephony/            # AI telephony (fraud verification calls)
│   ├── rust/
│   │   ├── bulk-sender/          # High-throughput campaign message engine
│   │   └── usage-metering/       # API quota tracking & billing
│   └── python/
│       └── campaign-analytics/   # Campaign ML analytics & revenue attribution
├── web/                          # React PWA frontend
│   ├── src/
│   │   ├── components/           # 30+ page components
│   │   ├── contexts/             # Auth, Tenant, Theme, Notification
│   │   └── services/             # Banking adapters & event bus
│   └── package.json
├── docs/                         # CRM-specific documentation
├── deploy/
│   ├── k8s/                      # Kubernetes manifests
│   └── docker/                   # Docker compose configs
└── config/                       # Configuration files
```

## Quick Start

### Frontend (React PWA)

```bash
cd crm-platform/web
npm install
npm run dev
# Open http://localhost:5173
```

### Backend (Go Services)

```bash
cd crm-platform/services/go/crm-services
go build ./cmd/...
```

### Rust Services

```bash
cd crm-platform/services/rust/bulk-sender
cargo build

cd crm-platform/services/rust/usage-metering
cargo build
```

### Python Services

```bash
cd crm-platform/services/python/campaign-analytics
pip install -r requirements.txt
python campaign_analytics_service.py
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Unified Dashboard** | Cross-system metrics from Core Banking, Agent Banking, Remittance |
| **Customer 360°** | Unified customer profiles with source tracking |
| **Multi-Tenant** | Product entitlements per tenant (4 seed tenants) |
| **Campaign Manager** | Outbound campaigns via WhatsApp, SMS, Telegram, Voice |
| **Developer Portal** | API Keys, Usage Metering, SDK Docs, Webhooks, Sandbox |
| **Churn Prevention** | ML-powered churn prediction with auto-trigger retention |
| **Journey Orchestrator** | Multi-step Temporal workflows |
| **Agent Gamification** | Leaderboards & incentives for field agents |
| **Compliance** | NDPR consent management & suppression lists |

## Multi-Tenant System

4 seed tenants with differentiated product access:

| Tenant | Products | Tier |
|--------|----------|------|
| Acme Microfinance | Core Banking, Agent Banking, Remittance, Payments, Merchant, Mobile Money | Enterprise |
| QuickCash Mobile | Agent Banking, Payments | Growth |
| SwiftRemit | Remittance, Payments | Enterprise |
| NextGen MFB | Core Banking, Agent Banking | Trial |

## Integration with Payment Core

The CRM connects to Payment Core services via:
- **APISIX Gateway** — JWT-authenticated API routes
- **Kafka Event Bus** — Real-time customer/transaction events
- **gRPC** — High-throughput service-to-service calls
- **Webhooks** — Push notifications with HMAC-SHA256 signing
