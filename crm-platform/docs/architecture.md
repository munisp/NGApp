# CRM Platform Architecture

## System Overview

```
                    ┌─────────────┐
                    │   APISIX    │
                    │  Gateway    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  React PWA │ │Mobile │ │  SDK/API  │
        │  (Vite)    │ │Flutter│ │  Clients  │
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              └────────────┼────────────┘
                           │
                    ┌──────┴──────┐
                    │  Keycloak   │
                    │  OIDC Auth  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
   │  Go (8)   │    │ Python(14)│    │  Rust (9) │
   │  Services │    │ Services  │    │  Services │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                │                │
   ┌─────┴────────────────┴────────────────┴─────┐
   │              Middleware Layer                 │
   │  Kafka │ Dapr │ Redis │ Temporal │ Fluvio   │
   └─────┬────────────────┬────────────────┬─────┘
         │                │                │
   ┌─────┴─────┐    ┌─────┴─────┐    ┌───┴─────┐
   │ PostgreSQL │    │OpenSearch │    │TigerBtle│
   │ (primary)  │    │ (search)  │    │(ledger) │
   └───────────┘    └───────────┘    └─────────┘
```

## Service Inventory

### Go Services (8)
| Service | Purpose | Port |
|---------|---------|------|
| crm-services | Core CRM CRUD, analytics, search | 8080 |
| acquisition-engine | Lead acquisition & scoring | 8089 |
| agent-governance | AI agent management | 8097 |
| agentic-ai | Autonomous AI workflows | 8097 |
| falkordb-graph | Graph analytics | 8091 |
| gnn-neo4j | Graph neural network inference | 8090 |
| social-media | Social media integration | 8098 |
| telephony | AI telephony & IVR | 8099 |

### Python Services (14)
| Service | Purpose | Port |
|---------|---------|------|
| anomaly-detection | Anomaly detection ML | 8100 |
| art-security | Adversarial robustness testing | 8095 |
| campaign-analytics | Campaign ML analytics | 8087 |
| cdp-engine | Customer Data Platform | 8101 |
| cocoindex-pipeline | Data indexing pipeline | 8093 |
| compliance-reporting | Regulatory compliance | 8086 |
| customer-success-agent | CS AI agent | 8102 |
| epr-kgqa | Knowledge graph Q&A | 8094 |
| lakehouse-analytics | Iceberg lakehouse analytics | 8101 |
| ollama-inference | LLM inference | 8096 |
| predictive-analytics | Predictive ML models | 8102 |
| sales-agent | Sales AI agent | 8103 |
| threat-detection | Security threat detection | 8103 |

### Rust Services (9)
| Service | Purpose | Port |
|---------|---------|------|
| bulk-sender | High-throughput messaging | 8104 |
| hsm-service | Hardware security module | 8105 |
| mcmc-engine | MCMC credit risk engine | 8092 |
| mdm-engine | Master data management | 8106 |
| offline-sync | Offline-first sync engine | 8084 |
| semantic-search | Vector semantic search | 8107 |
| usage-metering | API usage metering | 8107 |
| waf-engine | Web application firewall | 8085 |
| workflow-runtime | Temporal workflow engine | 8108 |

## Middleware

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Gateway | APISIX | Routing, rate limiting, JWT auth |
| Message Broker | Kafka | Event streaming, async communication |
| Service Mesh | Dapr | Service invocation, state management |
| Streaming | Fluvio | Real-time event processing |
| Workflow | Temporal | Long-running workflow orchestration |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | Caching, pub/sub, rate limiting |
| Auth | Keycloak | OIDC, SSO, MFA |
| Authorization | Permify | Fine-grained RBAC (entity-relation) |
| Search | OpenSearch | Full-text search, log aggregation |
| WAF | OpenAppSec | Web application firewall |
| Ledger | TigerBeetle | Double-entry financial accounting |
| Analytics | Lakehouse (Iceberg) | Analytical data processing |
| Payments | Mojaloop | Instant payment hub (L1/NIBSS) |

## Verticals

| Vertical | Product Modules | Tenants |
|----------|----------------|---------|
| Banking | core_banking, agent_banking, remittance, lending, insurance, cards, payments | Acme Microfinance Bank, NextGen MFB |
| Telco | subscriber_mgmt, field_ops, interconnect, network_ops, device_mgmt | AeroTel, NetWave |
| Commodity | trading, broker_portal, settlement, risk_mgmt | PetroMark, AgriFlow |
| CPaaS | messaging, voice_platform, developer_portal, api_platform | MessageFlow, ConnectHub |

## Security Architecture

1. **Perimeter**: APISIX gateway + OpenAppSec WAF
2. **Authentication**: Keycloak OIDC with JWT
3. **Authorization**: Permify entity-relation RBAC
4. **Encryption**: AES-256-GCM at rest, TLS 1.3 in transit
5. **Audit**: Structured logging + Kafka audit trail
6. **Compliance**: OWASP Top 10, CSP headers, CSRF protection
