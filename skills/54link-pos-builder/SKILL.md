---
name: 54link-pos-builder
description: Reusable skill for building and extending the 54Link POS Agent Banking platform. Covers agent network, transaction processing, float management, compliance, and MDM.
---

# 54Link POS Builder Skill

## Core Modules

### Agent Authentication

- Keycloak SSO integration for admin dashboard
- Agent PIN-based auth for POS terminals
- Session management with JWT cookies

### POS Terminal

- Device enrollment and MDM heartbeat
- Transaction processing (Cash In, Cash Out, Transfer, Airtime, Bills)
- Offline-capable with sync queue

### Float Management

- Agent float allocation and tracking
- TigerBeetle double-entry ledger integration
- Float top-up workflows

### Transaction Processing

- Multi-channel support (Cash, USSD, NFC, QR)
- Commission calculation and distribution
- Loyalty points engine

### Fraud Detection

- Real-time fraud scoring with ML pipeline
- Rule-based alert thresholds
- Manual review workflow for flagged transactions

### KYC Verification

- Document upload and verification
- Liveness check with DeepFace
- CBN compliance tier management

### Settlement & Reconciliation

- Daily settlement batch processing
- Bank partner integration
- Dispute management

### Stripe Billing Integration

- Monthly invoice generation (cron)
- Webhook handler for invoice.paid, invoice.failed
- Revenue share billing model

### Observability

- Kafka/Fluvio event streaming
- Redis caching with fail-open patterns
- Structured logging with pino

## Architecture

- **Backend**: Node.js + tRPC + Drizzle ORM + PostgreSQL
- **Frontend**: React + Vite + TanStack Query + shadcn/ui
- **Auth**: Keycloak (admin) + custom PIN auth (agents)
- **Messaging**: Kafka + Fluvio for event streaming
- **Caching**: Redis with fail-open fallback
- **Ledger**: TigerBeetle for double-entry accounting
