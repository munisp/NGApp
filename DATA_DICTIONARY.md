# 54Bank Data Dictionary
**Version:** 2.0.0  
**Last Updated:** 2026-05-09  
**Database:** PostgreSQL 14 (ndsep_db)  
**Total Tables:** 267  
**Total Rows:** ~3,718

---

## Overview

This document describes all 267 Drizzle ORM tables in the 54Bank core banking platform.
Tables are organized by business domain.

**Schema Definition:** `drizzle/schema.ts`  
**Migration Files:** `drizzle/0000_*.sql` through `drizzle/0007_core_banking_tables.sql`

---

## Core Banking (20 tables, 177 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `accounts` | 16 | Core deposit/savings/current account records |
| `batch_aggregator_configs` | 8 | Batch Aggregator Configs records |
| `billingAccounts` | 9 | Billingaccounts records |
| `card_batches` | 8 | Card Batches records |
| `escrow_accounts` | 8 | Escrow Accounts records |
| `escrow_audit_log` | 8 | Escrow Audit Log records |
| `escrow_disputes` | 8 | Escrow Disputes records |
| `escrow_documents` | 8 | Escrow Documents records |
| `escrow_fees` | 8 | Escrow Fees records |
| `escrow_interest_accruals` | 8 | Escrow Interest Accruals records |
| `escrow_milestones` | 8 | Escrow Milestones records |
| `escrow_parties` | 8 | Escrow Parties records |
| `escrow_regulatory_reports` | 8 | Escrow Regulatory Reports records |
| `escrow_transactions` | 8 | Escrow Transactions records |
| `glAccounts` | 16 | Glaccounts records |
| `kafka_batch_producers` | 8 | Kafka Batch Producers records |
| `nostroAccounts` | 8 | Nostroaccounts records |
| `sanctions_batch_runs` | 8 | Sanctions Batch Runs records |
| `tb_batch_configs` | 8 | Tb Batch Configs records |
| `virtualAccounts` | 8 | Virtualaccounts records |

## Customer & KYC (21 tables, 155 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `agent_kyc_captures` | 8 | Agent Kyc Captures records |
| `aml_training_records` | 8 | Aml Training Records records |
| `beneficial_owners` | 8 | Beneficial Owners records |
| `customerApprovals` | 0 | Customerapprovals records |
| `customerBillPayments` | 7 | Customerbillpayments records |
| `customerCardEvents` | 11 | Customercardevents records |
| `customerCards` | 6 | Customercards records |
| `customerNotifications` | 0 | Customer notification delivery log |
| `customerSavedBillers` | 3 | Customersavedbillers records |
| `customerSessionPreferences` | 8 | Customersessionpreferences records |
| `customerStatementExports` | 0 | Statement PDF export records |
| `customerStatements` | 0 | Generated account statements |
| `customerTransfers` | 4 | Customertransfers records |
| `customers` | 12 | Customer master data with KYC tier and risk classification |
| `docker_hardening_checks` | 32 | Docker Hardening Checks records |
| `kycVerifications` | 8 | Kycverifications records |
| `kyc_data_quality_metrics` | 8 | Kyc Data Quality Metrics records |
| `kyc_tier_history` | 8 | Kyc Tier History records |
| `kyc_tiers` | 8 | Kyc Tiers records |
| `sanctions_screenings` | 8 | Sanctions Screenings records |
| `telegram_kyc_bot` | 8 | Telegram Kyc Bot records |

