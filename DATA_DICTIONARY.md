# 54Bank Data Dictionary

## Overview

The 54Bank platform uses PostgreSQL 16 with Drizzle ORM. The database contains **267 tables** organized into functional domains, with **3,443+ seed rows** of realistic Nigerian banking data.

**Schema file:** `drizzle/schema.ts`
**Seed scripts:** `drizzle/seed.sql`, `drizzle/seed-remaining.sql`
**Connection:** `postgresql://ndsep_user:***@localhost:5432/ndsep_db`

---

## Core Banking Domain (17 tables)

### `customers`
Customer master data including KYC information.

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| customerId | varchar(64) | Unique customer identifier (e.g., CUST-001) |
| tenantId | varchar(64) | Multi-tenant isolation key |
| firstName | varchar(100) | Customer first name |
| lastName | varchar(100) | Customer last name |
| email | varchar(200) | Email address |
| phoneNumber | varchar(20) | Nigerian phone number (+234...) |
| bvn | varchar(11) | Bank Verification Number (NIBSS) |
| nin | varchar(11) | National Identification Number |
| dateOfBirth | varchar(10) | Date of birth (YYYY-MM-DD) |
| gender | varchar(10) | Gender |
| address | text | Residential address |
| state | varchar(50) | Nigerian state |
| lga | varchar(100) | Local Government Area |
| customerType | varchar(20) | individual / corporate / sme |
| riskRating | varchar(10) | low / medium / high / critical |
| kycLevel | varchar(10) | tier1 / tier2 / tier3 |
| status | varchar(20) | active / dormant / blocked / closed |
| createdAt | timestamp | Record creation timestamp |
| updatedAt | timestamp | Last update timestamp |

### `accounts`
Customer bank accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| accountId | varchar(64) | Unique account number (e.g., ACC-001) |
| customerId | varchar(64) | FK → customers.customerId |
| tenantId | varchar(64) | Multi-tenant isolation key |
| accountName | varchar(200) | Account display name |
| accountType | varchar(30) | savings / current / fixed_deposit / gl |
| currency | varchar(3) | ISO 4217 currency code (NGN, USD, GBP) |
| balance | double | Current balance |
| availableBalance | double | Available balance (excl. holds) |
| ledgerBalance | double | Ledger (book) balance |
| status | varchar(20) | active / dormant / frozen / closed |
| branchCode | varchar(20) | Branch identifier (e.g., LAG-001) |
| createdAt | timestamp | Record creation timestamp |

### `transactions`
Financial transaction records.

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| transactionId | varchar(64) | Unique transaction reference |
| accountId | varchar(64) | FK → accounts.accountId |
| tenantId | varchar(64) | Multi-tenant isolation key |
| type | text | credit / debit |
| amount | double | Transaction amount |
| currency | varchar(3) | ISO 4217 currency code |
| narration | text | Transaction description/narration |
| reference | varchar(64) | External reference |
| channel | text | web / mobile / ussd / pos / atm / branch |
| counterpartyName | varchar(200) | Counterparty name |
| balanceAfter | double | Account balance after transaction |
| status | text | completed / pending / failed / reversed |
| createdAt | timestamp | Transaction timestamp |

### `loans`
Loan facility records.

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| loanId | varchar(64) | Unique loan identifier |
| customerId | varchar(64) | FK → customers.customerId |
| tenantId | varchar(64) | Multi-tenant isolation key |
| loanType | varchar(30) | term / sme / overdraft / mortgage / micro |
| principalAmount | double | Original loan amount |
| outstandingBalance | double | Current outstanding balance |
| interestRate | double | Annual interest rate (%) |
| currency | varchar(3) | Loan currency |
| tenor | integer | Loan duration |
| tenorUnit | varchar(10) | months / days / years |
| status | varchar(20) | active / overdue / closed / written_off |
| classificationIFRS9 | varchar(10) | stage1 / stage2 / stage3 (IFRS 9) |
| createdAt | timestamp | Disbursement date |

---

## Treasury Domain (5 tables)

### `fxTrades`
Foreign exchange trade records.

| Column | Type | Description |
|--------|------|-------------|
| tradeId | varchar(64) | Unique trade identifier |
| buyCurrency / sellCurrency | varchar(3) | Currency pair |
| buyAmount / sellAmount | double | Trade amounts |
| exchangeRate | double | Exchange rate |
| tradeType | varchar(20) | spot / forward / swap |
| counterparty | varchar(200) | Counterparty bank |
| status | varchar(20) | confirmed / settled / cancelled |

### `nostroAccounts`
Correspondent banking accounts.

