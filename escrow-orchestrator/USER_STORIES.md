# SocialEscrow Platform - Top 20 User Stories

Each user story is mapped to existing implemented components in the platform.

## User Story 1: Buyer Creates Escrow from Social Listing
**As a buyer**, I want to create an escrow from a social media listing so that my payment is protected.

**Workflow:** `EscrowHappyPathWorkflow` (Step 1-3)

**Implemented Components:**
- `POST /api/v1/escrow/create` (main.py:449)
- `POST /api/v1/listing/detect` (main.py:914) - OCR detection
- `ocr_domain_adaptation.py` - Nigerian commerce OCR
- `pidgin_nlp.py` - Pidgin English NLP extraction
- `viral_sharing.py` - Generate shareable escrow link

**Kafka Events:** `escrow.created`

---

## User Story 2: Seller Claims and Accepts Escrow Link
**As a seller**, I want to claim an escrow link and submit my bank details so I can receive payment.

**Workflow:** `EscrowHappyPathWorkflow` (Step 4-6)

**Implemented Components:**
- `POST /api/v1/escrow/accept` (main.py:652)
- `POST /api/v1/seller/onboard` (main.py:2249)
- `POST /api/v1/bank/verify` (main.py:620)
- `seller_onboarding.py` - Seller onboarding flow
- `bank_adapter.py` - Nigerian bank integrations
- `auth.py` - Keycloak authentication
- `permify_schema.py` - Authorization rules

**Kafka Events:** `escrow.accepted`

---

## User Story 3: Buyer Funds Escrow via Bank/Card/PSP
**As a buyer**, I want to fund my escrow via bank transfer, card, or mobile money so the transaction can proceed.

**Workflow:** `EscrowHappyPathWorkflow` (implicit in create)

**Implemented Components:**
- `payment_adapters.py` - Paystack, Flutterwave, Mojaloop
- `bank_adapter.py` - Nigerian bank integrations
- `tigerbeetle_ledger.py` - Double-entry ledger
- `event_streaming.py` - Kafka event emission

**Kafka Events:** `escrow.funded`

---

## User Story 4: Automatic Fraud/Risk Check
**As the platform**, I want to automatically check for fraud on creation/funding so risky transactions are blocked.

**Workflow:** `EscrowHappyPathWorkflow` (Step 1)

**Implemented Components:**
- `POST /api/v1/fraud/assess-transaction` (main.py:2060)
- `POST /api/v1/fraud/report` (main.py:2106)
- `fraud_detection.py` - Fraud detection service
- `middleware_integrations.py` - Alert publishing
- `observability.py` - Logging and auditing

**Kafka Events:** `fraud.detected` (if high risk)

---

## User Story 5: Seller Ships and Buyer Tracks
**As a seller**, I want to mark the item as shipped so the buyer can track delivery.

**Workflow:** `EscrowHappyPathWorkflow` (Step 7-8)

**Implemented Components:**
- `POST /api/v1/escrow/ship` (main.py:694)
- `proof_of_delivery.py` - Shipping proof hooks

**Kafka Events:** `escrow.shipped`

---

## User Story 6: Proof-of-Delivery Capture
**As a seller**, I want to capture proof of delivery so disputes can be resolved fairly.

**Workflow:** `EscrowHappyPathWorkflow` (Step 9)

**Implemented Components:**
- `proof_of_delivery.py` - Evidence capture
- `rustfs_storage.py` - Object storage for evidence
- `webrtc_signaling.py` - Live video verification (optional)

**Kafka Events:** `delivery.proof_uploaded`

---

## User Story 7: Buyer Confirms Delivery and Releases Funds
**As a buyer**, I want to confirm delivery so funds are released to the seller.

**Workflow:** `EscrowHappyPathWorkflow` (Step 10-12)

**Implemented Components:**
- `POST /api/v1/escrow/confirm-delivery` (main.py:736)
- `tigerbeetle_ledger.py` - Settlement entries
- `payment_adapters.py` - Payout initiation