## Transactions & Payments (23 tables, 218 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `billingAccrualSnapshots` | 11 | Billingaccrualsnapshots records |
| `billingContractOverrides` | 10 | Billingcontractoverrides records |
| `billingDiscountRules` | 9 | Billingdiscountrules records |
| `billingInvoiceApprovals` | 10 | Billinginvoiceapprovals records |
| `billingInvoiceLines` | 15 | Billinginvoicelines records |
| `billingInvoices` | 9 | Billinginvoices records |
| `billingRateCardLines` | 13 | Billingratecardlines records |
| `billingRateCards` | 9 | Billingratecards records |
| `billingRatedEvents` | 11 | Billingratedevents records |
| `billingRevenueShareRules` | 9 | Billingrevenuesharerules records |
| `billingUsageEvents` | 11 | Billingusageevents records |
| `cardTransactions` | 8 | Cardtransactions records |
| `loanRepayments` | 8 | Loanrepayments records |
| `nipTransactions` | 8 | Niptransactions records |
| `settlements` | 8 | Settlements records |
| `tellerTransactions` | 8 | Tellertransactions records |
| `transaction_alerts` | 8 | Transaction Alerts records |
| `transaction_monitoring_rules` | 8 | Transaction Monitoring Rules records |
| `transactions` | 13 | Immutable transaction journal (debit/credit/reversal) |
| `transfers` | 8 | Inter/intra-bank fund transfers via NIP/Mojaloop |
| `ussd_transaction_engine` | 8 | Ussd Transaction Engine records |
| `whatsapp_payment_integration` | 8 | Whatsapp Payment Integration records |
| `wire_transfer_monitor` | 8 | Wire Transfer Monitor records |

## Lending (12 tables, 99 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `agriLoans` | 8 | Agriloans records |
| `cbn_agri_returns` | 8 | Cbn Agri Returns records |
| `cbn_agsmeis` | 8 | Cbn Agsmeis records |
| `cbn_anchor_borrowers` | 8 | Cbn Anchor Borrowers records |
| `cooperative_credit_scoring` | 8 | Cooperative Credit Scoring records |
| `educationLoans` | 8 | Educationloans records |
| `esusuGroups` | 8 | Esusugroups records |
| `lendingGroups` | 8 | Lendinggroups records |
| `lettersOfCredit` | 8 | Lettersofcredit records |
| `loans` | 11 | Loan book with IFRS 9 classification |
| `nirsal_agro_geocoop` | 8 | Nirsal Agro Geocoop records |
| `nirsal_credit_guarantee` | 8 | Nirsal Credit Guarantee records |

## AML & Compliance (14 tables, 234 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `adverse_media_hits` | 32 | Adverse Media Hits records |
| `adverse_media_scans` | 32 | Adverse Media Scans records |
| `amlAlerts` | 10 | Real-time AML/CFT alerts from risk engine |
| `aml_cases` | 32 | AML investigation cases per NFIU regulations |
| `aml_compliance_metrics` | 8 | Aml Compliance Metrics records |
| `aml_risk_scores` | 32 | Aml Risk Scores records |
| `anomaly_models` | 8 | Anomaly Models records |
| `cbn_compliance_checks` | 8 | Cbn Compliance Checks records |
| `ctr_reports_aml` | 8 | Ctr Reports Aml records |
| `goaml_reports` | 8 | Goaml Reports records |
| `regulatory_reports_aml` | 8 | Regulatory Reports Aml records |
| `risk_scores` | 8 | Risk Scores records |
| `sar_reports_aml` | 8 | Sar Reports Aml records |
| `watchlist_sources` | 32 | Watchlist Sources records |