| Column | Type | Description |
|--------|------|-------------|
| nostroId | varchar(64) | Account identifier |
| correspondentBank | varchar(200) | Bank name |
| currency | varchar(3) | Account currency |
| swiftCode | varchar(11) | SWIFT/BIC code |
| balance | double | Current balance |

---

## Channel Banking Domain (25 tables)

All Channel Banking tables share a common schema:

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | Auto-increment ID |
| tenantId | text | Multi-tenant key (default: "default") |
| recordId | text | Unique record identifier |
| name | text | Record name |
| category | text | premium / standard / micro / enterprise |
| description | text | Record description |
| status | text | active / completed / processing |
| amount | double | Transaction amount |
| channel | text | Channel identifier |
| msisdn | text | Mobile number |
| sessionId | text | Session tracking ID |
| metadata | jsonb | Additional structured data |
| createdAt | timestamp | Created at |
| updatedAt | timestamp | Updated at |

**Tables:**
- `voice_banking_gateway` — IVR call routing and session management
- `voice_tts_nigerian` — Nigerian male/female text-to-speech
- `voice_asr_nigerian` — Automatic speech recognition (noise-robust)
- `voice_nlu_banking` — Natural language understanding for banking intents
- `voice_biometric_auth` — Voiceprint enrollment and verification
- `voice_ivr_menu` — IVR menu navigation engine
- `voice_call_analytics` — Call sentiment and duration analytics
- `voice_agent_escalation` — Escalation to human agents
- `telegram_bot_gateway` — Telegram webhook management
- `telegram_banking_commands` — /balance, /transfer, /history commands
- `telegram_notification` — Push notifications via Telegram
- `telegram_mini_app` — Rich UI mini application
- `telegram_kyc_bot` — BVN/NIN verification in-chat
- `whatsapp_business_gateway` — WhatsApp Cloud API integration
- `whatsapp_banking_flows` — Conversational banking flows
- `whatsapp_payment_integration` — WhatsApp Pay, P2P, QR
- `whatsapp_notification` — Template-based notifications
- `whatsapp_document_service` — PDF statements, KYC documents
- `ussd_banking_gateway` — *737# style short code banking
- `ussd_transaction_engine` — 160-char USSD transaction screens
- `ussd_multilingual` — English, Hausa, Yoruba, Igbo, Pidgin
- `ussd_sim_toolkit` — STK push alerts
- `sms_banking_gateway` — BAL/TRF/STMT keyword banking
- `sms_otp_service` — OTP delivery (MTN/Glo/Airtel/9mobile)
- `sms_alert_notification` — Credit/debit/fraud alerts

---

## Agriculture Banking Domain (40 tables)

Key tables include `cooperative_management`, `livestock_management`, `input_marketplace`, `nirsal_credit_guarantee`, `cbn_anchor_borrowers`, `interactive_ussd_agri`, `vsla_rosca_savings`, `livestock_finance`, `commodity_exchange`, `e_voucher_system`, `price_intelligence`, `satellite_crop_monitor`, and 28 more.

---

## AML / Compliance Domain (15 tables)

- `aml_cases` — AML investigation cases
- `aml_risk_scores` — Customer risk scoring
- `adverse_media_hits` — Adverse media screening results
- `adverse_media_scans` — Media scan executions
- `nfiu_filings` — NFIU regulatory filings (CTR/STR)
- `txn_pattern_analyses` — Transaction pattern analysis
- `typology_matches` — Money laundering typology matching
- `ubo_graph_nodes` — Ultimate beneficial ownership graphs
- `watchlist_sources` — Sanctions/PEP watchlist sources
- `corporate_monitoring_events` — Corporate entity monitoring
- `device_profiles` — Device fingerprinting for fraud detection
- `correlation_rules` — Event correlation rules

---

## Infrastructure Tables (40+)

Performance optimization, security hardening, caching, and monitoring tables including `bloom_filters`, `cdn_edge_configs`, `compression_configs`, `redis_cache_entries`, `prepared_statements`, `table_partitions`, `tls_configs`, `vault_engines`, `kms_keys`, and more.

---

## Seed Data Summary

| Domain | Tables | Rows | Source |
|--------|--------|------|--------|
| Core Banking | 17 | ~100 | drizzle/seed.sql + seedDatabase.ts |
| Channel Banking | 25 | 200 | seedDatabase.ts + seed.sql |
| Agriculture | 40 | 320 | seed.sql |
| AML / Compliance | 15 | 120 | seed-remaining.sql |
| Performance | 40 | 320 | seed.sql |
| Security Hardening | 37 | 296 | seed.sql |
| Infrastructure | 93 | ~2,000 | seed.sql + seed-remaining.sql |
| **Total** | **267** | **3,443+** | |