**Kafka Events:** `escrow.delivered`, `escrow.released`, `escrow.completed`

---

## User Story 8: Payout Triggers Progressive KYC
**As the platform**, I want to require KYC upgrade when payout thresholds are hit so we remain compliant.

**Workflow:** `PayoutWorkflow` (Step 1-2)

**Implemented Components:**
- `POST /api/v1/kyc/check-limit` (main.py:2394)
- `GET /api/v1/kyc/{user_id}/level` (main.py:2403)
- `progressive_kyc.py` - KYC tier management
- `kyc_providers.py` - KYC provider integrations

**Kafka Events:** `kyc.required`, `kyc.completed`

---

## User Story 9: Seller Loyalty/Tiers Update
**As a seller**, I want my loyalty tier to update after successful transactions so I get better rates.

**Workflow:** `PayoutWorkflow` (Step 6)

**Implemented Components:**
- `loyalty_points.py` - Loyalty program
- `seller_tiers.py` - Seller tier system
- `growth_wallet.py` - Growth wallet credits

**Kafka Events:** `seller.transaction_completed`, `seller.tier_upgraded`

---

## User Story 10: Partner-Funded Rewards
**As a seller**, I want to receive partner-funded rewards after milestones so I'm incentivized to use the platform.

**Workflow:** `PayoutWorkflow` (implicit)

**Implemented Components:**
- `partner_rewards.py` - Partner rewards program
- `growth_wallet.py` - Reward credits

**Kafka Events:** `reward.credited`

---

## User Story 11: Returns/Refunds Requested by Buyer
**As a buyer**, I want to request a return/refund so I can get my money back if there's an issue.

**Workflow:** `RefundWorkflow`

**Implemented Components:**
- `POST /api/v1/escrow/refund` (main.py:1088)
- `returns_refunds.py` - Returns and refunds logic
- `tigerbeetle_ledger.py` - Reversal entries
- `payment_adapters.py` - Refund processing

**Kafka Events:** `escrow.refunded`

---

## User Story 12: Escrow Expiry and Auto-Refund
**As a buyer**, I want automatic refund if the seller doesn't respond so my money isn't stuck.

**Workflow:** `RefundWorkflow`, `ExpiryCheckWorkflow`

**Implemented Components:**
- `POST /api/v1/escrow/expire` (main.py:1042)
- `GET /api/v1/escrow/check-expiring` (main.py:1162)
- `edge_cases.py` - Expiry handling
- `returns_refunds.py` - Auto-refund logic

**Kafka Events:** `escrow.expired`, `escrow.refunded`

---

## User Story 13: Dispute Opened and Evidence Submitted
**As a buyer/seller**, I want to open a dispute and submit evidence so issues can be resolved.

**Workflow:** `DisputeWorkflow` (Step 1-4)

**Implemented Components:**
- `POST /api/v1/escrow/dispute` (main.py:834)
- `POST /api/v1/disputes/open` (main.py:2139)
- `POST /api/v1/disputes/{dispute_id}/evidence` (main.py:2178)
- `dispute_resolution.py` - Dispute handling
- `dispute_ops.py` - Dispute operations
- `rustfs_storage.py` - Evidence storage

**Kafka Events:** `dispute.opened`, `dispute.evidence_submitted`

---

## User Story 14: Dispute Escalated to Arbiter
**As a buyer/seller**, I want disputes escalated to an arbiter if we can't agree so there's fair resolution.

**Workflow:** `DisputeWorkflow` (Step 5-6)

**Implemented Components:**
- `POST /api/v1/disputes/{dispute_id}/resolve` (main.py:2209)
- `dispute_resolution.py` - Arbiter assignment
- `agent_network.py` - Agent/arbiter network
- `tigerbeetle_ledger.py` - Split settlement

**Kafka Events:** `dispute.escalated`, `dispute.resolved`

---

## User Story 15: Cash Agent for Unbanked Users
**As an unbanked buyer/seller**, I want to use a cash agent so I can participate in escrow transactions.