## Channel Banking (23 tables, 184 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `interactive_ussd_agri` | 8 | Interactive Ussd Agri records |
| `sms_alert_notification` | 8 | Sms Alert Notification records |
| `sms_banking_gateway` | 8 | Sms Banking Gateway records |
| `sms_otp_service` | 8 | Sms Otp Service records |
| `telegram_banking_commands` | 8 | Telegram Banking Commands records |
| `telegram_bot_gateway` | 8 | Telegram Bot Gateway records |
| `telegram_mini_app` | 8 | Telegram Mini App records |
| `telegram_notification` | 8 | Telegram Notification records |
| `ussd_banking_gateway` | 8 | Ussd Banking Gateway records |
| `ussd_multilingual` | 8 | Ussd Multilingual records |
| `ussd_sim_toolkit` | 8 | Ussd Sim Toolkit records |
| `voice_agent_escalation` | 8 | Voice Agent Escalation records |
| `voice_asr_nigerian` | 8 | Voice Asr Nigerian records |
| `voice_banking_gateway` | 8 | Voice Banking Gateway records |
| `voice_biometric_auth` | 8 | Voice Biometric Auth records |
| `voice_call_analytics` | 8 | Voice Call Analytics records |
| `voice_ivr_menu` | 8 | Voice Ivr Menu records |
| `voice_nlu_banking` | 8 | Voice Nlu Banking records |
| `voice_tts_nigerian` | 8 | Voice Tts Nigerian records |
| `whatsapp_banking_flows` | 8 | Whatsapp Banking Flows records |
| `whatsapp_business_gateway` | 8 | Whatsapp Business Gateway records |
| `whatsapp_document_service` | 8 | Whatsapp Document Service records |
| `whatsapp_notification` | 8 | Whatsapp Notification records |

## Agriculture Banking (26 tables, 208 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `agent_farmer_onboarding` | 8 | Agent Farmer Onboarding records |
| `agri_esg_impact` | 8 | Agri Esg Impact records |
| `agri_evoucher` | 8 | Agri Evoucher records |
| `agri_input_marketplace` | 8 | Agri Input Marketplace records |
| `agri_iot_sensor` | 8 | Agri Iot Sensor records |
| `agri_logistics` | 8 | Agri Logistics records |
| `agri_reinsurance` | 8 | Agri Reinsurance records |
| `agri_savings_cycles` | 8 | Agri Savings Cycles records |
| `animal_id_traceability` | 8 | Animal Id Traceability records |
| `area_yield_index_insurance` | 8 | Area Yield Index Insurance records |
| `commodity_exchange` | 8 | Commodity Exchange records |
| `commodity_price_intelligence` | 8 | Commodity Price Intelligence records |
| `cooperative_financials` | 8 | Cooperative Financials records |
| `cooperative_management` | 8 | Cooperative Management records |
| `cooperative_meetings` | 8 | Cooperative Meetings records |
| `cropInsurancePolicies` | 8 | Cropinsurancepolicies records |
| `crop_yield_prediction` | 8 | Crop Yield Prediction records |
| `crossborder_agri_trade` | 8 | Crossborder Agri Trade records |
| `farm_boundary_mapping` | 8 | Farm Boundary Mapping records |
| `farmers` | 8 | Farmers records |
| `livestock_finance` | 8 | Livestock Finance records |
| `livestock_insurance` | 8 | Livestock Insurance records |
| `livestock_management` | 8 | Livestock Management records |
| `multi_peril_crop_insurance` | 8 | Multi Peril Crop Insurance records |
| `post_harvest_loss_tracker` | 8 | Post Harvest Loss Tracker records |
| `satellite_crop_monitor` | 8 | Satellite Crop Monitor records |

## Security & Auth (7 tables, 80 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `api_key_policies` | 8 | Api Key Policies records |
| `api_keys` | 8 | Api Keys records |
| `body_limit_rules` | 8 | Body Limit Rules records |
| `csp_policies` | 8 | Csp Policies records |
| `ddos_rules` | 32 | Ddos Rules records |
| `security_events` | 8 | Security Events records |
| `waf_rules` | 8 | Waf Rules records |

## Infrastructure & Monitoring (2 tables, 40 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `cdn_edge_configs` | 32 | Cdn Edge Configs records |
| `prometheus_dashboards` | 8 | Prometheus Dashboards records |

## Middleware & Integration (8 tables, 184 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `apisix_plugin_chains` | 32 | Apisix Plugin Chains records |
| `avro_schemas` | 32 | Avro Schemas records |
| `fluvio_smart_modules` | 8 | Fluvio Smart Modules records |
| `kafka_consumer_groups` | 8 | Kafka Consumer Groups records |
| `opensearch_index_configs` | 8 | Opensearch Index Configs records |
| `redis_cache_entries` | 32 | Redis Cache Entries records |
| `redis_sessions` | 32 | Redis Sessions records |
| `temporal_memoized_activities` | 32 | Temporal Memoized Activities records |

## Card Management (2 tables, 16 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `grid_cards` | 8 | Grid Cards records |
| `scratch_cards` | 8 | Scratch Cards records |

## Partner & White-Label (4 tables, 4 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `partnerApprovalRecords` | 2 | Partner approval stage tracking |
| `partnerOnboardingRecords` | 0 | White-label partner onboarding workflows |
| `tenantFeatureFlags` | 1 | Tenantfeatureflags records |
| `tenants` | 1 | Multi-tenant configuration and onboarding |

## Other (105 tables, 1,803 rows)

| Table | Rows | Description |
|-------|------|-------------|
| `acgsf_guarantee` | 8 | Acgsf Guarantee records |
| `agentBankingAgents` | 8 | Agentbankingagents records |
| `aggregation_center` | 8 | Aggregation Center records |
| `auditEntries` | 91 | System-wide audit trail entries |
| `auditTrail` | 8 | Operator action audit log |
| `bankGuarantees` | 8 | Bankguarantees records |
| `bloom_filters` | 32 | Bloom Filters records |
| `bundle_split_configs` | 32 | Bundle Split Configs records |
| `bureau_checks` | 8 | Bureau Checks records |
| `cache_invalidations` | 8 | Cache Invalidations records |
| `certificates` | 8 | Certificates records |
| `coalescing_rules` | 32 | Coalescing Rules records |
| `compression_configs` | 32 | Compression Configs records |
| `corporate_monitoring_events` | 32 | Corporate Monitoring Events records |
| `correlation_rules` | 32 | Correlation Rules records |
| `crypto_keys` | 8 | Crypto Keys records |
| `device_profiles` | 32 | Device Profiles records |
| `disputeCases` | 8 | Disputecases records |
| `distroless_images` | 32 | Distroless Images records |
| `efass_returns` | 8 | Efass Returns records |
| `egress_policies` | 32 | Egress Policies records |
| `equipment_leasing` | 8 | Equipment Leasing records |
| `erpnextSyncJobs` | 8 | Erpnextsyncjobs records |
| `event_dedup_configs` | 8 | Event Dedup Configs records |
| `exportJobs` | 14 | Async report/statement export job queue |
| `fast_json_schemas` | 32 | Fast Json Schemas records |
| `fisheries_aquaculture` | 8 | Fisheries Aquaculture records |
| `frame_policies` | 32 | Frame Policies records |
| `fxTrades` | 8 | Fxtrades records |
| `grpc_services` | 32 | Grpc Services records |
| `hot_data_caches` | 32 | Hot Data Caches records |
| `hpa_configs` | 8 | Hpa Configs records |
| `http2_connections` | 32 | Http2 Connections records |
| `identityProfiles` | 8 | Identityprofiles records |
| `ijaraContracts` | 8 | Ijaracontracts records |
| `image_scans` | 8 | Image Scans records |
| `immutable_audit_blocks` | 8 | Immutable Audit Blocks records |
| `incidents` | 8 | Incidents records |
| `insurance_portfolio_analytics` | 8 | Insurance Portfolio Analytics records |
| `ip_rules` | 32 | Ip Rules records |
| `journalEntries` | 8 | Journalentries records |
| `jwt_validations` | 32 | Jwt Validations records |
| `keda_scale_triggers` | 8 | Keda Scale Triggers records |
| `keepalive_configs` | 32 | Keepalive Configs records |
| `key_rotation_schedules` | 32 | Key Rotation Schedules records |
| `kms_keys` | 32 | Kms Keys records |
| `materialized_views_perf` | 8 | Materialized Views Perf records |
| `memoization_targets` | 32 | Memoization Targets records |
| `mfa_enrollments` | 8 | Mfa Enrollments records |
| `mfa_policies` | 8 | Mfa Policies records |
| `mortgageApplications` | 8 | Mortgageapplications records |
| `mtls_nodes` | 8 | Mtls Nodes records |
| `mudarabahContracts` | 8 | Mudarabahcontracts records |
| `murabahaContracts` | 8 | Murabahacontracts records |
| `ndpr_records` | 8 | Ndpr Records records |
| `network_policies` | 8 | Network Policies records |
| `nfiu_filings` | 32 | Nfiu Filings records |
| `operatorActions` | 16 | Operatoractions records |
| `optimistic_ui_configs` | 32 | Optimistic Ui Configs records |
| `otp_records` | 8 | Otp Records records |
| `output_encoding_rules` | 8 | Output Encoding Rules records |
| `parametric_insurance_iot` | 8 | Parametric Insurance Iot records |
| `path_validation_rules` | 8 | Path Validation Rules records |
| `pci_scans` | 32 | Pci Scans records |
| `pentest_scans` | 8 | Pentest Scans records |
| `pgbouncer_pools` | 8 | Pgbouncer Pools records |
| `pin_hashes` | 8 | Pin Hashes records |
| `pin_verifications` | 8 | Pin Verifications records |
| `pkce_flows` | 8 | Pkce Flows records |
| `prepared_statements` | 32 | Prepared Statements records |
| `quality_certification` | 8 | Quality Certification records |
| `query_cache_entries` | 32 | Query Cache Entries records |
| `read_replica_configs` | 8 | Read Replica Configs records |
| `reconciliationRuns` | 8 | Reconciliationruns records |
| `regulatoryReports` | 8 | Regulatoryreports records |
| `route_schemas` | 8 | Route Schemas records |
| `route_trie_stats` | 32 | Route Trie Stats records |
| `session_records` | 8 | Session Records records |
| `siem_pipelines` | 8 | Siem Pipelines records |
| `soc2_evidence` | 32 | Soc2 Evidence records |
| `soil_analysis` | 8 | Soil Analysis records |
| `sorted_set_rankings` | 8 | Sorted Set Rankings records |
| `sql_queries` | 8 | Sql Queries records |
| `sri_hashes` | 32 | Sri Hashes records |
| `stream_response_configs` | 32 | Stream Response Configs records |
| `sw_cache_strategies` | 32 | Sw Cache Strategies records |
| `swiftMessages` | 8 | Swiftmessages records |
| `table_partitions` | 32 | Table Partitions records |
| `tellerSessions` | 8 | Tellersessions records |
| `tls_configs` | 32 | Tls Configs records |
| `token_families` | 8 | Token Families records |
| `trialBalances` | 8 | Trialbalances records |
| `txn_pattern_analyses` | 32 | Txn Pattern Analyses records |
| `typology_matches` | 32 | Typology Matches records |
| `ubo_graph_edges` | 8 | Ubo Graph Edges records |
| `ubo_graph_nodes` | 32 | Ubo Graph Nodes records |
| `users` | 8 | Users records |
| `valueChainContracts` | 8 | Valuechaincontracts records |
| `vaultOperations` | 8 | Vaultoperations records |
| `vault_engines` | 32 | Vault Engines records |
| `vault_secrets` | 8 | Vault Secrets records |
| `virtual_scroll_configs` | 8 | Virtual Scroll Configs records |
| `warehouseReceipts` | 8 | Warehousereceipts records |
| `warehouse_management` | 8 | Warehouse Management records |
| `workflowCases` | 10 | Workflowcases records |