**Workflow:** `AgentCashWorkflow`

**Implemented Components:**
- `GET /api/v1/agents/nearby` (main.py:2456)
- `POST /api/v1/agents/cash-transaction` (main.py:2492)
- `POST /api/v1/agents/assign` (main.py:2527)
- `POST /api/v1/agents/complete` (main.py:2554)
- `agent_network.py` - Cash agent network
- `tigerbeetle_ledger.py` - Agent float management

**Kafka Events:** `agent.assigned`, `agent.transaction_completed`

---

## User Story 16: Marketplace Discovery
**As a buyer**, I want to discover trusted sellers and listings so I can shop safely.

**Workflow:** N/A (Query-based)

**Implemented Components:**
- `marketplace_discovery.py` - Marketplace discovery
- `trust_badge.py` - Trust badges
- `seller_storefront.py` - Seller storefronts

**API Endpoints:**
- Marketplace discovery endpoints in `marketplace_discovery.py`
- Trust badge endpoints in main.py (2294-2338)

---

## User Story 17: Seller Storefront Management
**As a seller**, I want to manage my storefront so buyers can find my products.

**Workflow:** N/A (CRUD-based)

**Implemented Components:**
- `seller_storefront.py` - Storefront management
- `auth.py` - Authentication
- `permify_schema.py` - Authorization

**API Endpoints:**
- Storefront router in main.py (3442)

---

## User Story 18: Real-Time Status Updates
**As a buyer/seller**, I want real-time status updates so I know what's happening with my transaction.

**Workflow:** All workflows emit events

**Implemented Components:**
- `event_streaming.py` - Kafka event streaming
- `kafka_dlq_consumer.py` - Dead letter queue
- `middleware_wiring.py` - Event routing
- `POST /api/v1/whatsapp/webhook` (main.py:1321)
- `POST /api/v1/ussd/callback` (main.py:1688)

**Kafka Events:** All escrow lifecycle events

---

## User Story 19: Lakehouse Analytics
**As an operations team member**, I want analytics on volume, fraud rates, and SLAs so I can monitor platform health.

**Workflow:** N/A (Analytics pipeline)

**Implemented Components:**
- `lakehouse_pipeline.py` - Data pipeline
- `lakehouse_full.py` - Lakehouse analytics (Spark, Flink, Trino)
- `GET /api/v1/platform/summary` (main.py:2669)
- `GET /api/v1/metrics` (main.py:2338)

**Data Flow:** Kafka -> Lakehouse -> Analytics dashboards

---

## User Story 20: Admin/Compliance Audit Trail
**As a compliance officer**, I want to review audit trails so we can meet regulatory requirements.

**Workflow:** N/A (Query-based)

**Implemented Components:**
- `GET /api/v1/audit/{resource_type}/{resource_id}` (main.py:2375)
- `security_compliance.py` - Compliance checks
- `observability.py` - Audit logging
- OpenSearch integration via `middleware_integrations.py`

**Data Flow:** All operations logged -> OpenSearch -> Audit queries

---

## Middleware Integration Summary

| Middleware | Integration Point | Status |
|------------|-------------------|--------|
| Temporal | Workflow orchestration | Implemented |
| Kafka | Event streaming | Implemented |
| Redis | Caching, locks, rate limiting | Implemented |
| Dapr | Service mesh, pubsub | Implemented |
| Keycloak | Authentication | Implemented |
| Permify | Authorization | Implemented |
| TigerBeetle | Double-entry ledger | Implemented |
| Mojaloop | Payment hub | Implemented |
| APISIX | API gateway | Configured |
| Lakehouse | Analytics | Implemented |
| Fluvio | High-perf streaming | Configured |

## Validation Checklist

All 20 user stories are validated against:
- [x] Existing API endpoints in main.py
- [x] Existing Python modules in escrow-api/app
- [x] Temporal workflow implementations
- [x] Kafka event definitions
- [x] Middleware integrations