---

## Key Table Schemas

### accounts
Core deposit/savings/current account records. Links customers to balances.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key (auto-increment) |
| accountId | varchar(64) | Unique account identifier (ACC-XXXXX) |
| customerId | varchar(64) | FK to customers table |
| tenantId | varchar(64) | Multi-tenant isolation key |
| accountName | varchar(191) | Account holder display name |
| accountType | text | savings, current, domiciliary, corporate |
| currency | varchar(3) | ISO 4217 code (NGN, USD, GBP, EUR) |
| balance | double | Current book balance |
| availableBalance | double | Available for withdrawal |
| ledgerBalance | double | Ledger (accounting) balance |
| status | text | active, dormant, closed, frozen |
| branchCode | varchar(16) | Branch sort code |
| tigerbeetleAccountId | varchar(64) | TigerBeetle ledger mapping |

### customers
Customer master data with KYC tier, risk classification, and segmentation.

| Column | Type | Description |
|--------|------|-------------|
| customerId | varchar(64) | Unique customer ID (CUST-XXXXX) |
| name | varchar(191) | Full name |
| segment | varchar(96) | retail, premium, private, sme, corporate |
| tier | varchar(64) | KYC tier (1, 2, 3) per CBN guidelines |
| risk | varchar(64) | low, medium, high, pep |
| status | text | active, inactive, dormant, blocked |
| bvn | varchar(32) | Bank Verification Number (11 digits) |
| phone | varchar(32) | Nigerian mobile (+234XXXXXXXXXX) |

### transactions
Immutable transaction journal for all debit/credit operations.

| Column | Type | Description |
|--------|------|-------------|
| transactionId | varchar(64) | Unique transaction ref (TXN-XXXXX) |
| accountId | varchar(64) | FK to accounts |
| type | text | credit, debit, reversal, fee |
| amount | double | Transaction amount |
| currency | varchar(3) | ISO 4217 |
| channel | text | branch, mobile, ussd, pos, atm, web |
| status | text | completed, pending, failed, reversed |

### loans
Loan book with IFRS 9 classification and collateral tracking.

| Column | Type | Description |
|--------|------|-------------|
| loanId | varchar(64) | Unique loan ref (LN-XXXXX) |
| loanType | text | personal, mortgage, sme, agri, auto, salary |
| principalAmount | double | Original disbursed amount |
| interestRate | double | Annual rate (%) |
| classificationIFRS9 | text | stage_1, stage_2, stage_3 (impairment) |
| status | text | active, closed, written_off, restructured |

### transfers
Inter-bank and intra-bank fund transfers with NIP/Mojaloop integration.

| Column | Type | Description |
|--------|------|-------------|
| transferId | varchar(64) | Unique transfer ref |
| sourceAccountId | varchar(64) | Sender account |
| destinationBank | varchar(64) | Bank code (CBN) |
| nipSessionId | varchar(64) | NIBSS NIP session reference |
| mojaloopTransferId | varchar(64) | Mojaloop interop transfer ID |
| idempotencyKey | varchar(128) | Prevents duplicate processing |

### aml_cases
AML investigation cases per NFIU/CBN regulations.

| Column | Type | Description |
|--------|------|-------------|
| caseType | varchar(30) | suspicious_activity, structuring, pep_review |
| riskLevel | varchar(20) | low, medium, high, critical |
| sarFiled | boolean | Whether SAR filed with NFIU |
| status | varchar(30) | open, investigating, escalated, closed |

---

## Data Integrity Rules

1. **Multi-tenancy**: All operational tables include `tenantId` for data isolation
2. **Soft deletes**: Records use `status = 'deleted'` rather than physical deletion
3. **Audit trail**: `createdAt`/`updatedAt` timestamps on all tables
4. **Currency**: Default NGN, supports USD/GBP/EUR for domiciliary accounts
5. **BVN validation**: 11-digit numeric, validated against NIBSS BVN database
6. **Idempotency**: Transfer and payment tables use `idempotencyKey` to prevent duplicates

---

## Regulatory Compliance

| Regulation | Tables Affected | Implementation |
|-----------|----------------|----------------|
| CBN KYC Circular | customers, kyc_* | 3-tier verification |
| NFIU AML/CFT | aml_*, sar_*, ctr_* | Auto-filing thresholds |
| NDPR (Data Privacy) | All PII tables | Encryption at rest, access logging |
| IFRS 9 | loans | Stage 1/2/3 classification |
| PCI DSS | card_*, atm_* | Tokenized card data |
