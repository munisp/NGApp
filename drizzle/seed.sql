-- 54Bank Platform — Postgres Seed Data
-- All 267 Drizzle ORM tables with realistic Nigerian banking data
-- Total: 267 tables × 3 rows = 801 rows
-- Usage: psql $DATABASE_URL < drizzle/seed.sql

BEGIN;

-- Table: users (9 columns, inserting 5)
INSERT INTO "users" ("openId", "name", "email", "loginMethod", "role") VALUES
  ('01b22493-1fff-16f9-22d1-0078c545e8a0', 'Halima Abdullahi', 'yetunde.olowe@54bank.ng', 'ussd', 'user'),
  ('0244356d-10b5-077d-23a0-00e445d774ef', 'Kano Textiles Ltd', 'yetunde.olowe@54bank.ng', 'bank_transfer', 'branch_manager'),
  ('04b8da34-16ac-1e74-1563-003bd3b7830d', 'Ngozi Okafor', 'ibrahim.musa@54bank.ng', 'ussd', 'user');

-- Table: tenants (10 columns, inserting 7)
INSERT INTO "tenants" ("tenantId", "name", "onboardingStatus", "segment", "region", "enabledModules", "whiteLabel") VALUES
  ('tenant-lagos-main', 'Samuel Eze', 'rejected', 'retail', 'Nigeria', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb),
  ('tenant-kano-north', 'Emeka & Sons Trading', 'active', 'corporate', 'Nigeria', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb),
  ('tenant-lagos-main', 'Amina Yusuf', 'rejected', 'corporate', 'Nigeria', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb);

-- Table: tenantFeatureFlags (12 columns, inserting 9)
INSERT INTO "tenantFeatureFlags" ("tenantId", "featureKey", "label", "category", "description", "enabled", "rolloutStage", "adminManaged", "dependsOn") VALUES
  ('tenant-ph-south', 'tenantFe_featurekey_1', 'tenantFeatureFlags_label_1', 'standard', '54Bank tenantFeatureFlags record 1', 4, 'tenantFeatureFlags_rolloutstage_1', 90, '{"key": "value"}'::jsonb),
  ('tenant-abuja-hq', 'tenantFe_featurekey_2', 'tenantFeatureFlags_label_2', 'premium', '54Bank tenantFeatureFlags record 2', 49, 'tenantFeatureFlags_rolloutstage_2', 75, '{"key": "value"}'::jsonb),
  ('tenant-abuja-hq', 'tenantFe_featurekey_3', 'tenantFeatureFlags_label_3', 'premium', '54Bank tenantFeatureFlags record 3', 31, 'tenantFeatureFlags_rolloutstage_3', 32, '{"key": "value"}'::jsonb);

-- Table: customers (17 columns, inserting 13)
INSERT INTO "customers" ("customerId", "tenantId", "name", "segment", "tier", "location", "relationshipManager", "risk", "status", "bvn", "phone", "balance", "lastTouchpointLabel") VALUES
  ('customer_customerid_1', 'tenant-lagos-main', 'Obinna Chukwu', 'corporate', 'tier_2', 'Anambra', 'customers_relationshipmanager_1', 'customers_risk_1', 'completed', '22558572819', '+2347833857384', 447172979.1, 'customers_lasttouchpointlabel_1'),
  ('customer_customerid_2', 'tenant-kano-north', 'Kano Textiles Ltd', 'retail', 'tier_2', 'Imo', 'customers_relationshipmanager_2', 'customers_risk_2', 'pending', '22331844167', '+2347761872592', 241996276.9, 'customers_lasttouchpointlabel_2'),
  ('customer_customerid_3', 'tenant-kano-north', 'Fatima Hassan', 'retail', 'tier_3', 'Oyo', 'customers_relationshipmanager_3', 'customers_risk_3', 'completed', '22346868384', '+2348082986997', 231530522.07, 'customers_lasttouchpointlabel_3');

-- Table: customerCards (15 columns, inserting 12)
INSERT INTO "customerCards" ("cardId", "customerId", "cardType", "brand", "lastFour", "expiryDate", "cardHolder", "balance", "isLocked", "controls", "spendingLimits", "colorTone") VALUES
  ('customer_cardid_1', 'customer_customerid_1', 'standard', 'customerCards_brand_1', 'customerCards_lastfour_1', 'customerCards_expirydate_1', 'customerCards_cardholder_1', 464796658.46, 100, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'customerCards_colortone_1'),
  ('customer_cardid_2', 'customer_customerid_2', 'premium', 'customerCards_brand_2', 'customerCards_lastfour_2', 'customerCards_expirydate_2', 'customerCards_cardholder_2', 295653840.32, 65, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'customerCards_colortone_2'),
  ('customer_cardid_3', 'customer_customerid_3', 'premium', 'customerCards_brand_3', 'customerCards_lastfour_3', 'customerCards_expirydate_3', 'customerCards_cardholder_3', 159510445.97, 99, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'customerCards_colortone_3');

-- Table: customerCardEvents (8 columns, inserting 6)
INSERT INTO "customerCardEvents" ("eventId", "cardId", "customerId", "title", "detail", "severity") VALUES
  ('customer_eventid_1', 'customer_cardid_1', 'customer_customerid_1', 'customerCardEvents_title_1', '54Bank customerCardEvents record 1', 'customerCardEvents_severity_1'),
  ('customer_eventid_2', 'customer_cardid_2', 'customer_customerid_2', 'customerCardEvents_title_2', '54Bank customerCardEvents record 2', 'customerCardEvents_severity_2'),
  ('customer_eventid_3', 'customer_cardid_3', 'customer_customerid_3', 'customerCardEvents_title_3', '54Bank customerCardEvents record 3', 'customerCardEvents_severity_3');

-- Table: customerSavedBillers (12 columns, inserting 10)
INSERT INTO "customerSavedBillers" ("billerRecordId", "customerId", "category", "provider", "billerId", "customerReference", "nickname", "lastAmount", "verifiedName", "lastPaidAt") VALUES
  ('customer_billerrecordid_1', 'customer_customerid_1', 'standard', 'customer_provider_1', 'customer_billerid_1', '54B-CUST-201957', 'customerSavedBillers_nickname_1', 302314011.97, 'customerSavedBillers_verifiedname_1', '2025-10-30 00:00:00'::timestamp),
  ('customer_billerrecordid_2', 'customer_customerid_2', 'premium', 'customer_provider_2', 'customer_billerid_2', '54B-CUST-541597', 'customerSavedBillers_nickname_2', 199979673.65, 'customerSavedBillers_verifiedname_2', '2025-10-06 00:00:00'::timestamp),
  ('customer_billerrecordid_3', 'customer_customerid_3', 'premium', 'customer_provider_3', 'customer_billerid_3', '54B-CUST-432479', 'customerSavedBillers_nickname_3', 242467977.4, 'customerSavedBillers_verifiedname_3', '2025-07-23 00:00:00'::timestamp);

-- Table: customerBillPayments (16 columns, inserting 13)
INSERT INTO "customerBillPayments" ("paymentId", "customerId", "category", "provider", "amount", "status", "reference", "billerId", "customerReference", "customerName", "scheduledFor", "evidenceStatus", "channel") VALUES
  ('customer_paymentid_1', 'customer_customerid_1', 'standard', 'customer_provider_1', 70417269.64, 'approved', '54B-CUST-456031', 'customer_billerid_1', '54B-CUST-584040', 'customerBillPayments_customername_1', '2026-01-06 00:00:00'::timestamp, 'approved', 'customerBillPayments_channel_1'),
  ('customer_paymentid_2', 'customer_customerid_2', 'basic', 'customer_provider_2', 66026279.13, 'pending', '54B-CUST-392420', 'customer_billerid_2', '54B-CUST-844945', 'customerBillPayments_customername_2', '2026-03-11 00:00:00'::timestamp, 'approved', 'customerBillPayments_channel_2'),
  ('customer_paymentid_3', 'customer_customerid_3', 'basic', 'customer_provider_3', 351642949.25, 'pending', '54B-CUST-833084', 'customer_billerid_3', '54B-CUST-401565', 'customerBillPayments_customername_3', '2026-03-21 00:00:00'::timestamp, 'completed', 'customerBillPayments_channel_3');

-- Table: customerTransfers (20 columns, inserting 17)
INSERT INTO "customerTransfers" ("transferId", "customerId", "beneficiaryId", "beneficiaryName", "amount", "narration", "transferType", "status", "bankCode", "bankName", "accountNumber", "accountName", "workflowId", "otpReference", "otpIssuedAt", "confirmedAt", "approvalState") VALUES
  ('customer_transferid_1', 'customer_customerid_1', 'customer_beneficiaryid_1', 'customerTransfers_beneficiaryname_1', 480335087.96, 'customerTransfers_narration_1', 'standard', 'inactive', 'customer_bankcode_1', 'customerTransfers_bankname_1', '5489511724', 'customerTransfers_accountname_1', 'customer_workflowid_1', '54B-CUST-228948', '2026-02-25 00:00:00'::timestamp, '2026-02-12 00:00:00'::timestamp, 'Rivers'),
  ('customer_transferid_2', 'customer_customerid_2', 'customer_beneficiaryid_2', 'customerTransfers_beneficiaryname_2', 279207612.08, 'customerTransfers_narration_2', 'standard', 'inactive', 'customer_bankcode_2', 'customerTransfers_bankname_2', '5437035507', 'customerTransfers_accountname_2', 'customer_workflowid_2', '54B-CUST-759899', '2025-11-25 00:00:00'::timestamp, '2025-12-03 00:00:00'::timestamp, 'Ogun'),
  ('customer_transferid_3', 'customer_customerid_3', 'customer_beneficiaryid_3', 'customerTransfers_beneficiaryname_3', 108098034.67, 'customerTransfers_narration_3', 'premium', 'pending', 'customer_bankcode_3', 'customerTransfers_bankname_3', '5488446874', 'customerTransfers_accountname_3', 'customer_workflowid_3', '54B-CUST-190323', '2025-08-21 00:00:00'::timestamp, '2026-04-25 00:00:00'::timestamp, 'Lagos');

-- Table: customerApprovals (15 columns, inserting 13)
INSERT INTO "customerApprovals" ("approvalId", "customerId", "entityType", "entityId", "title", "detail", "route", "state", "requestedByRole", "requestedById", "approvalRole", "resolvedAt", "resolutionNote") VALUES
  ('customer_approvalid_1', 'customer_customerid_1', 'standard', 'customer_entityid_1', 'customerApprovals_title_1', '54Bank customerApprovals record 1', 'customerApprovals_route_1', 'Abuja', 'branch_manager', 'customer_requestedbyid_1', 'user', '2025-09-16 00:00:00'::timestamp, '54Bank customerApprovals record 1'),
  ('customer_approvalid_2', 'customer_customerid_2', 'premium', 'customer_entityid_2', 'customerApprovals_title_2', '54Bank customerApprovals record 2', 'customerApprovals_route_2', 'Imo', 'branch_manager', 'customer_requestedbyid_2', 'admin', '2026-01-18 00:00:00'::timestamp, '54Bank customerApprovals record 2'),
  ('customer_approvalid_3', 'customer_customerid_3', 'standard', 'customer_entityid_3', 'customerApprovals_title_3', '54Bank customerApprovals record 3', 'customerApprovals_route_3', 'Oyo', 'user', 'customer_requestedbyid_3', 'user', '2026-02-22 00:00:00'::timestamp, '54Bank customerApprovals record 3');

-- Table: customerStatementExports (8 columns, inserting 6)
INSERT INTO "customerStatementExports" ("exportRequestId", "customerId", "exportJobId", "format", "rowCount", "title") VALUES
  ('customer_exportrequestid_1', 'customer_customerid_1', 'customer_exportjobid_1', 'customerStatementExports_format_1', 110, 'customerStatementExports_title_1'),
  ('customer_exportrequestid_2', 'customer_customerid_2', 'customer_exportjobid_2', 'customerStatementExports_format_2', 59, 'customerStatementExports_title_2'),
  ('customer_exportrequestid_3', 'customer_customerid_3', 'customer_exportjobid_3', 'customerStatementExports_format_3', 210, 'customerStatementExports_title_3');

-- Table: customerStatements (13 columns, inserting 10)
INSERT INTO "customerStatements" ("statementId", "customerId", "title", "detail", "amount", "direction", "statementType", "status", "reference", "category") VALUES
  ('Imo', 'customer_customerid_1', 'customerStatements_title_1', '54Bank customerStatements record 1', 381600721.12, 'customerStatements_direction_1', 'Enugu', 'active', '54B-CUST-508677', 'basic'),
  ('Enugu', 'customer_customerid_2', 'customerStatements_title_2', '54Bank customerStatements record 2', 466074293.03, 'customerStatements_direction_2', 'Kaduna', 'rejected', '54B-CUST-488913', 'standard'),
  ('Oyo', 'customer_customerid_3', 'customerStatements_title_3', '54Bank customerStatements record 3', 323723143.46, 'customerStatements_direction_3', 'Anambra', 'active', '54B-CUST-526560', 'standard');

-- Table: customerNotifications (9 columns, inserting 7)
INSERT INTO "customerNotifications" ("notificationId", "customerId", "title", "message", "notificationType", "isRead", "actionUrl") VALUES
  ('customer_notificationid_1', 'customer_customerid_1', 'customerNotifications_title_1', 'customerNotifications_message_1', 'premium', 68, 'https://api.54bank.ng/v1/customerNotifications/1'),
  ('customer_notificationid_2', 'customer_customerid_2', 'customerNotifications_title_2', 'customerNotifications_message_2', 'premium', 3, 'https://api.54bank.ng/v1/customerNotifications/2'),
  ('customer_notificationid_3', 'customer_customerid_3', 'customerNotifications_title_3', 'customerNotifications_message_3', 'standard', 22, 'https://api.54bank.ng/v1/customerNotifications/3');

-- Table: customerSessionPreferences (7 columns, inserting 4)
INSERT INTO "customerSessionPreferences" ("actorId", "actorRole", "tenantId", "activeCustomerId") VALUES
  ('customer_actorid_1', 'teller', 'tenant-ph-south', 'customer_activecustomerid_1'),
  ('customer_actorid_2', 'branch_manager', 'tenant-lagos-main', 'customer_activecustomerid_2'),
  ('customer_actorid_3', 'admin', 'tenant-abuja-hq', 'customer_activecustomerid_3');

-- Table: workflowCases (12 columns, inserting 9)
INSERT INTO "workflowCases" ("workflowId", "customer", "product", "stage", "status", "channel", "amount", "nextAction", "slaHours") VALUES
  ('workflow_workflowid_1', 'workflowCases_customer_1', 'workflowCases_product_1', 'workflowCases_stage_1', 'pending', 'workflowCases_channel_1', 56650183.17, 'workflowCases_nextaction_1', 82),
  ('workflow_workflowid_2', 'workflowCases_customer_2', 'workflowCases_product_2', 'workflowCases_stage_2', 'rejected', 'workflowCases_channel_2', 437664121.18, 'workflowCases_nextaction_2', 71),
  ('workflow_workflowid_3', 'workflowCases_customer_3', 'workflowCases_product_3', 'workflowCases_stage_3', 'active', 'workflowCases_channel_3', 163707676.23, 'workflowCases_nextaction_3', 88);

-- Table: operatorActions (12 columns, inserting 9)
INSERT INTO "operatorActions" ("actionId", "domainKey", "title", "detail", "owner", "dueAt", "route", "status", "roles") VALUES
  ('operator_actionid_1', 'operator_domainkey_1', 'operatorActions_title_1', '54Bank operatorActions record 1', 'operatorActions_owner_1', '2026-04-06 00:00:00'::timestamp, 'operatorActions_route_1', 'approved', '{"key": "value"}'::jsonb),
  ('operator_actionid_2', 'operator_domainkey_2', 'operatorActions_title_2', '54Bank operatorActions record 2', 'operatorActions_owner_2', '2025-05-29 00:00:00'::timestamp, 'operatorActions_route_2', 'inactive', '{"key": "value"}'::jsonb),
  ('operator_actionid_3', 'operator_domainkey_3', 'operatorActions_title_3', '54Bank operatorActions record 3', 'operatorActions_owner_3', '2025-09-23 00:00:00'::timestamp, 'operatorActions_route_3', 'active', '{"key": "value"}'::jsonb);

-- Table: auditEntries (13 columns, inserting 11)
INSERT INTO "auditEntries" ("auditId", "actorRole", "actorId", "entityType", "entityId", "action", "outcome", "severity", "route", "middleware", "detail") VALUES
  ('auditEnt_auditid_1', 'branch_manager', 'auditEnt_actorid_1', 'premium', 'auditEnt_entityid_1', 'auditEntries_action_1', 'auditEntries_outcome_1', 'auditEntries_severity_1', 'auditEntries_route_1', '{"key": "value"}'::jsonb, '54Bank auditEntries record 1'),
  ('auditEnt_auditid_2', 'user', 'auditEnt_actorid_2', 'standard', 'auditEnt_entityid_2', 'auditEntries_action_2', 'auditEntries_outcome_2', 'auditEntries_severity_2', 'auditEntries_route_2', '{"key": "value"}'::jsonb, '54Bank auditEntries record 2'),
  ('auditEnt_auditid_3', 'user', 'auditEnt_actorid_3', 'basic', 'auditEnt_entityid_3', 'auditEntries_action_3', 'auditEntries_outcome_3', 'auditEntries_severity_3', 'auditEntries_route_3', '{"key": "value"}'::jsonb, '54Bank auditEntries record 3');

-- Table: exportJobs (17 columns, inserting 15)
INSERT INTO "exportJobs" ("exportJobId", "domainKey", "title", "format", "status", "requestedByRole", "route", "rowCount", "approvalState", "approvalSignature", "downloadUrl", "retainedUntil", "reportVersion", "approvalChain", "signedBy") VALUES
  ('exportJo_exportjobid_1', 'exportJo_domainkey_1', 'exportJobs_title_1', 'exportJobs_format_1', 'approved', 'teller', 'exportJobs_route_1', 496, 'Ogun', 'exportJobs_approvalsignature_1', 'https://api.54bank.ng/v1/exportJobs/1', '2025-09-25 00:00:00'::timestamp, 'exportJobs_reportversion_1', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb),
  ('exportJo_exportjobid_2', 'exportJo_domainkey_2', 'exportJobs_title_2', 'exportJobs_format_2', 'pending', 'teller', 'exportJobs_route_2', 431, 'Enugu', 'exportJobs_approvalsignature_2', 'https://api.54bank.ng/v1/exportJobs/2', '2025-05-19 00:00:00'::timestamp, 'exportJobs_reportversion_2', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb),
  ('exportJo_exportjobid_3', 'exportJo_domainkey_3', 'exportJobs_title_3', 'exportJobs_format_3', 'approved', 'user', 'exportJobs_route_3', 223, 'Rivers', 'exportJobs_approvalsignature_3', 'https://api.54bank.ng/v1/exportJobs/3', '2025-07-19 00:00:00'::timestamp, 'exportJobs_reportversion_3', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb);

-- Table: billingAccounts (15 columns, inserting 12)
INSERT INTO "billingAccounts" ("billingAccountId", "tenantId", "accountName", "billingModel", "currency", "status", "contractStartAt", "contractEndAt", "defaultRateCardId", "minimumCommitAmount", "defaultBillingPeriodType", "invoiceDueDays") VALUES
  ('billingA_billingaccountid_1', 'tenant-kano-north', 'billingAccounts_accountname_1', 'billingAccounts_billingmodel_1', 'NGN', 'completed', '2026-04-28 00:00:00'::timestamp, '2025-09-11 00:00:00'::timestamp, 'billingA_defaultratecardid_1', 211744097.99, 'premium', 19),
  ('billingA_billingaccountid_2', 'tenant-abuja-hq', 'billingAccounts_accountname_2', 'billingAccounts_billingmodel_2', 'EUR', 'approved', '2025-10-27 00:00:00'::timestamp, '2026-04-21 00:00:00'::timestamp, 'billingA_defaultratecardid_2', 215257061.44, 'premium', 46),
  ('billingA_billingaccountid_3', 'tenant-lagos-main', 'billingAccounts_accountname_3', 'billingAccounts_billingmodel_3', 'EUR', 'pending', '2025-07-11 00:00:00'::timestamp, '2025-12-28 00:00:00'::timestamp, 'billingA_defaultratecardid_3', 448186403.29, 'premium', 49);

-- Table: billingRateCards (13 columns, inserting 10)
INSERT INTO "billingRateCards" ("rateCardId", "billingAccountId", "name", "version", "status", "effectiveFrom", "effectiveTo", "pricingCurrency", "createdBy", "approvalState") VALUES
  ('billingR_ratecardid_1', 'billingR_billingaccountid_1', 'Kemi Adeyemi', 41, 'pending', '2025-11-04 00:00:00'::timestamp, '2025-08-17 00:00:00'::timestamp, 'USD', 'billingRateCards_createdby_1', 'Anambra'),
  ('billingR_ratecardid_2', 'billingR_billingaccountid_2', 'Oando Energy', 36, 'pending', '2025-07-28 00:00:00'::timestamp, '2026-03-06 00:00:00'::timestamp, 'NGN', 'billingRateCards_createdby_2', 'Anambra'),
  ('billingR_ratecardid_3', 'billingR_billingaccountid_3', 'Ngozi Okafor', 39, 'approved', '2026-03-28 00:00:00'::timestamp, '2025-09-07 00:00:00'::timestamp, 'NGN', 'billingRateCards_createdby_3', 'Oyo');

-- Table: billingRateCardLines (16 columns, inserting 13)
INSERT INTO "billingRateCardLines" ("rateCardLineId", "rateCardId", "meterKey", "productKey", "chargeType", "unitPrice", "includedUnits", "tierStart", "tierEnd", "minimumCharge", "maximumCharge", "pricingFormula", "settlementLedgerCode") VALUES
  ('billingR_ratecardlineid_1', 'billingR_ratecardid_1', 'billingR_meterkey_1', 'billingR_productkey_1', 'basic', 15.6326, 1, 5, 80, 35.4598, 3.5806, '{"key": "value"}'::jsonb, 'billingR_settlementledgercode_1'),
  ('billingR_ratecardlineid_2', 'billingR_ratecardid_2', 'billingR_meterkey_2', 'billingR_productkey_2', 'standard', 74.2111, 74, 23, 56, 92.9739, 55.8189, '{"key": "value"}'::jsonb, 'billingR_settlementledgercode_2'),
  ('billingR_ratecardlineid_3', 'billingR_ratecardid_3', 'billingR_meterkey_3', 'billingR_productkey_3', 'basic', 6.8149, 40, 76, 27, 81.8076, 30.532, '{"key": "value"}'::jsonb, 'billingR_settlementledgercode_3');

-- Table: billingUsageEvents (20 columns, inserting 17)
INSERT INTO "billingUsageEvents" ("usageEventId", "idempotencyKey", "tenantId", "billingAccountId", "sourceService", "sourceEventType", "meterKey", "productKey", "quantity", "unitAmount", "currency", "eventTimestamp", "correlationId", "actorId", "resourceId", "payload", "status") VALUES
  ('billingU_usageeventid_1', 'billingU_idempotencykey_1', 'tenant-ph-south', 'billingU_billingaccountid_1', 'billingUsageEvents_sourceservice_1', 'standard', 'billingU_meterkey_1', 'billingU_productkey_1', 412, 343210513.67, 'NGN', '2026-01-23 00:00:00'::timestamp, 'billingU_correlationid_1', 'billingU_actorid_1', 'billingU_resourceid_1', '{"key": "value"}'::jsonb, 'inactive'),
  ('billingU_usageeventid_2', 'billingU_idempotencykey_2', 'tenant-ph-south', 'billingU_billingaccountid_2', 'billingUsageEvents_sourceservice_2', 'basic', 'billingU_meterkey_2', 'billingU_productkey_2', 62, 243976632.01, 'GBP', '2025-05-22 00:00:00'::timestamp, 'billingU_correlationid_2', 'billingU_actorid_2', 'billingU_resourceid_2', '{"key": "value"}'::jsonb, 'inactive'),
  ('billingU_usageeventid_3', 'billingU_idempotencykey_3', 'tenant-ph-south', 'billingU_billingaccountid_3', 'billingUsageEvents_sourceservice_3', 'premium', 'billingU_meterkey_3', 'billingU_productkey_3', 295, 18708755.27, 'USD', '2026-01-22 00:00:00'::timestamp, 'billingU_correlationid_3', 'billingU_actorid_3', 'billingU_resourceid_3', '{"key": "value"}'::jsonb, 'completed');

-- Table: billingRatedEvents (12 columns, inserting 10)
INSERT INTO "billingRatedEvents" ("ratedEventId", "usageEventId", "rateCardId", "rateCardLineId", "billingPeriodKey", "quantityRated", "billableUnits", "amountAccrued", "currency", "ratingExplanation") VALUES
  ('billingR_ratedeventid_1', 'billingR_usageeventid_1', 'billingR_ratecardid_1', 'billingR_ratecardlineid_1', 'billingR_billingperiodkey_1', 376, 19.2787, 119561145.39, 'USD', '{"key": "value"}'::jsonb),
  ('billingR_ratedeventid_2', 'billingR_usageeventid_2', 'billingR_ratecardid_2', 'billingR_ratecardlineid_2', 'billingR_billingperiodkey_2', 462, 81.9008, 481030520.75, 'EUR', '{"key": "value"}'::jsonb),
  ('billingR_ratedeventid_3', 'billingR_usageeventid_3', 'billingR_ratecardid_3', 'billingR_ratecardlineid_3', 'billingR_billingperiodkey_3', 289, 64.705, 476004285.17, 'GBP', '{"key": "value"}'::jsonb);

-- Table: billingAccrualSnapshots (16 columns, inserting 13)
INSERT INTO "billingAccrualSnapshots" ("accrualSnapshotId", "tenantId", "billingAccountId", "billingPeriodKey", "meterKey", "productKey", "ratedEventCount", "usageQuantity", "accruedAmount", "unratedEventCount", "lastUsageAt", "lastRatedAt", "snapshotStatus") VALUES
  ('billingA_accrualsnapshotid_1', 'tenant-lagos-main', 'billingA_billingaccountid_1', 'billingA_billingperiodkey_1', 'billingA_meterkey_1', 'billingA_productkey_1', 440, 138, 494450845.58, 93, '2025-08-21 00:00:00'::timestamp, '2026-02-22 00:00:00'::timestamp, 'completed'),
  ('billingA_accrualsnapshotid_2', 'tenant-kano-north', 'billingA_billingaccountid_2', 'billingA_billingperiodkey_2', 'billingA_meterkey_2', 'billingA_productkey_2', 202, 72, 121728461.38, 388, '2025-09-01 00:00:00'::timestamp, '2025-09-17 00:00:00'::timestamp, 'completed'),
  ('billingA_accrualsnapshotid_3', 'tenant-kano-north', 'billingA_billingaccountid_3', 'billingA_billingperiodkey_3', 'billingA_meterkey_3', 'billingA_productkey_3', 430, 152, 277697759.85, 66, '2025-12-06 00:00:00'::timestamp, '2026-03-13 00:00:00'::timestamp, 'rejected');

-- Table: billingContractOverrides (16 columns, inserting 13)
INSERT INTO "billingContractOverrides" ("contractOverrideId", "billingAccountId", "tenantId", "overrideType", "meterKey", "productKey", "valueNumber", "valueText", "effectiveFrom", "effectiveTo", "status", "createdBy", "notes") VALUES
  ('billingC_contractoverrideid_1', 'billingC_billingaccountid_1', 'tenant-lagos-main', 'standard', 'billingC_meterkey_1', 'billingC_productkey_1', 282986737.24, 'billingContractOverrides_valuetext_1', '2025-10-09 00:00:00'::timestamp, '2026-03-16 00:00:00'::timestamp, 'inactive', 'billingContractOverrides_createdby_1', '54Bank billingContractOverrides record 1'),
  ('billingC_contractoverrideid_2', 'billingC_billingaccountid_2', 'tenant-ph-south', 'premium', 'billingC_meterkey_2', 'billingC_productkey_2', 169835576.21, 'billingContractOverrides_valuetext_2', '2025-12-22 00:00:00'::timestamp, '2026-02-07 00:00:00'::timestamp, 'rejected', 'billingContractOverrides_createdby_2', '54Bank billingContractOverrides record 2'),
  ('billingC_contractoverrideid_3', 'billingC_billingaccountid_3', 'tenant-kano-north', 'standard', 'billingC_meterkey_3', 'billingC_productkey_3', 416572940.76, 'billingContractOverrides_valuetext_3', '2026-03-25 00:00:00'::timestamp, '2025-06-26 00:00:00'::timestamp, 'rejected', 'billingContractOverrides_createdby_3', '54Bank billingContractOverrides record 3');

-- Table: billingDiscountRules (17 columns, inserting 14)
INSERT INTO "billingDiscountRules" ("discountRuleId", "billingAccountId", "tenantId", "name", "discountType", "meterKey", "productKey", "percentage", "fixedAmount", "thresholdAmount", "effectiveFrom", "effectiveTo", "status", "createdBy") VALUES
  ('billingD_discountruleid_1', 'billingD_billingaccountid_1', 'tenant-lagos-main', 'Yetunde Olowe', 'premium', 'billingD_meterkey_1', 'billingD_productkey_1', 1.5345, 41145405.65, 289193453.86, '2025-09-12 00:00:00'::timestamp, '2025-09-05 00:00:00'::timestamp, 'inactive', 'billingDiscountRules_createdby_1'),
  ('billingD_discountruleid_2', 'billingD_billingaccountid_2', 'tenant-abuja-hq', 'Emeka & Sons Trading', 'standard', 'billingD_meterkey_2', 'billingD_productkey_2', 15.6377, 206029577.65, 18624795.43, '2026-01-08 00:00:00'::timestamp, '2026-05-08 00:00:00'::timestamp, 'completed', 'billingDiscountRules_createdby_2'),
  ('billingD_discountruleid_3', 'billingD_billingaccountid_3', 'tenant-lagos-main', 'Ngozi Okafor', 'premium', 'billingD_meterkey_3', 'billingD_productkey_3', 24.4449, 316554298.53, 19621450.67, '2025-05-29 00:00:00'::timestamp, '2025-07-25 00:00:00'::timestamp, 'active', 'billingDiscountRules_createdby_3');

-- Table: billingRevenueShareRules (15 columns, inserting 12)
INSERT INTO "billingRevenueShareRules" ("revenueShareRuleId", "billingAccountId", "tenantId", "name", "target", "percentage", "beneficiaryName", "settlementLedgerCode", "effectiveFrom", "effectiveTo", "status", "createdBy") VALUES
  ('billingR_revenueshareruleid_1', 'billingR_billingaccountid_1', 'tenant-lagos-main', 'Kemi Adeyemi', 'billingRevenueShareRules_target_1', 6.9101, 'billingRevenueShareRules_beneficiaryname_1', 'billingR_settlementledgercode_1', '2026-01-12 00:00:00'::timestamp, '2025-07-25 00:00:00'::timestamp, 'inactive', 'billingRevenueShareRules_createdby_1'),
  ('billingR_revenueshareruleid_2', 'billingR_billingaccountid_2', 'tenant-lagos-main', 'Kano Textiles Ltd', 'billingRevenueShareRules_target_2', 21.0086, 'billingRevenueShareRules_beneficiaryname_2', 'billingR_settlementledgercode_2', '2025-11-10 00:00:00'::timestamp, '2025-10-05 00:00:00'::timestamp, 'pending', 'billingRevenueShareRules_createdby_2'),
  ('billingR_revenueshareruleid_3', 'billingR_billingaccountid_3', 'tenant-lagos-main', 'Folake Adeniyi', 'billingRevenueShareRules_target_3', 6.8424, 'billingRevenueShareRules_beneficiaryname_3', 'billingR_settlementledgercode_3', '2025-11-22 00:00:00'::timestamp, '2025-07-04 00:00:00'::timestamp, 'inactive', 'billingRevenueShareRules_createdby_3');

-- Table: billingInvoices (24 columns, inserting 20)
INSERT INTO "billingInvoices" ("billingInvoiceId", "invoiceNumber", "tenantId", "billingAccountId", "billingPeriodKey", "billingPeriodType", "periodStartAt", "periodEndAt", "currency", "subtotalAmount", "discountAmount", "revenueShareAmount", "minimumCommitAdjustment", "taxAmount", "totalAmount", "status", "approvalStatus", "dueAt", "approvalStepCount", "issuedAt") VALUES
  ('billingI_billinginvoiceid_1', 'billingI_invoicenumber_1', 'tenant-abuja-hq', 'billingI_billingaccountid_1', 'billingI_billingperiodkey_1', 'basic', '2025-08-04 00:00:00'::timestamp, '2025-06-21 00:00:00'::timestamp, 'USD', 466587369.27, 387397023.81, 159835656.46, 67.6299, 442017744.99, 294653347.35, 'inactive', 'approved', '2025-10-02 00:00:00'::timestamp, 149, '2025-12-10 00:00:00'::timestamp),
  ('billingI_billinginvoiceid_2', 'billingI_invoicenumber_2', 'tenant-kano-north', 'billingI_billingaccountid_2', 'billingI_billingperiodkey_2', 'basic', '2026-04-19 00:00:00'::timestamp, '2025-09-23 00:00:00'::timestamp, 'NGN', 410122844.99, 426454046.82, 74409985.68, 86.7438, 156841388.05, 445595045.51, 'completed', 'active', '2025-06-21 00:00:00'::timestamp, 54, '2025-06-19 00:00:00'::timestamp),
  ('billingI_billinginvoiceid_3', 'billingI_invoicenumber_3', 'tenant-lagos-main', 'billingI_billingaccountid_3', 'billingI_billingperiodkey_3', 'basic', '2025-06-26 00:00:00'::timestamp, '2025-11-04 00:00:00'::timestamp, 'NGN', 491206187.85, 431702940.28, 229379146.78, 80.5759, 438164051.33, 399558923.27, 'approved', 'rejected', '2025-12-22 00:00:00'::timestamp, 145, '2025-07-25 00:00:00'::timestamp);

-- Table: billingInvoiceLines (12 columns, inserting 10)
INSERT INTO "billingInvoiceLines" ("billingInvoiceLineId", "billingInvoiceId", "lineType", "meterKey", "productKey", "description", "quantity", "unitPrice", "amount", "metadata") VALUES
  ('billingI_billinginvoicelineid_1', 'billingI_billinginvoiceid_1', 'basic', 'billingI_meterkey_1', 'billingI_productkey_1', '54Bank billingInvoiceLines record 1', 53.135, 35.1282, 465949090.74, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('billingI_billinginvoicelineid_2', 'billingI_billinginvoiceid_2', 'basic', 'billingI_meterkey_2', 'billingI_productkey_2', '54Bank billingInvoiceLines record 2', 9.9438, 30.0361, 294988402.24, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('billingI_billinginvoicelineid_3', 'billingI_billinginvoiceid_3', 'premium', 'billingI_meterkey_3', 'billingI_productkey_3', '54Bank billingInvoiceLines record 3', 71.3329, 83.0375, 426764987.71, '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: billingInvoiceApprovals (10 columns, inserting 7)
INSERT INTO "billingInvoiceApprovals" ("billingInvoiceApprovalId", "billingInvoiceId", "stageKey", "actorRole", "status", "actedAt", "note") VALUES
  ('billingI_billinginvoiceapprovalid_1', 'billingI_billinginvoiceid_1', 'billingI_stagekey_1', 'branch_manager', 'completed', '2026-04-10 00:00:00'::timestamp, '54Bank billingInvoiceApprovals record 1'),
  ('billingI_billinginvoiceapprovalid_2', 'billingI_billinginvoiceid_2', 'billingI_stagekey_2', 'admin', 'approved', '2026-04-01 00:00:00'::timestamp, '54Bank billingInvoiceApprovals record 2'),
  ('billingI_billinginvoiceapprovalid_3', 'billingI_billinginvoiceid_3', 'billingI_stagekey_3', 'teller', 'completed', '2025-09-30 00:00:00'::timestamp, '54Bank billingInvoiceApprovals record 3');

-- Table: partnerOnboardingRecords (22 columns, inserting 19)
INSERT INTO "partnerOnboardingRecords" ("partnerId", "tenantId", "partnerName", "legalEntity", "partnerType", "region", "stage", "requestedModules", "primaryContact", "operationsContact", "commercial", "compliance", "branding", "checklist", "blockers", "readinessScore", "submittedAt", "launchedAt", "lastSubmittedBy") VALUES
  ('partnerO_partnerid_1', 'tenant-kano-north', 'partnerOnboardingRecords_partnername_1', 'partnerOnboardingRecords_legalentity_1', 'premium', 'Nigeria', 'partnerOnboardingRecords_stage_1', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 97, '2026-03-25 00:00:00'::timestamp, '2026-03-27 00:00:00'::timestamp, 'partnerOnboardingRecords_lastsubmittedby_1'),
  ('partnerO_partnerid_2', 'tenant-kano-north', 'partnerOnboardingRecords_partnername_2', 'partnerOnboardingRecords_legalentity_2', 'premium', 'Nigeria', 'partnerOnboardingRecords_stage_2', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 7, '2026-02-18 00:00:00'::timestamp, '2025-11-15 00:00:00'::timestamp, 'partnerOnboardingRecords_lastsubmittedby_2'),
  ('partnerO_partnerid_3', 'tenant-ph-south', 'partnerOnboardingRecords_partnername_3', 'partnerOnboardingRecords_legalentity_3', 'standard', 'Nigeria', 'partnerOnboardingRecords_stage_3', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 47, '2025-12-13 00:00:00'::timestamp, '2025-05-20 00:00:00'::timestamp, 'partnerOnboardingRecords_lastsubmittedby_3');

-- Table: partnerApprovalRecords (12 columns, inserting 10)
INSERT INTO "partnerApprovalRecords" ("approvalId", "partnerId", "stage", "title", "detail", "state", "requiredRole", "requestedById", "resolvedAt", "resolutionNote") VALUES
  ('partnerA_approvalid_1', 'partnerA_partnerid_1', 'partnerApprovalRecords_stage_1', 'partnerApprovalRecords_title_1', '54Bank partnerApprovalRecords record 1', 'Oyo', 'user', 'partnerA_requestedbyid_1', '2026-03-07 00:00:00'::timestamp, '54Bank partnerApprovalRecords record 1'),
  ('partnerA_approvalid_2', 'partnerA_partnerid_2', 'partnerApprovalRecords_stage_2', 'partnerApprovalRecords_title_2', '54Bank partnerApprovalRecords record 2', 'Enugu', 'teller', 'partnerA_requestedbyid_2', '2025-10-18 00:00:00'::timestamp, '54Bank partnerApprovalRecords record 2'),
  ('partnerA_approvalid_3', 'partnerA_partnerid_3', 'partnerApprovalRecords_stage_3', 'partnerApprovalRecords_title_3', '54Bank partnerApprovalRecords record 3', 'Abuja', 'branch_manager', 'partnerA_requestedbyid_3', '2025-11-23 00:00:00'::timestamp, '54Bank partnerApprovalRecords record 3');

-- Table: farmers (21 columns, inserting 18)
INSERT INTO "farmers" ("farmerId", "tenantId", "name", "bvn", "phone", "region", "localGovernment", "farmSizeHectares", "primaryCrop", "secondaryCrops", "cooperativeId", "cooperativeName", "bankAccountNumber", "riskScore", "riskTier", "status", "geoCoordinates", "registrationChannel") VALUES
  ('farmers_farmerid_1', 'tenant-lagos-main', 'Amina Yusuf', '22885809644', '+2348209310742', 'Nigeria', 'farmers_localgovernment_1', 84.7893, 'farmers_primarycrop_1', '{"key": "value"}'::jsonb, 'farmers_cooperativeid_1', 'farmers_cooperativename_1', '5485204967', 5.4554, 'tier_3', 'rejected', '{"key": "value"}'::jsonb, 'farmers_registrationchannel_1'),
  ('farmers_farmerid_2', 'tenant-kano-north', 'Lagos Agro-Allied Co', '22864167493', '+2347638506159', 'Nigeria', 'farmers_localgovernment_2', 72.0563, 'farmers_primarycrop_2', '{"key": "value"}'::jsonb, 'farmers_cooperativeid_2', 'farmers_cooperativename_2', '5488535488', 12.056, 'tier_2', 'pending', '{"key": "value"}'::jsonb, 'farmers_registrationchannel_2'),
  ('farmers_farmerid_3', 'tenant-ph-south', 'Aisha Mohammed', '22986081525', '+2347560889487', 'Nigeria', 'farmers_localgovernment_3', 82.2117, 'farmers_primarycrop_3', '{"key": "value"}'::jsonb, 'farmers_cooperativeid_3', 'farmers_cooperativename_3', '5475161424', 19.2595, 'tier_1', 'active', '{"key": "value"}'::jsonb, 'farmers_registrationchannel_3');

-- Table: agriLoans (25 columns, inserting 22)
INSERT INTO "agriLoans" ("loanId", "tenantId", "farmerId", "loanType", "productCode", "principalAmount", "interestRateBps", "tenorMonths", "currency", "purpose", "collateralType", "collateralValue", "cropCycle", "expectedHarvestDate", "disbursementDate", "maturityDate", "outstandingBalance", "totalRepaid", "status", "approvalStatus", "riskGrade", "repaymentSchedule") VALUES
  ('agriLoan_loanid_1', 'tenant-kano-north', 'agriLoan_farmerid_1', 'standard', 'agriLoan_productcode_1', 435866909.44, 81, 96, 'EUR', '54Bank agriLoans record 1', 'basic', 182696120.25, 'agriLoans_cropcycle_1', 'agriLoans_expectedharvestdate_1', 'agriLoans_disbursementdate_1', 'agriLoans_maturitydate_1', 145847116.47, 38.8377, 'pending', 'rejected', 'agriLoans_riskgrade_1', '{"key": "value"}'::jsonb),
  ('agriLoan_loanid_2', 'tenant-abuja-hq', 'agriLoan_farmerid_2', 'premium', 'agriLoan_productcode_2', 234426624.24, 42, 25, 'GBP', '54Bank agriLoans record 2', 'standard', 123229530.12, 'agriLoans_cropcycle_2', 'agriLoans_expectedharvestdate_2', 'agriLoans_disbursementdate_2', 'agriLoans_maturitydate_2', 441418286.13, 36.0049, 'completed', 'inactive', 'agriLoans_riskgrade_2', '{"key": "value"}'::jsonb),
  ('agriLoan_loanid_3', 'tenant-lagos-main', 'agriLoan_farmerid_3', 'standard', 'agriLoan_productcode_3', 499822879.95, 78, 36, 'GBP', '54Bank agriLoans record 3', 'premium', 136599271.58, 'agriLoans_cropcycle_3', 'agriLoans_expectedharvestdate_3', 'agriLoans_disbursementdate_3', 'agriLoans_maturitydate_3', 70164915.0, 33.3153, 'inactive', 'completed', 'agriLoans_riskgrade_3', '{"key": "value"}'::jsonb);

-- Table: cropInsurancePolicies (18 columns, inserting 15)
INSERT INTO "cropInsurancePolicies" ("policyId", "tenantId", "farmerId", "policyType", "cropCovered", "coverageAreaHectares", "sumInsured", "premiumAmount", "premiumFrequency", "policyStart", "policyEnd", "weatherTrigger", "claims", "status", "underwriter") VALUES
  ('cropInsu_policyid_1', 'tenant-lagos-main', 'cropInsu_farmerid_1', 'basic', 'cropInsurancePolicies_cropcovered_1', 32.0016, 78.3966, 83082317.89, 'cropInsurancePolicies_premiumfrequency_1', 'cropInsurancePolicies_policystart_1', 'cropInsurancePolicies_policyend_1', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'completed', 'cropInsurancePolicies_underwriter_1'),
  ('cropInsu_policyid_2', 'tenant-abuja-hq', 'cropInsu_farmerid_2', 'premium', 'cropInsurancePolicies_cropcovered_2', 8.5175, 78.8697, 475616072.96, 'cropInsurancePolicies_premiumfrequency_2', 'cropInsurancePolicies_policystart_2', 'cropInsurancePolicies_policyend_2', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'inactive', 'cropInsurancePolicies_underwriter_2'),
  ('cropInsu_policyid_3', 'tenant-lagos-main', 'cropInsu_farmerid_3', 'basic', 'cropInsurancePolicies_cropcovered_3', 94.6629, 32.5236, 335309872.55, 'cropInsurancePolicies_premiumfrequency_3', 'cropInsurancePolicies_policystart_3', 'cropInsurancePolicies_policyend_3', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'approved', 'cropInsurancePolicies_underwriter_3');

-- Table: valueChainContracts (20 columns, inserting 17)
INSERT INTO "valueChainContracts" ("contractId", "tenantId", "contractType", "buyerName", "buyerId", "sellerFarmerId", "commodity", "quantityTonnes", "pricePerTonne", "totalValue", "currency", "deliveryLocation", "deliveryDeadline", "warehouseReceiptId", "qualityGrade", "milestones", "status") VALUES
  ('valueCha_contractid_1', 'tenant-lagos-main', 'standard', 'valueChainContracts_buyername_1', 'valueCha_buyerid_1', 'valueCha_sellerfarmerid_1', 'valueChainContracts_commodity_1', 80.207, 39.3858, 460809365.33, 'EUR', 'Imo', 'valueChainContracts_deliverydeadline_1', 'valueCha_warehousereceiptid_1', 'valueChainContracts_qualitygrade_1', '{"key": "value"}'::jsonb, 'inactive'),
  ('valueCha_contractid_2', 'tenant-kano-north', 'premium', 'valueChainContracts_buyername_2', 'valueCha_buyerid_2', 'valueCha_sellerfarmerid_2', 'valueChainContracts_commodity_2', 63.4831, 55.6734, 77346390.32, 'EUR', 'Oyo', 'valueChainContracts_deliverydeadline_2', 'valueCha_warehousereceiptid_2', 'valueChainContracts_qualitygrade_2', '{"key": "value"}'::jsonb, 'rejected'),
  ('valueCha_contractid_3', 'tenant-lagos-main', 'premium', 'valueChainContracts_buyername_3', 'valueCha_buyerid_3', 'valueCha_sellerfarmerid_3', 'valueChainContracts_commodity_3', 95.3806, 11.8924, 22593131.14, 'EUR', 'Ogun', 'valueChainContracts_deliverydeadline_3', 'valueCha_warehousereceiptid_3', 'valueChainContracts_qualitygrade_3', '{"key": "value"}'::jsonb, 'pending');

-- Table: tellerSessions (17 columns, inserting 14)
INSERT INTO "tellerSessions" ("sessionId", "tenantId", "tellerId", "tellerName", "branchCode", "branchName", "windowNumber", "status", "openedAt", "closedAt", "openingBalance", "currentBalance", "transactionCount", "cashDrawer") VALUES
  ('tellerSe_sessionid_1', 'tenant-kano-north', 'tellerSe_tellerid_1', 'tellerSessions_tellername_1', 'LOS-001', 'ABJ-001', 99, 'approved', 'tellerSessions_openedat_1', 'tellerSessions_closedat_1', 220369841.16, 456234248.77, 154, '{"key": "value"}'::jsonb),
  ('tellerSe_sessionid_2', 'tenant-ph-south', 'tellerSe_tellerid_2', 'tellerSessions_tellername_2', 'ABJ-001', 'PHC-001', 58, 'approved', 'tellerSessions_openedat_2', 'tellerSessions_closedat_2', 198585113.13, 494312286.94, 211, '{"key": "value"}'::jsonb),
  ('tellerSe_sessionid_3', 'tenant-kano-north', 'tellerSe_tellerid_3', 'tellerSessions_tellername_3', 'LOS-001', 'LOS-001', 32, 'completed', 'tellerSessions_openedat_3', 'tellerSessions_closedat_3', 118706328.93, 463519381.22, 494, '{"key": "value"}'::jsonb);

-- Table: tellerTransactions (12 columns, inserting 10)
INSERT INTO "tellerTransactions" ("txnId", "sessionId", "tenantId", "txnType", "customerId", "amount", "currency", "reference", "status", "processedAt") VALUES
  ('tellerTr_txnid_1', 'tellerTr_sessionid_1', 'tenant-ph-south', 'basic', 'tellerTr_customerid_1', 255893746.46, 'GBP', '54B-TELL-455018', 'approved', 'tellerTransactions_processedat_1'),
  ('tellerTr_txnid_2', 'tellerTr_sessionid_2', 'tenant-kano-north', 'premium', 'tellerTr_customerid_2', 138212549.58, 'NGN', '54B-TELL-120231', 'completed', 'tellerTransactions_processedat_2'),
  ('tellerTr_txnid_3', 'tellerTr_sessionid_3', 'tenant-lagos-main', 'standard', 'tellerTr_customerid_3', 425273436.14, 'NGN', '54B-TELL-442340', 'inactive', 'tellerTransactions_processedat_3');

-- Table: vaultOperations (13 columns, inserting 11)
INSERT INTO "vaultOperations" ("operationId", "tenantId", "operationType", "fromLocation", "toLocation", "amount", "currency", "authorizedBy", "dualControlBy", "status", "reason") VALUES
  ('vaultOpe_operationid_1', 'tenant-kano-north', 'standard', 'Rivers', 'Abuja', 146080799.72, 'NGN', 'vaultOperations_authorizedby_1', 'vaultOperations_dualcontrolby_1', 'inactive', '54Bank vaultOperations record 1'),
  ('vaultOpe_operationid_2', 'tenant-kano-north', 'premium', 'Anambra', 'Kano', 497231429.79, 'EUR', 'vaultOperations_authorizedby_2', 'vaultOperations_dualcontrolby_2', 'approved', '54Bank vaultOperations record 2'),
  ('vaultOpe_operationid_3', 'tenant-kano-north', 'standard', 'Oyo', 'Enugu', 22962102.59, 'USD', 'vaultOperations_authorizedby_3', 'vaultOperations_dualcontrolby_3', 'pending', '54Bank vaultOperations record 3');

-- Table: murabahaContracts (23 columns, inserting 20)
INSERT INTO "murabahaContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "costPrice", "profitMarginPct", "sellingPrice", "currency", "tenorMonths", "instalmentAmount", "totalPaid", "outstandingBalance", "disbursementDate", "maturityDate", "status", "shariaCompliance", "shariaBoardReference", "instalmentSchedule") VALUES
  ('murabaha_contractid_1', 'tenant-lagos-main', 'murabaha_customerid_1', 'murabahaContracts_customername_1', '54Bank murabahaContracts record 1', 'standard', 26.4415, 22.6871, 70.782, 'NGN', 3, 497802228.5, 82.0633, 123082659.99, 'murabahaContracts_disbursementdate_1', 'murabahaContracts_maturitydate_1', 'rejected', 'murabahaContracts_shariacompliance_1', '54B-MURA-301358', '{"key": "value"}'::jsonb),
  ('murabaha_contractid_2', 'tenant-ph-south', 'murabaha_customerid_2', 'murabahaContracts_customername_2', '54Bank murabahaContracts record 2', 'basic', 94.8817, 51.1455, 7.6869, 'EUR', 62, 449291471.62, 93.9642, 39593509.77, 'murabahaContracts_disbursementdate_2', 'murabahaContracts_maturitydate_2', 'inactive', 'murabahaContracts_shariacompliance_2', '54B-MURA-537639', '{"key": "value"}'::jsonb),
  ('murabaha_contractid_3', 'tenant-ph-south', 'murabaha_customerid_3', 'murabahaContracts_customername_3', '54Bank murabahaContracts record 3', 'standard', 47.1148, 10.846, 98.3671, 'USD', 39, 299393695.63, 47.8762, 26265182.33, 'murabahaContracts_disbursementdate_3', 'murabahaContracts_maturitydate_3', 'pending', 'murabahaContracts_shariacompliance_3', '54B-MURA-879126', '{"key": "value"}'::jsonb);

-- Table: ijaraContracts (23 columns, inserting 20)
INSERT INTO "ijaraContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "assetValue", "rentalAmount", "rentalFrequency", "currency", "leaseStart", "leaseEnd", "tenorMonths", "residualValue", "purchaseOption", "purchasePrice", "totalRentPaid", "status", "shariaCompliance", "maintenanceResponsibility") VALUES
  ('ijaraCon_contractid_1', 'tenant-kano-north', 'ijaraCon_customerid_1', 'ijaraContracts_customername_1', '54Bank ijaraContracts record 1', 'premium', 86016168.61, 192886520.3, 'ijaraContracts_rentalfrequency_1', 'GBP', 'ijaraContracts_leasestart_1', 'ijaraContracts_leaseend_1', 51, 200863325.07, 36, 20.9597, 66.3491, 'pending', 'ijaraContracts_shariacompliance_1', 'ijaraContracts_maintenanceresponsibility_1'),
  ('ijaraCon_contractid_2', 'tenant-lagos-main', 'ijaraCon_customerid_2', 'ijaraContracts_customername_2', '54Bank ijaraContracts record 2', 'basic', 494428341.17, 444462520.48, 'ijaraContracts_rentalfrequency_2', 'EUR', 'ijaraContracts_leasestart_2', 'ijaraContracts_leaseend_2', 38, 66422521.6, 49, 78.4105, 49.3863, 'active', 'ijaraContracts_shariacompliance_2', 'ijaraContracts_maintenanceresponsibility_2'),
  ('ijaraCon_contractid_3', 'tenant-ph-south', 'ijaraCon_customerid_3', 'ijaraContracts_customername_3', '54Bank ijaraContracts record 3', 'basic', 385567641.64, 8441462.64, 'ijaraContracts_rentalfrequency_3', 'NGN', 'ijaraContracts_leasestart_3', 'ijaraContracts_leaseend_3', 99, 410372209.89, 29, 2.3554, 94.0798, 'completed', 'ijaraContracts_shariacompliance_3', 'ijaraContracts_maintenanceresponsibility_3');

-- Table: mudarabahContracts (22 columns, inserting 19)
INSERT INTO "mudarabahContracts" ("contractId", "tenantId", "investorId", "investorName", "fundManagerId", "investmentPurpose", "capitalAmount", "currency", "profitSharingRatioInvestor", "profitSharingRatioManager", "investmentPeriodMonths", "startDate", "maturityDate", "realizedProfit", "realizedLoss", "distributions", "status", "shariaCompliance", "riskCategory") VALUES
  ('mudaraba_contractid_1', 'tenant-lagos-main', 'mudaraba_investorid_1', 'mudarabahContracts_investorname_1', 'mudaraba_fundmanagerid_1', '54Bank mudarabahContracts record 1', 279245162.2, 'NGN', 57.0793, 23.7095, 44, 'mudarabahContracts_startdate_1', 'mudarabahContracts_maturitydate_1', 80.0765, 25.0344, '{"key": "value"}'::jsonb, 'rejected', 'mudarabahContracts_shariacompliance_1', 'standard'),
  ('mudaraba_contractid_2', 'tenant-abuja-hq', 'mudaraba_investorid_2', 'mudarabahContracts_investorname_2', 'mudaraba_fundmanagerid_2', '54Bank mudarabahContracts record 2', 345866551.45, 'USD', 30.7687, 22.0603, 26, 'mudarabahContracts_startdate_2', 'mudarabahContracts_maturitydate_2', 9.2141, 61.408, '{"key": "value"}'::jsonb, 'approved', 'mudarabahContracts_shariacompliance_2', 'standard'),
  ('mudaraba_contractid_3', 'tenant-kano-north', 'mudaraba_investorid_3', 'mudarabahContracts_investorname_3', 'mudaraba_fundmanagerid_3', '54Bank mudarabahContracts record 3', 491304028.79, 'EUR', 80.2393, 46.9922, 31, 'mudarabahContracts_startdate_3', 'mudarabahContracts_maturitydate_3', 67.3316, 59.8953, '{"key": "value"}'::jsonb, 'approved', 'mudarabahContracts_shariacompliance_3', 'premium');

-- Table: lettersOfCredit (24 columns, inserting 21)
INSERT INTO "lettersOfCredit" ("lcId", "tenantId", "lcType", "applicantId", "applicantName", "beneficiaryName", "beneficiaryBank", "beneficiaryCountry", "issuingBank", "advisingBank", "amount", "currency", "commodity", "incoterm", "portOfLoading", "portOfDischarge", "latestShipDate", "expiryDate", "documentsRequired", "amendments", "status") VALUES
  ('lettersO_lcid_1', 'tenant-ph-south', 'basic', 'lettersO_applicantid_1', 'lettersOfCredit_applicantname_1', 'lettersOfCredit_beneficiaryname_1', 'lettersOfCredit_beneficiarybank_1', 'Nigeria', 'lettersOfCredit_issuingbank_1', 'lettersOfCredit_advisingbank_1', 112046093.1, 'EUR', 'lettersOfCredit_commodity_1', 'lettersOfCredit_incoterm_1', 'lettersOfCredit_portofloading_1', 'lettersOfCredit_portofdischarge_1', 'lettersOfCredit_latestshipdate_1', 'lettersOfCredit_expirydate_1', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'pending'),
  ('lettersO_lcid_2', 'tenant-lagos-main', 'basic', 'lettersO_applicantid_2', 'lettersOfCredit_applicantname_2', 'lettersOfCredit_beneficiaryname_2', 'lettersOfCredit_beneficiarybank_2', 'Nigeria', 'lettersOfCredit_issuingbank_2', 'lettersOfCredit_advisingbank_2', 131606133.74, 'NGN', 'lettersOfCredit_commodity_2', 'lettersOfCredit_incoterm_2', 'lettersOfCredit_portofloading_2', 'lettersOfCredit_portofdischarge_2', 'lettersOfCredit_latestshipdate_2', 'lettersOfCredit_expirydate_2', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'pending'),
  ('lettersO_lcid_3', 'tenant-ph-south', 'premium', 'lettersO_applicantid_3', 'lettersOfCredit_applicantname_3', 'lettersOfCredit_beneficiaryname_3', 'lettersOfCredit_beneficiarybank_3', 'Nigeria', 'lettersOfCredit_issuingbank_3', 'lettersOfCredit_advisingbank_3', 131962698.5, 'NGN', 'lettersOfCredit_commodity_3', 'lettersOfCredit_incoterm_3', 'lettersOfCredit_portofloading_3', 'lettersOfCredit_portofdischarge_3', 'lettersOfCredit_latestshipdate_3', 'lettersOfCredit_expirydate_3', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'completed');

-- Table: warehouseReceipts (22 columns, inserting 19)
INSERT INTO "warehouseReceipts" ("receiptId", "tenantId", "depositorId", "depositorName", "warehouseId", "warehouseName", "location", "commodity", "quantity", "quantityUnit", "qualityGrade", "storageStartDate", "expiryDate", "marketValue", "currency", "pledgedAsCollateral", "collateralLoanId", "insurancePolicyId", "status") VALUES
  ('warehous_receiptid_1', 'tenant-ph-south', 'warehous_depositorid_1', 'warehouseReceipts_depositorname_1', 'warehous_warehouseid_1', 'warehouseReceipts_warehousename_1', 'Ogun', 'warehouseReceipts_commodity_1', 82.1829, 'warehouseReceipts_quantityunit_1', 'warehouseReceipts_qualitygrade_1', 'warehouseReceipts_storagestartdate_1', 'warehouseReceipts_expirydate_1', 98271084.51, 'GBP', 3, 'warehous_collateralloanid_1', 'warehous_insurancepolicyid_1', 'completed'),
  ('warehous_receiptid_2', 'tenant-kano-north', 'warehous_depositorid_2', 'warehouseReceipts_depositorname_2', 'warehous_warehouseid_2', 'warehouseReceipts_warehousename_2', 'Kaduna', 'warehouseReceipts_commodity_2', 28.1434, 'warehouseReceipts_quantityunit_2', 'warehouseReceipts_qualitygrade_2', 'warehouseReceipts_storagestartdate_2', 'warehouseReceipts_expirydate_2', 29703336.81, 'EUR', 46, 'warehous_collateralloanid_2', 'warehous_insurancepolicyid_2', 'completed'),
  ('warehous_receiptid_3', 'tenant-ph-south', 'warehous_depositorid_3', 'warehouseReceipts_depositorname_3', 'warehous_warehouseid_3', 'warehouseReceipts_warehousename_3', 'Rivers', 'warehouseReceipts_commodity_3', 63.9261, 'warehouseReceipts_quantityunit_3', 'warehouseReceipts_qualitygrade_3', 'warehouseReceipts_storagestartdate_3', 'warehouseReceipts_expirydate_3', 230194636.16, 'GBP', 80, 'warehous_collateralloanid_3', 'warehous_insurancepolicyid_3', 'approved');

-- Table: bankGuarantees (18 columns, inserting 15)
INSERT INTO "bankGuarantees" ("guaranteeId", "tenantId", "guaranteeType", "applicantId", "applicantName", "beneficiaryName", "amount", "currency", "purpose", "effectiveDate", "expiryDate", "claimDeadline", "commissionRate", "commissionAmount", "status") VALUES
  ('bankGuar_guaranteeid_1', 'tenant-ph-south', 'basic', 'bankGuar_applicantid_1', 'bankGuarantees_applicantname_1', 'bankGuarantees_beneficiaryname_1', 4483339.95, 'NGN', '54Bank bankGuarantees record 1', 'bankGuarantees_effectivedate_1', 'bankGuarantees_expirydate_1', 'bankGuarantees_claimdeadline_1', 2.962, 297672428.56, 'rejected'),
  ('bankGuar_guaranteeid_2', 'tenant-abuja-hq', 'standard', 'bankGuar_applicantid_2', 'bankGuarantees_applicantname_2', 'bankGuarantees_beneficiaryname_2', 295944083.77, 'GBP', '54Bank bankGuarantees record 2', 'bankGuarantees_effectivedate_2', 'bankGuarantees_expirydate_2', 'bankGuarantees_claimdeadline_2', 19.2019, 201064690.97, 'inactive'),
  ('bankGuar_guaranteeid_3', 'tenant-abuja-hq', 'standard', 'bankGuar_applicantid_3', 'bankGuarantees_applicantname_3', 'bankGuarantees_beneficiaryname_3', 487672829.18, 'NGN', '54Bank bankGuarantees record 3', 'bankGuarantees_effectivedate_3', 'bankGuarantees_expirydate_3', 'bankGuarantees_claimdeadline_3', 2.4706, 353093123.58, 'completed');

-- Table: mortgageApplications (21 columns, inserting 18)
INSERT INTO "mortgageApplications" ("mortgageId", "tenantId", "applicantId", "applicantName", "propertyValue", "loanAmount", "downPayment", "interestRatePct", "tenorMonths", "mortgageType", "emi", "ltvPct", "ltvGrade", "dtiRatio", "propertyAddress", "propertyType", "status", "disbursedAt") VALUES
  ('mortgage_mortgageid_1', 'tenant-ph-south', 'mortgage_applicantid_1', 'mortgageApplications_applicantname_1', 167922163.45, 236031041.23, 22.6003, 19.1136, 60, 'premium', 63.2329, 22.5433, 'mortgageApplications_ltvgrade_1', 0.2398, '93 Broad Street, Oyo', 'basic', 'pending', '2026-03-31 00:00:00'::timestamp),
  ('mortgage_mortgageid_2', 'tenant-kano-north', 'mortgage_applicantid_2', 'mortgageApplications_applicantname_2', 295690977.42, 180874879.21, 13.81, 2.4518, 63, 'standard', 91.9288, 2.4474, 'mortgageApplications_ltvgrade_2', 62.3487, '179 Marina Street, Kano', 'premium', 'completed', '2026-02-22 00:00:00'::timestamp),
  ('mortgage_mortgageid_3', 'tenant-ph-south', 'mortgage_applicantid_3', 'mortgageApplications_applicantname_3', 387395489.19, 94637728.79, 40.2488, 19.7801, 47, 'basic', 93.7959, 80.7404, 'mortgageApplications_ltvgrade_3', 40.991, '41 Broad Street, Kaduna', 'premium', 'pending', '2026-04-19 00:00:00'::timestamp);

-- Table: educationLoans (20 columns, inserting 15)
INSERT INTO "educationLoans" ("loanId", "tenantId", "studentId", "studentName", "institutionName", "programName", "loanAmount", "interestRate", "tenorMonths", "graceMonths", "emi", "outstandingBalance", "cosignerName", "cosignerType", "status") VALUES
  ('educatio_loanid_1', 'tenant-lagos-main', 'educatio_studentid_1', 'educationLoans_studentname_1', 'educationLoans_institutionname_1', 'educationLoans_programname_1', 465021175.04, 9.9156, 82, 4, 5.5561, 79432129.77, 'educationLoans_cosignername_1', 'premium', 'completed'),
  ('educatio_loanid_2', 'tenant-ph-south', 'educatio_studentid_2', 'educationLoans_studentname_2', 'educationLoans_institutionname_2', 'educationLoans_programname_2', 359984499.78, 7.0187, 5, 2, 90.8691, 342495637.69, 'educationLoans_cosignername_2', 'premium', 'inactive'),
  ('educatio_loanid_3', 'tenant-kano-north', 'educatio_studentid_3', 'educationLoans_studentname_3', 'educationLoans_institutionname_3', 'educationLoans_programname_3', 105006019.32, 1.0077, 93, 89, 19.9451, 27854024.5, 'educationLoans_cosignername_3', 'standard', 'pending');

-- Table: esusuGroups (16 columns, inserting 11)
INSERT INTO "esusuGroups" ("groupId", "tenantId", "name", "organiserId", "organiserName", "contributionAmount", "currency", "frequency", "maxMembers", "status", "startDate") VALUES
  ('esusuGro_groupid_1', 'tenant-lagos-main', 'Ibrahim Musa', 'esusuGro_organiserid_1', 'esusuGroups_organisername_1', 395719613.16, 'EUR', 'esusuGroups_frequency_1', 92, 'active', '2025-09-27 00:00:00'::timestamp),
  ('esusuGro_groupid_2', 'tenant-lagos-main', 'Dangote Industries Ltd', 'esusuGro_organiserid_2', 'esusuGroups_organisername_2', 102818158.58, 'NGN', 'esusuGroups_frequency_2', 58, 'rejected', '2025-06-05 00:00:00'::timestamp),
  ('esusuGro_groupid_3', 'tenant-lagos-main', 'Kemi Adeyemi', 'esusuGro_organiserid_3', 'esusuGroups_organisername_3', 363268496.48, 'USD', 'esusuGroups_frequency_3', 28, 'inactive', '2026-03-18 00:00:00'::timestamp);

-- Table: virtualAccounts (19 columns, inserting 13)
INSERT INTO "virtualAccounts" ("accountId", "tenantId", "van", "parentAccountId", "ownerId", "ownerName", "ownerType", "purpose", "currency", "dailyLimit", "monthlyLimit", "status", "expiryDate") VALUES
  ('virtualA_accountid_1', 'tenant-abuja-hq', 'virtualAccounts_van_1', 'virtualA_parentaccountid_1', 'virtualA_ownerid_1', 'virtualAccounts_ownername_1', 'basic', '54Bank virtualAccounts record 1', 'GBP', 95.508, 87.0397, 'inactive', '2026-03-09 00:00:00'::timestamp),
  ('virtualA_accountid_2', 'tenant-abuja-hq', 'virtualAccounts_van_2', 'virtualA_parentaccountid_2', 'virtualA_ownerid_2', 'virtualAccounts_ownername_2', 'basic', '54Bank virtualAccounts record 2', 'NGN', 78.4933, 92.5844, 'completed', '2025-11-06 00:00:00'::timestamp),
  ('virtualA_accountid_3', 'tenant-abuja-hq', 'virtualAccounts_van_3', 'virtualA_parentaccountid_3', 'virtualA_ownerid_3', 'virtualAccounts_ownername_3', 'standard', '54Bank virtualAccounts record 3', 'NGN', 52.5801, 19.826, 'active', '2026-01-03 00:00:00'::timestamp);

-- Table: agentBankingAgents (20 columns, inserting 13)
INSERT INTO "agentBankingAgents" ("agentId", "tenantId", "agentCode", "businessName", "ownerName", "phoneNumber", "email", "bvn", "lga", "state", "agentType", "superAgentId", "status") VALUES
  ('agentBan_agentid_1', 'tenant-ph-south', 'agentBan_agentcode_1', 'agentBankingAgents_businessname_1', 'agentBankingAgents_ownername_1', '+2347723699071', 'ngozi.okafor@54bank.ng', '22457570792', 'agentBankingAgents_lga_1', 'Enugu', 'premium', 'agentBan_superagentid_1', 'completed'),
  ('agentBan_agentid_2', 'tenant-kano-north', 'agentBan_agentcode_2', 'agentBankingAgents_businessname_2', 'agentBankingAgents_ownername_2', '+2347660933194', 'ngozi.okafor@54bank.ng', '22104367042', 'agentBankingAgents_lga_2', 'Oyo', 'standard', 'agentBan_superagentid_2', 'inactive'),
  ('agentBan_agentid_3', 'tenant-abuja-hq', 'agentBan_agentcode_3', 'agentBankingAgents_businessname_3', 'agentBankingAgents_ownername_3', '+2347468151127', 'kemi.adeyemi@54bank.ng', '22357391544', 'agentBankingAgents_lga_3', 'Ogun', 'standard', 'agentBan_superagentid_3', 'approved');

-- Table: lendingGroups (12 columns, inserting 9)
INSERT INTO "lendingGroups" ("groupId", "tenantId", "name", "purpose", "groupLeaderId", "groupLeaderName", "maxMembers", "liabilityType", "status") VALUES
  ('lendingG_groupid_1', 'tenant-abuja-hq', 'Kemi Adeyemi', '54Bank lendingGroups record 1', 'lendingG_groupleaderid_1', 'lendingGroups_groupleadername_1', 66, 'standard', 'active'),
  ('lendingG_groupid_2', 'tenant-abuja-hq', 'Dangote Industries Ltd', '54Bank lendingGroups record 2', 'lendingG_groupleaderid_2', 'lendingGroups_groupleadername_2', 19, 'basic', 'pending'),
  ('lendingG_groupid_3', 'tenant-abuja-hq', 'Samuel Eze', '54Bank lendingGroups record 3', 'lendingG_groupleaderid_3', 'lendingGroups_groupleadername_3', 9, 'premium', 'inactive');

-- Table: identityProfiles (17 columns, inserting 12)
INSERT INTO "identityProfiles" ("profileId", "tenantId", "customerId", "customerName", "email", "phoneNumber", "bvn", "nin", "mfaMethods", "activeChannels", "status", "lastLoginAt") VALUES
  ('identity_profileid_1', 'tenant-ph-south', 'identity_customerid_1', 'identityProfiles_customername_1', 'samuel.eze@54bank.ng', '+2348511273025', '22931972518', 'identityProfiles_nin_1', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'approved', '2025-07-31 00:00:00'::timestamp),
  ('identity_profileid_2', 'tenant-abuja-hq', 'identity_customerid_2', 'identityProfiles_customername_2', 'ibrahim.musa@54bank.ng', '+2347684279916', '22989705595', 'identityProfiles_nin_2', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'rejected', '2025-06-26 00:00:00'::timestamp),
  ('identity_profileid_3', 'tenant-kano-north', 'identity_customerid_3', 'identityProfiles_customername_3', 'tunde.bakare@54bank.ng', '+2348198469027', '22354386265', 'identityProfiles_nin_3', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'completed', '2025-11-15 00:00:00'::timestamp);

-- Table: disputeCases (19 columns, inserting 15)
INSERT INTO "disputeCases" ("disputeId", "tenantId", "customerId", "customerName", "category", "description", "transactionId", "transactionAmount", "disputedAmount", "channel", "status", "slaDeadline", "assignedTo", "resolution", "resolutionAmount") VALUES
  ('disputeC_disputeid_1', 'tenant-lagos-main', 'disputeC_customerid_1', 'disputeCases_customername_1', 'premium', '54Bank disputeCases record 1', 'disputeC_transactionid_1', 202919552.13, 161043256.47, 'disputeCases_channel_1', 'rejected', '2026-04-16 00:00:00'::timestamp, 'disputeCases_assignedto_1', 'disputeCases_resolution_1', 286431564.99),
  ('disputeC_disputeid_2', 'tenant-kano-north', 'disputeC_customerid_2', 'disputeCases_customername_2', 'standard', '54Bank disputeCases record 2', 'disputeC_transactionid_2', 32912252.37, 483004651.33, 'disputeCases_channel_2', 'approved', '2026-01-21 00:00:00'::timestamp, 'disputeCases_assignedto_2', 'disputeCases_resolution_2', 174810610.44),
  ('disputeC_disputeid_3', 'tenant-ph-south', 'disputeC_customerid_3', 'disputeCases_customername_3', 'standard', '54Bank disputeCases record 3', 'disputeC_transactionid_3', 463459229.28, 194408568.22, 'disputeCases_channel_3', 'rejected', '2025-10-19 00:00:00'::timestamp, 'disputeCases_assignedto_3', 'disputeCases_resolution_3', 87105681.84);

-- Table: reconciliationRuns (15 columns, inserting 8)
INSERT INTO "reconciliationRuns" ("runId", "tenantId", "runType", "scope", "status", "durationMs", "startTime", "endTime") VALUES
  ('reconcil_runid_1', 'tenant-kano-north', 'standard', 'reconciliationRuns_scope_1', 'active', 78, '2026-04-21 00:00:00'::timestamp, '2025-12-15 00:00:00'::timestamp),
  ('reconcil_runid_2', 'tenant-ph-south', 'basic', 'reconciliationRuns_scope_2', 'pending', 26, '2025-07-06 00:00:00'::timestamp, '2025-10-28 00:00:00'::timestamp),
  ('reconcil_runid_3', 'tenant-ph-south', 'premium', 'reconciliationRuns_scope_3', 'rejected', 95, '2025-10-08 00:00:00'::timestamp, '2026-02-28 00:00:00'::timestamp);

-- Table: erpnextSyncJobs (15 columns, inserting 8)
INSERT INTO "erpnextSyncJobs" ("jobId", "tenantId", "syncType", "direction", "status", "startedAt", "completedAt", "errorMessage") VALUES
  ('erpnextS_jobid_1', 'tenant-abuja-hq', 'standard', 'erpnextSyncJobs_direction_1', 'active', '2026-02-09 00:00:00'::timestamp, '2026-04-11 00:00:00'::timestamp, 'erpnextSyncJobs_errormessage_1'),
  ('erpnextS_jobid_2', 'tenant-ph-south', 'basic', 'erpnextSyncJobs_direction_2', 'inactive', '2026-03-19 00:00:00'::timestamp, '2025-06-12 00:00:00'::timestamp, 'erpnextSyncJobs_errormessage_2'),
  ('erpnextS_jobid_3', 'tenant-lagos-main', 'basic', 'erpnextSyncJobs_direction_3', 'completed', '2025-12-12 00:00:00'::timestamp, '2025-07-08 00:00:00'::timestamp, 'erpnextSyncJobs_errormessage_3');

-- Table: regulatoryReports (12 columns, inserting 9)
INSERT INTO "regulatoryReports" ("reportId", "tenantId", "reportType", "period", "status", "submittedTo", "submittedAt", "data", "summary") VALUES
  ('regulato_reportid_1', 'tenant-kano-north', 'premium', 'regulatoryReports_period_1', 'completed', 'regulatoryReports_submittedto_1', '2026-02-07 00:00:00'::timestamp, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb),
  ('regulato_reportid_2', 'tenant-abuja-hq', 'standard', 'regulatoryReports_period_2', 'inactive', 'regulatoryReports_submittedto_2', '2025-05-23 00:00:00'::timestamp, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb),
  ('regulato_reportid_3', 'tenant-lagos-main', 'basic', 'regulatoryReports_period_3', 'approved', 'regulatoryReports_submittedto_3', '2025-09-19 00:00:00'::timestamp, '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb);

-- Table: accounts (18 columns, inserting 14)
INSERT INTO "accounts" ("accountId", "customerId", "tenantId", "accountName", "accountType", "currency", "balance", "availableBalance", "ledgerBalance", "status", "branchCode", "lastTransactionAt", "version", "tigerbeetleAccountId") VALUES
  ('accounts_accountid_1', 'accounts_customerid_1', 'tenant-ph-south', 'accounts_accountname_1', 'basic', 'GBP', 23334291.14, 249228860.87, 50468438.68, 'completed', 'ABJ-001', '2025-08-21 00:00:00'::timestamp, 8, 'accounts_tigerbeetleaccountid_1'),
  ('accounts_accountid_2', 'accounts_customerid_2', 'tenant-abuja-hq', 'accounts_accountname_2', 'basic', 'NGN', 123770600.69, 138575371.53, 162836642.48, 'pending', 'LOS-001', '2026-05-11 00:00:00'::timestamp, 31, 'accounts_tigerbeetleaccountid_2'),
  ('accounts_accountid_3', 'accounts_customerid_3', 'tenant-ph-south', 'accounts_accountname_3', 'premium', 'USD', 297769814.42, 168649681.6, 146367586.22, 'rejected', 'ABJ-001', '2026-04-18 00:00:00'::timestamp, 38, 'accounts_tigerbeetleaccountid_3');

-- Table: transactions (16 columns, inserting 13)
INSERT INTO "transactions" ("transactionId", "accountId", "tenantId", "type", "amount", "currency", "narration", "reference", "channel", "counterpartyAccountId", "counterpartyName", "balanceAfter", "status") VALUES
  ('transact_transactionid_1', 'transact_accountid_1', 'tenant-kano-north', 'standard', 269749944.61, 'GBP', 'transactions_narration_1', '54B-TRAN-861222', 'transactions_channel_1', 'transact_counterpartyaccountid_1', 'transactions_counterpartyname_1', 436838487.84, 'completed'),
  ('transact_transactionid_2', 'transact_accountid_2', 'tenant-ph-south', 'premium', 44238942.03, 'USD', 'transactions_narration_2', '54B-TRAN-603814', 'transactions_channel_2', 'transact_counterpartyaccountid_2', 'transactions_counterpartyname_2', 255957066.18, 'active'),
  ('transact_transactionid_3', 'transact_accountid_3', 'tenant-kano-north', 'basic', 113115411.83, 'GBP', 'transactions_narration_3', '54B-TRAN-409607', 'transactions_channel_3', 'transact_counterpartyaccountid_3', 'transactions_counterpartyname_3', 129953738.07, 'pending');

-- Table: journalEntries (15 columns, inserting 11)
INSERT INTO "journalEntries" ("entryId", "tenantId", "accountId", "glAccountCode", "type", "amount", "currency", "narration", "transactionRef", "batchId", "reversalOf") VALUES
  ('journalE_entryid_1', 'tenant-ph-south', 'journalE_accountid_1', 'journalE_glaccountcode_1', 'basic', 199475033.33, 'GBP', 'journalEntries_narration_1', '54B-JOUR-143153', 'journalE_batchid_1', 'journalEntries_reversalof_1'),
  ('journalE_entryid_2', 'tenant-kano-north', 'journalE_accountid_2', 'journalE_glaccountcode_2', 'premium', 379037096.91, 'USD', 'journalEntries_narration_2', '54B-JOUR-398462', 'journalE_batchid_2', 'journalEntries_reversalof_2'),
  ('journalE_entryid_3', 'tenant-abuja-hq', 'journalE_accountid_3', 'journalE_glaccountcode_3', 'premium', 190418925.12, 'NGN', 'journalEntries_narration_3', '54B-JOUR-143878', 'journalE_batchid_3', 'journalEntries_reversalof_3');

-- Table: glAccounts (13 columns, inserting 10)
INSERT INTO "glAccounts" ("glAccountCode", "tenantId", "name", "category", "subcategory", "parentCode", "currency", "balance", "status", "isControlAccount") VALUES
  ('glAccoun_glaccountcode_1', 'tenant-abuja-hq', 'Ibrahim Musa', 'standard', 'premium', 'glAccoun_parentcode_1', 'NGN', 476261505.21, 'approved', 33),
  ('glAccoun_glaccountcode_2', 'tenant-kano-north', 'Kano Textiles Ltd', 'premium', 'premium', 'glAccoun_parentcode_2', 'USD', 317718156.75, 'pending', 224),
  ('glAccoun_glaccountcode_3', 'tenant-lagos-main', 'Uchenna Ikenna', 'basic', 'premium', 'glAccoun_parentcode_3', 'GBP', 240181740.17, 'inactive', 218);

-- Table: loans (21 columns, inserting 17)
INSERT INTO "loans" ("loanId", "customerId", "tenantId", "loanType", "principalAmount", "outstandingBalance", "interestRate", "currency", "tenor", "tenorUnit", "disbursementDate", "maturityDate", "nextPaymentDate", "nextPaymentAmount", "status", "collateralValue", "approvedBy") VALUES
  ('loans_loanid_1', 'loans_customerid_1', 'tenant-lagos-main', 'premium', 20329877.35, 120899345.77, 15.6545, 'NGN', 74, 'loans_tenorunit_1', '2026-04-29 00:00:00'::timestamp, '2026-02-02 00:00:00'::timestamp, '2025-07-14 00:00:00'::timestamp, 263524070.83, 'rejected', 221492241.06, 'loans_approvedby_1'),
  ('loans_loanid_2', 'loans_customerid_2', 'tenant-ph-south', 'premium', 462292084.18, 2632313.39, 14.0688, 'EUR', 78, 'loans_tenorunit_2', '2025-07-01 00:00:00'::timestamp, '2025-05-24 00:00:00'::timestamp, '2025-11-06 00:00:00'::timestamp, 184661148.64, 'active', 409449685.36, 'loans_approvedby_2'),
  ('loans_loanid_3', 'loans_customerid_3', 'tenant-lagos-main', 'basic', 312409017.32, 290516515.81, 16.3313, 'USD', 87, 'loans_tenorunit_3', '2025-08-18 00:00:00'::timestamp, '2025-05-29 00:00:00'::timestamp, '2025-09-24 00:00:00'::timestamp, 192655879.46, 'pending', 351862314.45, 'loans_approvedby_3');

-- Table: loanRepayments (13 columns, inserting 11)
INSERT INTO "loanRepayments" ("repaymentId", "loanId", "tenantId", "principalPortion", "interestPortion", "penaltyPortion", "totalAmount", "dueDate", "paidDate", "status", "transactionRef") VALUES
  ('loanRepa_repaymentid_1', 'loanRepa_loanid_1', 'tenant-ph-south', 98.6182, 5.4455, 2.4263, 108790651.56, '2025-08-08 00:00:00'::timestamp, '2025-11-03 00:00:00'::timestamp, 'completed', '54B-LOAN-200051'),
  ('loanRepa_repaymentid_2', 'loanRepa_loanid_2', 'tenant-kano-north', 45.8345, 42.1602, 15.1073, 156628521.02, '2025-08-30 00:00:00'::timestamp, '2025-05-16 00:00:00'::timestamp, 'active', '54B-LOAN-318321'),
  ('loanRepa_repaymentid_3', 'loanRepa_loanid_3', 'tenant-abuja-hq', 59.3834, 35.6762, 34.9854, 290483363.97, '2025-11-26 00:00:00'::timestamp, '2025-05-20 00:00:00'::timestamp, 'approved', '54B-LOAN-953801');

-- Table: transfers (20 columns, inserting 17)
INSERT INTO "transfers" ("transferId", "tenantId", "sourceAccountId", "destinationAccountId", "destinationBank", "destinationAccountNumber", "beneficiaryName", "amount", "currency", "channel", "narration", "nipSessionId", "mojaloopTransferId", "status", "failureReason", "idempotencyKey", "completedAt") VALUES
  ('transfer_transferid_1', 'tenant-abuja-hq', 'transfer_sourceaccountid_1', 'transfer_destinationaccountid_1', 'transfers_destinationbank_1', '5482183750', 'transfers_beneficiaryname_1', 187349222.44, 'EUR', 'transfers_channel_1', 'transfers_narration_1', 'transfer_nipsessionid_1', 'transfer_mojalooptransferid_1', 'approved', '54Bank transfers record 1', 'transfer_idempotencykey_1', '2025-06-10 00:00:00'::timestamp),
  ('transfer_transferid_2', 'tenant-ph-south', 'transfer_sourceaccountid_2', 'transfer_destinationaccountid_2', 'transfers_destinationbank_2', '5433688014', 'transfers_beneficiaryname_2', 332913000.22, 'EUR', 'transfers_channel_2', 'transfers_narration_2', 'transfer_nipsessionid_2', 'transfer_mojalooptransferid_2', 'pending', '54Bank transfers record 2', 'transfer_idempotencykey_2', '2025-05-26 00:00:00'::timestamp),
  ('transfer_transferid_3', 'tenant-kano-north', 'transfer_sourceaccountid_3', 'transfer_destinationaccountid_3', 'transfers_destinationbank_3', '5479726344', 'transfers_beneficiaryname_3', 271619163.89, 'USD', 'transfers_channel_3', 'transfers_narration_3', 'transfer_nipsessionid_3', 'transfer_mojalooptransferid_3', 'rejected', '54Bank transfers record 3', 'transfer_idempotencykey_3', '2026-05-03 00:00:00'::timestamp);

-- Table: settlements (17 columns, inserting 14)
INSERT INTO "settlements" ("settlementId", "tenantId", "windowId", "model", "corridor", "totalDebits", "totalCredits", "netPosition", "currency", "participantCount", "transferCount", "status", "closedAt", "settledAt") VALUES
  ('settleme_settlementid_1', 'tenant-ph-south', 'settleme_windowid_1', 'settlements_model_1', 'settleme_corridor_1', 19.3446, 10.8579, 10.9834, 'NGN', 248, 9, 'approved', '2025-12-17 00:00:00'::timestamp, '2025-07-25 00:00:00'::timestamp),
  ('settleme_settlementid_2', 'tenant-kano-north', 'settleme_windowid_2', 'settlements_model_2', 'settleme_corridor_2', 46.0308, 92.4104, 95.9422, 'GBP', 237, 242, 'inactive', '2025-07-16 00:00:00'::timestamp, '2026-02-05 00:00:00'::timestamp),
  ('settleme_settlementid_3', 'tenant-kano-north', 'settleme_windowid_3', 'settlements_model_3', 'settleme_corridor_3', 42.826, 85.1896, 18.0554, 'GBP', 340, 149, 'completed', '2026-03-07 00:00:00'::timestamp, '2025-11-30 00:00:00'::timestamp);

-- Table: amlAlerts (16 columns, inserting 13)
INSERT INTO "amlAlerts" ("alertId", "tenantId", "customerId", "entityType", "entityId", "ruleId", "ruleName", "riskScore", "severity", "status", "assignedTo", "notes", "resolvedAt") VALUES
  ('amlAlert_alertid_1', 'tenant-ph-south', 'amlAlert_customerid_1', 'basic', 'amlAlert_entityid_1', 'amlAlert_ruleid_1', 'amlAlerts_rulename_1', 21.8153, 'amlAlerts_severity_1', 'pending', 'amlAlerts_assignedto_1', '54Bank amlAlerts record 1', '2025-08-23 00:00:00'::timestamp),
  ('amlAlert_alertid_2', 'tenant-kano-north', 'amlAlert_customerid_2', 'basic', 'amlAlert_entityid_2', 'amlAlert_ruleid_2', 'amlAlerts_rulename_2', 2.7946, 'amlAlerts_severity_2', 'completed', 'amlAlerts_assignedto_2', '54Bank amlAlerts record 2', '2025-08-15 00:00:00'::timestamp),
  ('amlAlert_alertid_3', 'tenant-ph-south', 'amlAlert_customerid_3', 'standard', 'amlAlert_entityid_3', 'amlAlert_ruleid_3', 'amlAlerts_rulename_3', 8.2264, 'amlAlerts_severity_3', 'approved', 'amlAlerts_assignedto_3', '54Bank amlAlerts record 3', '2025-07-24 00:00:00'::timestamp);

-- Table: kycVerifications (13 columns, inserting 11)
INSERT INTO "kycVerifications" ("verificationId", "customerId", "tenantId", "verificationType", "documentReference", "provider", "providerResponse", "matchScore", "status", "verifiedAt", "expiresAt") VALUES
  ('kycVerif_verificationid_1', 'kycVerif_customerid_1', 'tenant-lagos-main', 'basic', '54B-KYCV-416156', 'kycVerif_provider_1', '{"key": "value"}'::jsonb, 16.1103, 'completed', '2025-12-19 00:00:00'::timestamp, '2025-07-28 00:00:00'::timestamp),
  ('kycVerif_verificationid_2', 'kycVerif_customerid_2', 'tenant-lagos-main', 'standard', '54B-KYCV-465194', 'kycVerif_provider_2', '{"key": "value"}'::jsonb, 23.9802, 'active', '2025-08-16 00:00:00'::timestamp, '2025-11-14 00:00:00'::timestamp),
  ('kycVerif_verificationid_3', 'kycVerif_customerid_3', 'tenant-lagos-main', 'standard', '54B-KYCV-443187', 'kycVerif_provider_3', '{"key": "value"}'::jsonb, 19.0038, 'approved', '2026-01-24 00:00:00'::timestamp, '2026-03-11 00:00:00'::timestamp);

-- Table: fxTrades (15 columns, inserting 13)
INSERT INTO "fxTrades" ("tradeId", "tenantId", "buyCurrency", "sellCurrency", "buyAmount", "sellAmount", "exchangeRate", "tradeType", "counterparty", "valueDate", "status", "traderId", "approvedBy") VALUES
  ('fxTrades_tradeid_1', 'tenant-kano-north', 'USD', 'GBP', 384735293.17, 427334825.49, 3.2127, 'basic', 'fxTrades_counterparty_1', '2026-03-30 00:00:00'::timestamp, 'completed', 'fxTrades_traderid_1', 'fxTrades_approvedby_1'),
  ('fxTrades_tradeid_2', 'tenant-abuja-hq', 'USD', 'EUR', 147482847.68, 274391796.35, 22.7199, 'standard', 'fxTrades_counterparty_2', '2026-04-26 00:00:00'::timestamp, 'completed', 'fxTrades_traderid_2', 'fxTrades_approvedby_2'),
  ('fxTrades_tradeid_3', 'tenant-lagos-main', 'EUR', 'USD', 78862970.3, 18196300.26, 14.1834, 'standard', 'fxTrades_counterparty_3', '2025-11-10 00:00:00'::timestamp, 'approved', 'fxTrades_traderid_3', 'fxTrades_approvedby_3');

-- Table: nostroAccounts (12 columns, inserting 9)
INSERT INTO "nostroAccounts" ("nostroId", "tenantId", "correspondentBank", "currency", "accountNumber", "swiftCode", "balance", "lastReconciledAt", "status") VALUES
  ('nostroAc_nostroid_1', 'tenant-abuja-hq', 'nostroAccounts_correspondentbank_1', 'EUR', '5476063158', 'nostroAc_swiftcode_1', 327003105.62, '2025-08-18 00:00:00'::timestamp, 'completed'),
  ('nostroAc_nostroid_2', 'tenant-abuja-hq', 'nostroAccounts_correspondentbank_2', 'NGN', '5477897892', 'nostroAc_swiftcode_2', 437878890.37, '2026-04-08 00:00:00'::timestamp, 'pending'),
  ('nostroAc_nostroid_3', 'tenant-abuja-hq', 'nostroAccounts_correspondentbank_3', 'NGN', '5475661681', 'nostroAc_swiftcode_3', 417525395.39, '2025-07-11 00:00:00'::timestamp, 'completed');

-- Table: auditTrail (12 columns, inserting 10)
INSERT INTO "auditTrail" ("auditId", "tenantId", "entityType", "entityId", "action", "actorId", "actorRole", "changes", "ipAddress", "userAgent") VALUES
  ('auditTra_auditid_1', 'tenant-lagos-main', 'premium', 'auditTra_entityid_1', 'auditTrail_action_1', 'auditTra_actorid_1', 'admin', '{"key": "value"}'::jsonb, '190 Marina Street, Rivers', 'auditTrail_useragent_1'),
  ('auditTra_auditid_2', 'tenant-ph-south', 'standard', 'auditTra_entityid_2', 'auditTrail_action_2', 'auditTra_actorid_2', 'branch_manager', '{"key": "value"}'::jsonb, '82 Allen Street, Enugu', 'auditTrail_useragent_2'),
  ('auditTra_auditid_3', 'tenant-ph-south', 'premium', 'auditTra_entityid_3', 'auditTrail_action_3', 'auditTra_actorid_3', 'teller', '{"key": "value"}'::jsonb, '151 Marina Street, Imo', 'auditTrail_useragent_3');

-- Table: swiftMessages (14 columns, inserting 12)
INSERT INTO "swiftMessages" ("messageId", "tenantId", "messageType", "direction", "senderBic", "receiverBic", "amount", "currency", "valueDate", "rawMessage", "status", "relatedTransferId") VALUES
  ('swiftMes_messageid_1', 'tenant-ph-south', 'basic', 'swiftMessages_direction_1', 'swiftMessages_senderbic_1', 'swiftMessages_receiverbic_1', 448028515.23, 'NGN', '2026-01-21 00:00:00'::timestamp, 'swiftMessages_rawmessage_1', 'completed', 'swiftMes_relatedtransferid_1'),
  ('swiftMes_messageid_2', 'tenant-ph-south', 'basic', 'swiftMessages_direction_2', 'swiftMessages_senderbic_2', 'swiftMessages_receiverbic_2', 241615612.44, 'USD', '2025-10-03 00:00:00'::timestamp, 'swiftMessages_rawmessage_2', 'rejected', 'swiftMes_relatedtransferid_2'),
  ('swiftMes_messageid_3', 'tenant-kano-north', 'basic', 'swiftMessages_direction_3', 'swiftMessages_senderbic_3', 'swiftMessages_receiverbic_3', 408569968.22, 'USD', '2025-09-28 00:00:00'::timestamp, 'swiftMessages_rawmessage_3', 'inactive', 'swiftMes_relatedtransferid_3');

-- Table: nipTransactions (15 columns, inserting 13)
INSERT INTO "nipTransactions" ("nipId", "tenantId", "sessionId", "direction", "sourceBank", "destinationBank", "sourceAccount", "destinationAccount", "amount", "narration", "responseCode", "status", "completedAt") VALUES
  ('nipTrans_nipid_1', 'tenant-abuja-hq', 'nipTrans_sessionid_1', 'nipTransactions_direction_1', 'nipTransactions_sourcebank_1', 'nipTransactions_destinationbank_1', 'nipTransactions_sourceaccount_1', 'nipTransactions_destinationaccount_1', 109027547.89, 'nipTransactions_narration_1', 'nipTrans_responsecode_1', 'active', '2025-09-10 00:00:00'::timestamp),
  ('nipTrans_nipid_2', 'tenant-lagos-main', 'nipTrans_sessionid_2', 'nipTransactions_direction_2', 'nipTransactions_sourcebank_2', 'nipTransactions_destinationbank_2', 'nipTransactions_sourceaccount_2', 'nipTransactions_destinationaccount_2', 433641412.25, 'nipTransactions_narration_2', 'nipTrans_responsecode_2', 'inactive', '2026-05-12 00:00:00'::timestamp),
  ('nipTrans_nipid_3', 'tenant-kano-north', 'nipTrans_sessionid_3', 'nipTransactions_direction_3', 'nipTransactions_sourcebank_3', 'nipTransactions_destinationbank_3', 'nipTransactions_sourceaccount_3', 'nipTransactions_destinationaccount_3', 354637268.02, 'nipTransactions_narration_3', 'nipTrans_responsecode_3', 'rejected', '2026-05-10 00:00:00'::timestamp);

-- Table: cardTransactions (17 columns, inserting 15)
INSERT INTO "cardTransactions" ("cardTxnId", "tenantId", "cardId", "accountId", "merchantName", "merchantCategory", "amount", "currency", "type", "channel", "authorizationCode", "stan", "rrn", "status", "declineReason") VALUES
  ('cardTran_cardtxnid_1', 'tenant-kano-north', 'cardTran_cardid_1', 'cardTran_accountid_1', 'cardTransactions_merchantname_1', 'basic', 82926955.07, 'USD', 'standard', 'cardTransactions_channel_1', 'cardTran_authorizationcode_1', 'cardTransactions_stan_1', 'cardTransactions_rrn_1', 'pending', '54Bank cardTransactions record 1'),
  ('cardTran_cardtxnid_2', 'tenant-lagos-main', 'cardTran_cardid_2', 'cardTran_accountid_2', 'cardTransactions_merchantname_2', 'premium', 296041965.47, 'NGN', 'basic', 'cardTransactions_channel_2', 'cardTran_authorizationcode_2', 'cardTransactions_stan_2', 'cardTransactions_rrn_2', 'active', '54Bank cardTransactions record 2'),
  ('cardTran_cardtxnid_3', 'tenant-lagos-main', 'cardTran_cardid_3', 'cardTran_accountid_3', 'cardTransactions_merchantname_3', 'premium', 325102494.11, 'GBP', 'premium', 'cardTransactions_channel_3', 'cardTran_authorizationcode_3', 'cardTransactions_stan_3', 'cardTransactions_rrn_3', 'completed', '54Bank cardTransactions record 3');

-- Table: trialBalances (13 columns, inserting 11)
INSERT INTO "trialBalances" ("trialBalanceId", "tenantId", "glAccountCode", "periodStart", "periodEnd", "openingBalance", "totalDebits", "totalCredits", "closingBalance", "currency", "status") VALUES
  ('trialBal_trialbalanceid_1', 'tenant-abuja-hq', 'trialBal_glaccountcode_1', '2026-02-17 00:00:00'::timestamp, '2025-11-27 00:00:00'::timestamp, 180379663.96, 34.7881, 19.8845, 380009872.11, 'EUR', 'active'),
  ('trialBal_trialbalanceid_2', 'tenant-abuja-hq', 'trialBal_glaccountcode_2', '2026-03-10 00:00:00'::timestamp, '2025-10-15 00:00:00'::timestamp, 365957593.07, 74.1514, 61.3254, 498511896.17, 'NGN', 'approved'),
  ('trialBal_trialbalanceid_3', 'tenant-kano-north', 'trialBal_glaccountcode_3', '2026-02-06 00:00:00'::timestamp, '2026-02-07 00:00:00'::timestamp, 22415466.75, 34.5177, 6.2738, 494791667.96, 'NGN', 'completed');

-- Table: kyc_tiers (12 columns, inserting 9)
INSERT INTO "kyc_tiers" ("customer_id", "customer_name", "current_tier", "daily_limit_ngn", "daily_used_ngn", "evaluation_score", "risk_flags", "status", "last_evaluated_at") VALUES
  ('kyc_tier_customer_id_1', 'kyc_tiers_customer_name_1', 45, 77.7213, 68.0829, 0.5272, '{"key": "value"}'::jsonb, 'pending', '2025-12-10 00:00:00'::timestamp),
  ('kyc_tier_customer_id_2', 'kyc_tiers_customer_name_2', 29, 76.3238, 49.7564, 14.1985, '{"key": "value"}'::jsonb, 'pending', '2025-11-13 00:00:00'::timestamp),
  ('kyc_tier_customer_id_3', 'kyc_tiers_customer_name_3', 78, 4.7022, 21.1981, 5.856, '{"key": "value"}'::jsonb, 'pending', '2025-11-29 00:00:00'::timestamp);

-- Table: kyc_tier_history (7 columns, inserting 5)
INSERT INTO "kyc_tier_history" ("customer_id", "previous_tier", "new_tier", "reason", "changed_by") VALUES
  ('kyc_tier_customer_id_1', 87, 47, '54Bank kyc_tier_history record 1', 'kyc_tier_history_changed_by_1'),
  ('kyc_tier_customer_id_2', 23, 81, '54Bank kyc_tier_history record 2', 'kyc_tier_history_changed_by_2'),
  ('kyc_tier_customer_id_3', 92, 41, '54Bank kyc_tier_history record 3', 'kyc_tier_history_changed_by_3');

-- Table: sanctions_screenings (10 columns, inserting 8)
INSERT INTO "sanctions_screenings" ("entity_name", "entity_type", "lists_checked", "match_found", "highest_score", "match_details", "status", "screened_by") VALUES
  ('sanctions_screenings_entity_name_1', 'premium', '{"key": "value"}'::jsonb, 48, 24.7543, '{"key": "value"}'::jsonb, 'inactive', 'sanctions_screenings_screened_by_1'),
  ('sanctions_screenings_entity_name_2', 'basic', '{"key": "value"}'::jsonb, 25, 17.5839, '{"key": "value"}'::jsonb, 'completed', 'sanctions_screenings_screened_by_2'),
  ('sanctions_screenings_entity_name_3', 'standard', '{"key": "value"}'::jsonb, 9, 17.8172, '{"key": "value"}'::jsonb, 'active', 'sanctions_screenings_screened_by_3');

-- Table: transaction_monitoring_rules (11 columns, inserting 8)
INSERT INTO "transaction_monitoring_rules" ("name", "category", "scenario_code", "description", "risk_score_impact", "enabled", "cbn_prescribed", "threshold_config") VALUES
  ('Samuel Eze', 'basic', 'transact_scenario_code_1', '54Bank transaction_monitoring_rules record 1', 90, 70, 28, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('Emeka & Sons Trading', 'basic', 'transact_scenario_code_2', '54Bank transaction_monitoring_rules record 2', 90, 79, 5, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('Ibrahim Musa', 'basic', 'transact_scenario_code_3', '54Bank transaction_monitoring_rules record 3', 72, 59, 32, '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: transaction_alerts (11 columns, inserting 9)
INSERT INTO "transaction_alerts" ("rule_id", "customer_id", "alert_type", "severity", "amount_ngn", "description", "status", "assigned_to", "resolved_at") VALUES
  (63, 'transact_customer_id_1', 'premium', 'transaction_alerts_severity_1', 164530596.85, '54Bank transaction_alerts record 1', 'active', 'transaction_alerts_assigned_to_1', '2025-06-18 00:00:00'::timestamp),
  (19, 'transact_customer_id_2', 'premium', 'transaction_alerts_severity_2', 344288153.28, '54Bank transaction_alerts record 2', 'completed', 'transaction_alerts_assigned_to_2', '2025-11-15 00:00:00'::timestamp),
  (52, 'transact_customer_id_3', 'basic', 'transaction_alerts_severity_3', 376619202.47, '54Bank transaction_alerts record 3', 'pending', 'transaction_alerts_assigned_to_3', '2026-01-03 00:00:00'::timestamp);

-- Table: ubo_graph_nodes (7 columns, inserting 5)
INSERT INTO "ubo_graph_nodes" ("entity_name", "entity_type", "nationality", "risk_level", "metadata") VALUES
  ('ubo_graph_nodes_entity_name_1', 'basic', 'ubo_graph_nodes_nationality_1', 'ubo_graph_nodes_risk_level_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('ubo_graph_nodes_entity_name_2', 'basic', 'ubo_graph_nodes_nationality_2', 'ubo_graph_nodes_risk_level_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('ubo_graph_nodes_entity_name_3', 'premium', 'ubo_graph_nodes_nationality_3', 'ubo_graph_nodes_risk_level_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: ubo_graph_edges (6 columns, inserting 4)
INSERT INTO "ubo_graph_edges" ("source_id", "target_id", "relationship", "ownership_pct") VALUES
  (95, 34, 'ubo_graph_edges_relationship_1', 84.2538),
  (31, 33, 'ubo_graph_edges_relationship_2', 85.9623),
  (23, 21, 'ubo_graph_edges_relationship_3', 28.9162);

-- Table: risk_scores (10 columns, inserting 7)
INSERT INTO "risk_scores" ("customer_id", "static_score", "dynamic_score", "total_score", "risk_tier", "factors", "last_calculated_at") VALUES
  ('risk_sco_customer_id_1', 3.3482, 6.6647, 10.5255, 'tier_2', '{"key": "value"}'::jsonb, '2026-04-26 00:00:00'::timestamp),
  ('risk_sco_customer_id_2', 24.9756, 3.8497, 24.9235, 'tier_3', '{"key": "value"}'::jsonb, '2025-09-27 00:00:00'::timestamp),
  ('risk_sco_customer_id_3', 16.8211, 5.3841, 16.228, 'tier_3', '{"key": "value"}'::jsonb, '2025-05-14 00:00:00'::timestamp);

-- Table: agent_kyc_captures (13 columns, inserting 11)
INSERT INTO "agent_kyc_captures" ("agent_id", "agent_name", "customer_id", "customer_name", "lga", "state", "offline_capture", "quality_score", "gps_lat", "gps_lng", "synced_at") VALUES
  ('agent_ky_agent_id_1', 'agent_kyc_captures_agent_name_1', 'agent_ky_customer_id_1', 'agent_kyc_captures_customer_name_1', 'agent_kyc_captures_lga_1', 'Anambra', 73, 9.3504, 57.7098, 80.6065, '2026-01-01 00:00:00'::timestamp),
  ('agent_ky_agent_id_2', 'agent_kyc_captures_agent_name_2', 'agent_ky_customer_id_2', 'agent_kyc_captures_customer_name_2', 'agent_kyc_captures_lga_2', 'Enugu', 80, 13.6889, 5.0607, 10.1602, '2025-09-30 00:00:00'::timestamp),
  ('agent_ky_agent_id_3', 'agent_kyc_captures_agent_name_3', 'agent_ky_customer_id_3', 'agent_kyc_captures_customer_name_3', 'agent_kyc_captures_lga_3', 'Kaduna', 29, 8.064, 81.3878, 54.1615, '2026-01-17 00:00:00'::timestamp);

-- Table: adverse_media_hits (10 columns, inserting 8)
INSERT INTO "adverse_media_hits" ("entity_name", "source", "headline", "risk_impact", "sentiment", "url", "reviewed_at", "status") VALUES
  ('adverse_media_hits_entity_name_1', 'adverse_media_hits_source_1', 'adverse_media_hits_headline_1', 'adverse_media_hits_risk_impact_1', 53.8144, 'https://api.54bank.ng/v1/adverse_media_hits/1', '2025-08-29 00:00:00'::timestamp, 'approved'),
  ('adverse_media_hits_entity_name_2', 'adverse_media_hits_source_2', 'adverse_media_hits_headline_2', 'adverse_media_hits_risk_impact_2', 67.1458, 'https://api.54bank.ng/v1/adverse_media_hits/2', '2025-12-29 00:00:00'::timestamp, 'pending'),
  ('adverse_media_hits_entity_name_3', 'adverse_media_hits_source_3', 'adverse_media_hits_headline_3', 'adverse_media_hits_risk_impact_3', 59.0451, 'https://api.54bank.ng/v1/adverse_media_hits/3', '2025-10-22 00:00:00'::timestamp, 'inactive');

-- Table: corporate_monitoring_events (8 columns, inserting 6)
INSERT INTO "corporate_monitoring_events" ("company_id", "event_type", "description", "risk_impact", "source_system", "acknowledged_at") VALUES
  ('corporat_company_id_1', 'basic', '54Bank corporate_monitoring_events record 1', 'corporate_monitoring_events_risk_impact_1', 'corporate_monitoring_events_source_system_1', '2025-11-25 00:00:00'::timestamp),
  ('corporat_company_id_2', 'premium', '54Bank corporate_monitoring_events record 2', 'corporate_monitoring_events_risk_impact_2', 'corporate_monitoring_events_source_system_2', '2025-10-29 00:00:00'::timestamp),
  ('corporat_company_id_3', 'premium', '54Bank corporate_monitoring_events record 3', 'corporate_monitoring_events_risk_impact_3', 'corporate_monitoring_events_source_system_3', '2026-01-14 00:00:00'::timestamp);

-- Table: kyc_data_quality_metrics (8 columns, inserting 6)
INSERT INTO "kyc_data_quality_metrics" ("total_customers", "kyc_complete", "kyc_complete_pct", "expired_documents", "duplicate_bvn", "missing_nin") VALUES
  (70, 24, 87.4857, 30, 89, 99),
  (70, 92, 38.6203, 51, 95, 78),
  (47, 18, 53.0363, 14, 41, 26);

-- Table: efass_returns (10 columns, inserting 8)
INSERT INTO "efass_returns" ("period", "type", "tier1_count", "tier2_count", "tier3_count", "total_customers", "status", "submitted_at") VALUES
  ('efass_returns_period_1', 'premium', 443, 351, 222, 48, 'pending', '2025-05-25 00:00:00'::timestamp),
  ('efass_returns_period_2', 'premium', 156, 88, 106, 62, 'inactive', '2026-04-01 00:00:00'::timestamp),
  ('efass_returns_period_3', 'premium', 293, 150, 356, 98, 'pending', '2026-05-08 00:00:00'::timestamp);

-- Table: nfiu_filings (11 columns, inserting 9)
INSERT INTO "nfiu_filings" ("report_type", "customer_id", "customer_name", "amount_ngn", "transaction_type", "status", "cbn_reference", "sla_deadline", "filed_at") VALUES
  ('basic', 'nfiu_fil_customer_id_1', 'nfiu_filings_customer_name_1', 4938452.14, 'premium', 'active', '54B-NFIU-262979', '2025-07-31 00:00:00'::timestamp, '2026-02-04 00:00:00'::timestamp),
  ('premium', 'nfiu_fil_customer_id_2', 'nfiu_filings_customer_name_2', 251214391.7, 'standard', 'approved', '54B-NFIU-529999', '2026-01-09 00:00:00'::timestamp, '2026-05-13 00:00:00'::timestamp),
  ('premium', 'nfiu_fil_customer_id_3', 'nfiu_filings_customer_name_3', 438166337.46, 'basic', 'inactive', '54B-NFIU-260070', '2025-10-06 00:00:00'::timestamp, '2025-09-24 00:00:00'::timestamp);

-- Table: bureau_checks (8 columns, inserting 6)
INSERT INTO "bureau_checks" ("customer_id", "bureau", "credit_score", "risk_grade", "active_loans", "default_history") VALUES
  ('bureau_c_customer_id_1', 'bureau_checks_bureau_1', 82, 'bureau_checks_risk_grade_1', 40, 93),
  ('bureau_c_customer_id_2', 'bureau_checks_bureau_2', 14, 'bureau_checks_risk_grade_2', 47, 76),
  ('bureau_c_customer_id_3', 'bureau_checks_bureau_3', 53, 'bureau_checks_risk_grade_3', 53, 52);

-- Table: escrow_accounts (25 columns, inserting 17)
INSERT INTO "escrow_accounts" ("escrowId", "tenantId", "escrowType", "status", "amount", "currency", "condition", "expiresAt", "tigerBeetleTxId", "kafkaEventId", "temporalWorkflowId", "approvedBy", "releasedAt", "cancelledAt", "disputeReason", "notes", "metadata") VALUES
  ('escrow_a_escrowid_1', 'tenant-abuja-hq', 'premium', 'completed', 164486019.61, 'USD', 'escrow_accounts_condition_1', '2026-01-11 00:00:00'::timestamp, 'escrow_a_tigerbeetletxid_1', 'escrow_a_kafkaeventid_1', 'escrow_a_temporalworkflowid_1', 'escrow_accounts_approvedby_1', '2026-04-02 00:00:00'::timestamp, '2026-03-11 00:00:00'::timestamp, '54Bank escrow_accounts record 1', '54Bank escrow_accounts record 1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('escrow_a_escrowid_2', 'tenant-lagos-main', 'standard', 'inactive', 89898457.09, 'NGN', 'escrow_accounts_condition_2', '2025-10-04 00:00:00'::timestamp, 'escrow_a_tigerbeetletxid_2', 'escrow_a_kafkaeventid_2', 'escrow_a_temporalworkflowid_2', 'escrow_accounts_approvedby_2', '2026-02-12 00:00:00'::timestamp, '2025-05-18 00:00:00'::timestamp, '54Bank escrow_accounts record 2', '54Bank escrow_accounts record 2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('escrow_a_escrowid_3', 'tenant-kano-north', 'basic', 'pending', 443421749.85, 'USD', 'escrow_accounts_condition_3', '2025-06-08 00:00:00'::timestamp, 'escrow_a_tigerbeetletxid_3', 'escrow_a_kafkaeventid_3', 'escrow_a_temporalworkflowid_3', 'escrow_accounts_approvedby_3', '2025-10-17 00:00:00'::timestamp, '2025-12-03 00:00:00'::timestamp, '54Bank escrow_accounts record 3', '54Bank escrow_accounts record 3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: escrow_parties (13 columns, inserting 8)
INSERT INTO "escrow_parties" ("escrowId", "role", "name", "accountId", "email", "phone", "signedAt", "metadata") VALUES
  ('escrow_p_escrowid_1', 'user', 'Samuel Eze', 'escrow_p_accountid_1', 'aisha.mohammed@54bank.ng', '+2347805027744', '2026-05-02 00:00:00'::timestamp, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('escrow_p_escrowid_2', 'admin', 'Kano Textiles Ltd', 'escrow_p_accountid_2', 'uchenna.ikenna@54bank.ng', '+2347149398149', '2025-09-11 00:00:00'::timestamp, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('escrow_p_escrowid_3', 'admin', 'Fatima Hassan', 'escrow_p_accountid_3', 'rashida.bello@54bank.ng', '+2347644639542', '2025-07-12 00:00:00'::timestamp, '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: escrow_transactions (15 columns, inserting 13)
INSERT INTO "escrow_transactions" ("txId", "escrowId", "type", "amount", "currency", "fromAccount", "toAccount", "status", "ledgerRef", "milestoneId", "narration", "fxRate", "fxSourceCurrency") VALUES
  ('escrow_t_txid_1', 'escrow_t_escrowid_1', 'basic', 14287201.91, 'GBP', 'escrow_transactions_fromaccount_1', 'escrow_transactions_toaccount_1', 'active', '54B-ESCR-897972', 'escrow_t_milestoneid_1', 'escrow_transactions_narration_1', 21.5715, 'NGN'),
  ('escrow_t_txid_2', 'escrow_t_escrowid_2', 'basic', 23311238.14, 'USD', 'escrow_transactions_fromaccount_2', 'escrow_transactions_toaccount_2', 'approved', '54B-ESCR-568198', 'escrow_t_milestoneid_2', 'escrow_transactions_narration_2', 23.2896, 'GBP'),
  ('escrow_t_txid_3', 'escrow_t_escrowid_3', 'premium', 461599595.58, 'GBP', 'escrow_transactions_fromaccount_3', 'escrow_transactions_toaccount_3', 'pending', '54B-ESCR-619261', 'escrow_t_milestoneid_3', 'escrow_transactions_narration_3', 21.4284, 'EUR');

-- Table: escrow_milestones (13 columns, inserting 10)
INSERT INTO "escrow_milestones" ("milestoneId", "escrowId", "description", "releaseAmount", "releasePercent", "dueDate", "status", "verifiedBy", "verifiedAt", "evidenceDocId") VALUES
  ('escrow_m_milestoneid_1', 'escrow_m_escrowid_1', '54Bank escrow_milestones record 1', 460407531.34, 6.6824, '2025-12-19 00:00:00'::timestamp, 'approved', 'escrow_milestones_verifiedby_1', '2026-03-12 00:00:00'::timestamp, 'escrow_m_evidencedocid_1'),
  ('escrow_m_milestoneid_2', 'escrow_m_escrowid_2', '54Bank escrow_milestones record 2', 27435985.64, 22.1798, '2025-08-18 00:00:00'::timestamp, 'completed', 'escrow_milestones_verifiedby_2', '2025-05-20 00:00:00'::timestamp, 'escrow_m_evidencedocid_2'),
  ('escrow_m_milestoneid_3', 'escrow_m_escrowid_3', '54Bank escrow_milestones record 3', 165168184.98, 9.6338, '2026-01-27 00:00:00'::timestamp, 'active', 'escrow_milestones_verifiedby_3', '2025-11-11 00:00:00'::timestamp, 'escrow_m_evidencedocid_3');

-- Table: escrow_disputes (13 columns, inserting 11)
INSERT INTO "escrow_disputes" ("disputeId", "escrowId", "raisedBy", "raisedByPartyId", "reason", "category", "status", "resolution", "arbitratorName", "arbitratorDecision", "resolvedAt") VALUES
  ('escrow_d_disputeid_1', 'escrow_d_escrowid_1', 'escrow_disputes_raisedby_1', 87, '54Bank escrow_disputes record 1', 'basic', 'pending', 'escrow_disputes_resolution_1', 'escrow_disputes_arbitratorname_1', 'escrow_disputes_arbitratordecision_1', '2025-10-28 00:00:00'::timestamp),
  ('escrow_d_disputeid_2', 'escrow_d_escrowid_2', 'escrow_disputes_raisedby_2', 34, '54Bank escrow_disputes record 2', 'basic', 'active', 'escrow_disputes_resolution_2', 'escrow_disputes_arbitratorname_2', 'escrow_disputes_arbitratordecision_2', '2025-12-23 00:00:00'::timestamp),
  ('escrow_d_disputeid_3', 'escrow_d_escrowid_3', 'escrow_disputes_raisedby_3', 71, '54Bank escrow_disputes record 3', 'standard', 'rejected', 'escrow_disputes_resolution_3', 'escrow_disputes_arbitratorname_3', 'escrow_disputes_arbitratordecision_3', '2026-04-04 00:00:00'::timestamp);

-- Table: escrow_documents (14 columns, inserting 11)
INSERT INTO "escrow_documents" ("documentId", "escrowId", "documentType", "fileName", "fileSize", "mimeType", "storageUrl", "uploadedBy", "verifiedBy", "verifiedAt", "metadata") VALUES
  ('escrow_d_documentid_1', 'escrow_d_escrowid_1', 'standard', 'escrow_documents_filename_1', 163, 'premium', 'https://api.54bank.ng/v1/escrow_documents/1', 'escrow_documents_uploadedby_1', 'escrow_documents_verifiedby_1', '2025-09-09 00:00:00'::timestamp, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('escrow_d_documentid_2', 'escrow_d_escrowid_2', 'basic', 'escrow_documents_filename_2', 286, 'standard', 'https://api.54bank.ng/v1/escrow_documents/2', 'escrow_documents_uploadedby_2', 'escrow_documents_verifiedby_2', '2025-05-15 00:00:00'::timestamp, '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('escrow_d_documentid_3', 'escrow_d_escrowid_3', 'standard', 'escrow_documents_filename_3', 416, 'standard', 'https://api.54bank.ng/v1/escrow_documents/3', 'escrow_documents_uploadedby_3', 'escrow_documents_verifiedby_3', '2025-09-30 00:00:00'::timestamp, '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: escrow_fees (10 columns, inserting 7)
INSERT INTO "escrow_fees" ("feeId", "escrowId", "feeType", "amount", "currency", "ledgerRef", "narration") VALUES
  ('escrow_f_feeid_1', 'escrow_f_escrowid_1', 'premium', 363939707.95, 'GBP', '54B-ESCR-599722', 'escrow_fees_narration_1'),
  ('escrow_f_feeid_2', 'escrow_f_escrowid_2', 'basic', 315616190.78, 'EUR', '54B-ESCR-436003', 'escrow_fees_narration_2'),
  ('escrow_f_feeid_3', 'escrow_f_escrowid_3', 'premium', 295900494.72, 'GBP', '54B-ESCR-764992', 'escrow_fees_narration_3');

-- Table: escrow_interest_accruals (13 columns, inserting 10)
INSERT INTO "escrow_interest_accruals" ("accrualId", "escrowId", "principalAmount", "rate", "accrualPeriodStart", "accrualPeriodEnd", "daysInPeriod", "interestAmount", "cumulativeInterest", "ledgerRef") VALUES
  ('escrow_i_accrualid_1', 'escrow_i_escrowid_1', 361697170.78, 6.4914, '2026-02-21 00:00:00'::timestamp, '2026-03-06 00:00:00'::timestamp, 28, 334982015.88, 32.8934, '54B-ESCR-111377'),
  ('escrow_i_accrualid_2', 'escrow_i_escrowid_2', 76521882.54, 8.8413, '2025-05-27 00:00:00'::timestamp, '2025-08-07 00:00:00'::timestamp, 28, 307911017.41, 85.866, '54B-ESCR-576540'),
  ('escrow_i_accrualid_3', 'escrow_i_escrowid_3', 362007713.41, 21.9173, '2025-07-06 00:00:00'::timestamp, '2026-02-03 00:00:00'::timestamp, 51, 340740077.88, 42.4666, '54B-ESCR-385363');

-- Table: escrow_regulatory_reports (15 columns, inserting 12)
INSERT INTO "escrow_regulatory_reports" ("reportId", "reportType", "reportingPeriodStart", "reportingPeriodEnd", "totalEscrowAccounts", "totalHeldValue", "totalReleasedValue", "totalDisputedValue", "totalInterestAccrued", "filedAt", "filingReference", "reportData") VALUES
  ('escrow_r_reportid_1', 'basic', '2025-08-31 00:00:00'::timestamp, '2026-03-24 00:00:00'::timestamp, 187, 382158486.52, 378099432.5, 415956902.31, 32.9119, '2025-11-15 00:00:00'::timestamp, '54B-ESCR-157227', '{"key": "value"}'::jsonb),
  ('escrow_r_reportid_2', 'basic', '2026-01-11 00:00:00'::timestamp, '2026-01-29 00:00:00'::timestamp, 403, 489037036.9, 252869064.45, 70844390.13, 15.732, '2026-03-02 00:00:00'::timestamp, '54B-ESCR-328793', '{"key": "value"}'::jsonb),
  ('escrow_r_reportid_3', 'basic', '2026-04-21 00:00:00'::timestamp, '2025-12-28 00:00:00'::timestamp, 179, 446484256.96, 191692662.67, 22087751.89, 99.8968, '2025-10-28 00:00:00'::timestamp, '54B-ESCR-844354', '{"key": "value"}'::jsonb);

-- Table: escrow_audit_log (10 columns, inserting 8)
INSERT INTO "escrow_audit_log" ("auditId", "escrowId", "action", "actor", "details", "ipAddress", "kafkaTopic", "kafkaOffset") VALUES
  ('escrow_a_auditid_1', 'escrow_a_escrowid_1', 'escrow_audit_log_action_1', 'escrow_audit_log_actor_1', '54Bank escrow_audit_log record 1', '154 Allen Street, Oyo', 'escrow_audit_log_kafkatopic_1', 'escrow_audit_log_kafkaoffset_1'),
  ('escrow_a_auditid_2', 'escrow_a_escrowid_2', 'escrow_audit_log_action_2', 'escrow_audit_log_actor_2', '54Bank escrow_audit_log record 2', '42 Allen Street, Kaduna', 'escrow_audit_log_kafkatopic_2', 'escrow_audit_log_kafkaoffset_2'),
  ('escrow_a_auditid_3', 'escrow_a_escrowid_3', 'escrow_audit_log_action_3', 'escrow_audit_log_actor_3', '54Bank escrow_audit_log record 3', '13 Marina Street, Lagos', 'escrow_audit_log_kafkatopic_3', 'escrow_audit_log_kafkaoffset_3');

-- Table: scratch_cards (22 columns, inserting 17)
INSERT INTO "scratch_cards" ("card_id", "batch_id", "serial_number", "card_type", "pin_hash", "pin_length", "status", "value", "currency", "issued_to", "customer_id", "branch_code", "expires_at", "activated_at", "used_at", "revoked_at", "revoke_reason") VALUES
  ('scratch__card_id_1', 'scratch__batch_id_1', 'scratch__serial_number_1', 'premium', 'scratch_cards_pin_hash_1', 160, 'approved', 177913182.55, 'USD', 'scratch_cards_issued_to_1', 'scratch__customer_id_1', 'PHC-001', '2025-05-27 00:00:00'::timestamp, '2025-10-31 00:00:00'::timestamp, '2025-12-13 00:00:00'::timestamp, '2025-06-05 00:00:00'::timestamp, '54Bank scratch_cards record 1'),
  ('scratch__card_id_2', 'scratch__batch_id_2', 'scratch__serial_number_2', 'standard', 'scratch_cards_pin_hash_2', 250, 'completed', 272366446.91, 'GBP', 'scratch_cards_issued_to_2', 'scratch__customer_id_2', 'KAN-001', '2025-05-28 00:00:00'::timestamp, '2026-01-29 00:00:00'::timestamp, '2025-11-09 00:00:00'::timestamp, '2026-05-05 00:00:00'::timestamp, '54Bank scratch_cards record 2'),
  ('scratch__card_id_3', 'scratch__batch_id_3', 'scratch__serial_number_3', 'premium', 'scratch_cards_pin_hash_3', 325, 'pending', 376577849.48, 'EUR', 'scratch_cards_issued_to_3', 'scratch__customer_id_3', 'ABJ-001', '2025-09-30 00:00:00'::timestamp, '2026-02-23 00:00:00'::timestamp, '2025-08-13 00:00:00'::timestamp, '2025-10-19 00:00:00'::timestamp, '54Bank scratch_cards record 3');

-- Table: card_batches (12 columns, inserting 7)
INSERT INTO "card_batches" ("batch_id", "batch_size", "card_type", "generated_by", "status", "branch_code", "expires_at") VALUES
  ('card_bat_batch_id_1', 402, 'standard', 'card_batches_generated_by_1', 'approved', 'PHC-001', '2026-02-03 00:00:00'::timestamp),
  ('card_bat_batch_id_2', 206, 'basic', 'card_batches_generated_by_2', 'rejected', 'LOS-001', '2026-01-06 00:00:00'::timestamp),
  ('card_bat_batch_id_3', 128, 'premium', 'card_batches_generated_by_3', 'active', 'LOS-001', '2025-10-20 00:00:00'::timestamp);

-- Table: pin_verifications (11 columns, inserting 9)
INSERT INTO "pin_verifications" ("verification_id", "card_id", "serial_number", "customer_id", "transaction_id", "channel", "result", "ip_address", "device_id") VALUES
  ('pin_veri_verification_id_1', 'pin_veri_card_id_1', 'pin_veri_serial_number_1', 'pin_veri_customer_id_1', 'pin_veri_transaction_id_1', 'pin_verifications_channel_1', 'pin_verifications_result_1', '93 Allen Street, Enugu', 'pin_veri_device_id_1'),
  ('pin_veri_verification_id_2', 'pin_veri_card_id_2', 'pin_veri_serial_number_2', 'pin_veri_customer_id_2', 'pin_veri_transaction_id_2', 'pin_verifications_channel_2', 'pin_verifications_result_2', '141 Marina Street, Lagos', 'pin_veri_device_id_2'),
  ('pin_veri_verification_id_3', 'pin_veri_card_id_3', 'pin_veri_serial_number_3', 'pin_veri_customer_id_3', 'pin_veri_transaction_id_3', 'pin_verifications_channel_3', 'pin_verifications_result_3', '27 Marina Street, Ogun', 'pin_veri_device_id_3');

-- Table: grid_cards (13 columns, inserting 10)
INSERT INTO "grid_cards" ("grid_card_id", "customer_id", "card_serial", "grid_size", "grid_values_encrypted", "status", "branch_code", "issued_at", "expires_at", "last_used_at") VALUES
  ('grid_car_grid_card_id_1', 'grid_car_customer_id_1', 'grid_car_card_serial_1', 'grid_car_grid_size_1', 'grid_car_grid_values_encrypted_1', 'inactive', 'PHC-001', '2026-03-06 00:00:00'::timestamp, '2025-09-15 00:00:00'::timestamp, '2026-01-19 00:00:00'::timestamp),
  ('grid_car_grid_card_id_2', 'grid_car_customer_id_2', 'grid_car_card_serial_2', 'grid_car_grid_size_2', 'grid_car_grid_values_encrypted_2', 'inactive', 'PHC-001', '2025-05-21 00:00:00'::timestamp, '2025-07-08 00:00:00'::timestamp, '2025-12-08 00:00:00'::timestamp),
  ('grid_car_grid_card_id_3', 'grid_car_customer_id_3', 'grid_car_card_serial_3', 'grid_car_grid_size_3', 'grid_car_grid_values_encrypted_3', 'pending', 'ABJ-001', '2026-01-09 00:00:00'::timestamp, '2026-01-06 00:00:00'::timestamp, '2025-12-22 00:00:00'::timestamp);

-- Table: crypto_keys (17 columns, inserting 14)
INSERT INTO "crypto_keys" ("key_id", "name", "key_type", "algorithm", "purpose", "status", "key_size_bits", "rotation_period_days", "hsm_slot", "custodian_1", "custodian_2", "last_used_at", "expires_at", "rotated_at") VALUES
  ('crypto_k_key_id_1', 'Ngozi Okafor', 'basic', 'crypto_keys_algorithm_1', '54Bank crypto_keys record 1', 'completed', 135, 67, 'crypto_keys_hsm_slot_1', 'crypto_keys_custodian_1_1', 'crypto_keys_custodian_2_1', '2026-04-26 00:00:00'::timestamp, '2025-06-23 00:00:00'::timestamp, '2025-08-17 00:00:00'::timestamp),
  ('crypto_k_key_id_2', 'Emeka & Sons Trading', 'premium', 'crypto_keys_algorithm_2', '54Bank crypto_keys record 2', 'rejected', 336, 66, 'crypto_keys_hsm_slot_2', 'crypto_keys_custodian_1_2', 'crypto_keys_custodian_2_2', '2025-07-06 00:00:00'::timestamp, '2025-07-29 00:00:00'::timestamp, '2025-12-03 00:00:00'::timestamp),
  ('crypto_k_key_id_3', 'Ibrahim Musa', 'basic', 'crypto_keys_algorithm_3', '54Bank crypto_keys record 3', 'rejected', 394, 59, 'crypto_keys_hsm_slot_3', 'crypto_keys_custodian_1_3', 'crypto_keys_custodian_2_3', '2025-07-31 00:00:00'::timestamp, '2025-08-08 00:00:00'::timestamp, '2025-08-28 00:00:00'::timestamp);

-- Table: mfa_enrollments (11 columns, inserting 9)
INSERT INTO "mfa_enrollments" ("enrollment_id", "customer_id", "methods", "primary_method", "backup_method", "status", "risk_level", "channel", "last_verified") VALUES
  ('mfa_enro_enrollment_id_1', 'mfa_enro_customer_id_1', 'card', 'card', 'ussd', 'active', 'mfa_enrollments_risk_level_1', 'mfa_enrollments_channel_1', '2025-12-24 00:00:00'::timestamp),
  ('mfa_enro_enrollment_id_2', 'mfa_enro_customer_id_2', 'bank_transfer', 'ussd', 'mobile_money', 'pending', 'mfa_enrollments_risk_level_2', 'mfa_enrollments_channel_2', '2026-02-10 00:00:00'::timestamp),
  ('mfa_enro_enrollment_id_3', 'mfa_enro_customer_id_3', 'ussd', 'mobile_money', 'ussd', 'active', 'mfa_enrollments_risk_level_3', 'mfa_enrollments_channel_3', '2026-02-01 00:00:00'::timestamp);

-- Table: mfa_policies (9 columns, inserting 5)
INSERT INTO "mfa_policies" ("policy_id", "name", "transaction_type", "allowed_methods", "status") VALUES
  ('mfa_poli_policy_id_1', 'Rashida Bello', 'basic', 'bank_transfer', 'active'),
  ('mfa_poli_policy_id_2', 'Emeka & Sons Trading', 'standard', 'mobile_money', 'completed'),
  ('mfa_poli_policy_id_3', 'Aisha Mohammed', 'standard', 'mobile_money', 'rejected');

-- Table: otp_records (13 columns, inserting 10)
INSERT INTO "otp_records" ("otp_id", "policy_id", "customer_id", "channel", "purpose", "otp_hash", "status", "delivered_via", "expires_at", "verified_at") VALUES
  ('otp_reco_otp_id_1', 'otp_reco_policy_id_1', 'otp_reco_customer_id_1', 'otp_records_channel_1', '54Bank otp_records record 1', 'otp_records_otp_hash_1', 'approved', 'otp_records_delivered_via_1', '2025-09-11 00:00:00'::timestamp, '2025-07-30 00:00:00'::timestamp),
  ('otp_reco_otp_id_2', 'otp_reco_policy_id_2', 'otp_reco_customer_id_2', 'otp_records_channel_2', '54Bank otp_records record 2', 'otp_records_otp_hash_2', 'inactive', 'otp_records_delivered_via_2', '2025-12-30 00:00:00'::timestamp, '2026-05-02 00:00:00'::timestamp),
  ('otp_reco_otp_id_3', 'otp_reco_policy_id_3', 'otp_reco_customer_id_3', 'otp_records_channel_3', '54Bank otp_records record 3', 'otp_records_otp_hash_3', 'rejected', 'otp_records_delivered_via_3', '2025-07-30 00:00:00'::timestamp, '2026-03-20 00:00:00'::timestamp);

-- Table: session_records (14 columns, inserting 12)
INSERT INTO "session_records" ("session_id", "customer_id", "channel", "device_fingerprint", "ip_address", "geo_location", "status", "mfa_level", "risk_score", "last_activity", "expires_at", "terminated_reason") VALUES
  ('session__session_id_1', 'session__customer_id_1', 'session_records_channel_1', 'session_records_device_fingerprint_1', '57 Allen Street, Imo', 'Imo', 'active', 'session_records_mfa_level_1', 15.8266, '2025-05-23 00:00:00'::timestamp, '2026-03-13 00:00:00'::timestamp, '54Bank session_records record 1'),
  ('session__session_id_2', 'session__customer_id_2', 'session_records_channel_2', 'session_records_device_fingerprint_2', '23 Marina Street, Kaduna', 'Imo', 'completed', 'session_records_mfa_level_2', 2.3751, '2026-04-15 00:00:00'::timestamp, '2025-10-21 00:00:00'::timestamp, '54Bank session_records record 2'),
  ('session__session_id_3', 'session__customer_id_3', 'session_records_channel_3', 'session_records_device_fingerprint_3', '57 Ahmadu Bello Street, Kano', 'Imo', 'inactive', 'session_records_mfa_level_3', 17.5303, '2025-09-07 00:00:00'::timestamp, '2025-07-06 00:00:00'::timestamp, '54Bank session_records record 3');

-- Table: api_keys (14 columns, inserting 11)
INSERT INTO "api_keys" ("api_key_id", "name", "key_prefix", "tenant_id", "scopes", "rate_limit", "status", "ip_whitelist", "last_used_at", "expires_at", "created_by") VALUES
  ('api_keys_api_key_id_1', 'Godwin Etim', '54B-API_-784190', 'tenant-ph-south', 'api_keys_scopes_1', 270490417, 'active', 'api_keys_ip_whitelist_1', '2025-07-21 00:00:00'::timestamp, '2026-03-13 00:00:00'::timestamp, 'api_keys_created_by_1'),
  ('api_keys_api_key_id_2', 'Dangote Industries Ltd', '54B-API_-183912', 'tenant-abuja-hq', 'api_keys_scopes_2', 291381329, 'approved', 'api_keys_ip_whitelist_2', '2026-05-08 00:00:00'::timestamp, '2026-02-26 00:00:00'::timestamp, 'api_keys_created_by_2'),
  ('api_keys_api_key_id_3', 'Chidi Obi', '54B-API_-695547', 'tenant-lagos-main', 'api_keys_scopes_3', 496601017, 'completed', 'api_keys_ip_whitelist_3', '2025-12-10 00:00:00'::timestamp, '2026-04-03 00:00:00'::timestamp, 'api_keys_created_by_3');

-- Table: security_events (13 columns, inserting 11)
INSERT INTO "security_events" ("event_id", "event_type", "sub_type", "actor", "channel", "ip_address", "geo_location", "details", "risk_score", "severity", "hash_chain") VALUES
  ('security_event_id_1', 'basic', 'basic', 'security_events_actor_1', 'security_events_channel_1', '45 Marina Street, Ogun', 'Ogun', '54Bank security_events record 1', 4.2942, 'security_events_severity_1', 'security_events_hash_chain_1'),
  ('security_event_id_2', 'standard', 'basic', 'security_events_actor_2', 'security_events_channel_2', '153 Marina Street, Lagos', 'Enugu', '54Bank security_events record 2', 18.3344, 'security_events_severity_2', 'security_events_hash_chain_2'),
  ('security_event_id_3', 'premium', 'basic', 'security_events_actor_3', 'security_events_channel_3', '36 Ahmadu Bello Street, Lagos', 'Rivers', '54Bank security_events record 3', 8.6625, 'security_events_severity_3', 'security_events_hash_chain_3');

-- Table: certificates (15 columns, inserting 13)
INSERT INTO "certificates" ("cert_id", "common_name", "cert_type", "algorithm", "issuer", "serial_number", "status", "valid_from", "valid_to", "renewal_days", "last_renewed", "revoked_at", "revocation_reason") VALUES
  ('certific_cert_id_1', 'certificates_common_name_1', 'premium', 'certificates_algorithm_1', 'certificates_issuer_1', 'certific_serial_number_1', 'approved', '2025-08-18 00:00:00'::timestamp, '2025-08-17 00:00:00'::timestamp, 27, '2025-12-31 00:00:00'::timestamp, '2026-02-18 00:00:00'::timestamp, '54Bank certificates record 1'),
  ('certific_cert_id_2', 'certificates_common_name_2', 'basic', 'certificates_algorithm_2', 'certificates_issuer_2', 'certific_serial_number_2', 'inactive', '2025-07-18 00:00:00'::timestamp, '2025-10-15 00:00:00'::timestamp, 78, '2025-09-07 00:00:00'::timestamp, '2025-06-06 00:00:00'::timestamp, '54Bank certificates record 2'),
  ('certific_cert_id_3', 'certificates_common_name_3', 'premium', 'certificates_algorithm_3', 'certificates_issuer_3', 'certific_serial_number_3', 'approved', '2025-05-27 00:00:00'::timestamp, '2026-03-08 00:00:00'::timestamp, 66, '2025-07-07 00:00:00'::timestamp, '2026-02-23 00:00:00'::timestamp, '54Bank certificates record 3');

-- Table: jwt_validations (11 columns, inserting 6)
INSERT INTO "jwt_validations" ("token_type", "issuer", "audience", "algorithm", "avg_latency_ms", "cache_hit_rate") VALUES
  ('basic', 'jwt_validations_issuer_1', 'jwt_validations_audience_1', 'jwt_validations_algorithm_1', 12.3619, 22.4376),
  ('standard', 'jwt_validations_issuer_2', 'jwt_validations_audience_2', 'jwt_validations_algorithm_2', 43.5375, 15.7055),
  ('basic', 'jwt_validations_issuer_3', 'jwt_validations_audience_3', 'jwt_validations_algorithm_3', 20.8103, 3.8997);

-- Table: route_schemas (9 columns, inserting 4)
INSERT INTO "route_schemas" ("path", "method", "schema_name", "pass_rate") VALUES
  ('route_schemas_path_1', 'mobile_money', 'route_schemas_schema_name_1', 19.0619),
  ('route_schemas_path_2', 'mobile_money', 'route_schemas_schema_name_2', 23.9922),
  ('route_schemas_path_3', 'bank_transfer', 'route_schemas_schema_name_3', 18.7209);

-- Table: sql_queries (10 columns, inserting 2)
INSERT INTO "sql_queries" ("original_query", "avg_latency_ms") VALUES
  ('sql_queries_original_query_1', 23.5987),
  ('sql_queries_original_query_2', 62.2791),
  ('sql_queries_original_query_3', 74.2685);

-- Table: vault_secrets (10 columns, inserting 5)
INSERT INTO "vault_secrets" ("path", "engine", "rotation_days", "last_rotated", "next_rotation") VALUES
  ('vault_secrets_path_1', 'vault_secrets_engine_1', 94, '2026-05-09 00:00:00'::timestamp, '2026-01-21 00:00:00'::timestamp),
  ('vault_secrets_path_2', 'vault_secrets_engine_2', 97, '2026-04-06 00:00:00'::timestamp, '2026-02-03 00:00:00'::timestamp),
  ('vault_secrets_path_3', 'vault_secrets_engine_3', 11, '2025-12-15 00:00:00'::timestamp, '2025-08-03 00:00:00'::timestamp);

-- Table: pin_hashes (11 columns, inserting 6)
INSERT INTO "pin_hashes" ("algorithm", "memory_cost", "time_cost", "parallelism", "salt_length", "hash_length") VALUES
  ('pin_hashes_algorithm_1', 25, 98, 84, 133, 388),
  ('pin_hashes_algorithm_2', 77, 80, 73, 403, 226),
  ('pin_hashes_algorithm_3', 1, 29, 36, 404, 44);

-- Table: docker_hardening_checks (10 columns, inserting 4)
INSERT INTO "docker_hardening_checks" ("check_name", "category", "cis_benchmark", "severity") VALUES
  ('docker_hardening_checks_check_name_1', 'basic', 'docker_hardening_checks_cis_benchmark_1', 'docker_hardening_checks_severity_1'),
  ('docker_hardening_checks_check_name_2', 'basic', 'docker_hardening_checks_cis_benchmark_2', 'docker_hardening_checks_severity_2'),
  ('docker_hardening_checks_check_name_3', 'standard', 'docker_hardening_checks_cis_benchmark_3', 'docker_hardening_checks_severity_3');

-- Table: pkce_flows (11 columns, inserting 7)
INSERT INTO "pkce_flows" ("client_id", "grant_type", "code_challenge_method", "redirect_uri", "scopes", "token_lifetime", "refresh_lifetime") VALUES
  ('pkce_flo_client_id_1', 'premium', 'card', 'pkce_flows_redirect_uri_1', '{"key": "value"}'::jsonb, 74, 69),
  ('pkce_flo_client_id_2', 'basic', 'ussd', 'pkce_flows_redirect_uri_2', '{"key": "value"}'::jsonb, 20, 20),
  ('pkce_flo_client_id_3', 'basic', 'card', 'pkce_flows_redirect_uri_3', '{"key": "value"}'::jsonb, 72, 99);

-- Table: token_families (10 columns, inserting 3)
INSERT INTO "token_families" ("family_id", "user_id", "client_id") VALUES
  ('token_fa_family_id_1', 'token_fa_user_id_1', 'token_fa_client_id_1'),
  ('token_fa_family_id_2', 'token_fa_user_id_2', 'token_fa_client_id_2'),
  ('token_fa_family_id_3', 'token_fa_user_id_3', 'token_fa_client_id_3');

-- Table: mtls_nodes (11 columns, inserting 5)
INSERT INTO "mtls_nodes" ("service_name", "spiffe_id", "cert_serial", "cert_expiry", "issuer") VALUES
  ('mtls_nodes_service_name_1', 'mtls_nod_spiffe_id_1', 'mtls_nod_cert_serial_1', '2025-11-09 00:00:00'::timestamp, 'mtls_nodes_issuer_1'),
  ('mtls_nodes_service_name_2', 'mtls_nod_spiffe_id_2', 'mtls_nod_cert_serial_2', '2026-02-17 00:00:00'::timestamp, 'mtls_nodes_issuer_2'),
  ('mtls_nodes_service_name_3', 'mtls_nod_spiffe_id_3', 'mtls_nod_cert_serial_3', '2025-09-29 00:00:00'::timestamp, 'mtls_nodes_issuer_3');

-- Table: body_limit_rules (10 columns, inserting 4)
INSERT INTO "body_limit_rules" ("path", "method", "max_body_bytes", "content_types") VALUES
  ('body_limit_rules_path_1', 'mobile_money', 41445001664, '{"key": "value"}'::jsonb),
  ('body_limit_rules_path_2', 'ussd', 13080001931, '{"key": "value"}'::jsonb),
  ('body_limit_rules_path_3', 'card', 3618679592, '{"key": "value"}'::jsonb);

-- Table: kms_keys (10 columns, inserting 5)
INSERT INTO "kms_keys" ("provider", "key_id", "algorithm", "usage", "state") VALUES
  ('kms_keys_provider_1', 'kms_keys_key_id_1', 'kms_keys_algorithm_1', 'kms_keys_usage_1', 'Rivers'),
  ('kms_keys_provider_2', 'kms_keys_key_id_2', 'kms_keys_algorithm_2', 'kms_keys_usage_2', 'Enugu'),
  ('kms_keys_provider_3', 'kms_keys_key_id_3', 'kms_keys_algorithm_3', 'kms_keys_usage_3', 'Kano');

-- Table: tls_configs (10 columns, inserting 4)
INSERT INTO "tls_configs" ("domain", "protocol", "cipher_suites", "cert_expiry") VALUES
  ('tls_configs_domain_1', 'tls_configs_protocol_1', '{"key": "value"}'::jsonb, '2026-01-06 00:00:00'::timestamp),
  ('tls_configs_domain_2', 'tls_configs_protocol_2', '{"key": "value"}'::jsonb, '2025-07-06 00:00:00'::timestamp),
  ('tls_configs_domain_3', 'tls_configs_protocol_3', '{"key": "value"}'::jsonb, '2025-09-09 00:00:00'::timestamp);

-- Table: correlation_rules (11 columns, inserting 5)
INSERT INTO "correlation_rules" ("name", "mitre_ids", "kill_chain_phase", "trigger_events", "correlation_window") VALUES
  ('Kemi Adeyemi', '{"key": "value"}'::jsonb, 'correlation_rules_kill_chain_phase_1', '{"key": "value"}'::jsonb, 'correlation_rules_correlation_window_1'),
  ('Kano Textiles Ltd', '{"key": "value"}'::jsonb, 'correlation_rules_kill_chain_phase_2', '{"key": "value"}'::jsonb, 'correlation_rules_correlation_window_2'),
  ('Kemi Adeyemi', '{"key": "value"}'::jsonb, 'correlation_rules_kill_chain_phase_3', '{"key": "value"}'::jsonb, 'correlation_rules_correlation_window_3');

-- Table: pci_scans (10 columns, inserting 4)
INSERT INTO "pci_scans" ("requirement", "findings", "last_scan", "scan_duration") VALUES
  ('pci_scans_requirement_1', '{"key": "value"}'::jsonb, '2025-12-24 00:00:00'::timestamp, 'pci_scans_scan_duration_1'),
  ('pci_scans_requirement_2', '{"key": "value"}'::jsonb, '2025-06-15 00:00:00'::timestamp, 'pci_scans_scan_duration_2'),
  ('pci_scans_requirement_3', '{"key": "value"}'::jsonb, '2025-10-21 00:00:00'::timestamp, 'pci_scans_scan_duration_3');

-- Table: api_key_policies (11 columns, inserting 6)
INSERT INTO "api_key_policies" ("name", "prefix", "required_scopes", "ip_whitelist", "rate_limit", "rotation_warning_days") VALUES
  ('Yetunde Olowe', '54B-API_-293898', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 341943333, 66),
  ('Lagos Agro-Allied Co', '54B-API_-872836', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 90792257, 24),
  ('Godwin Etim', '54B-API_-641052', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 39981535, 30);

-- Table: path_validation_rules (8 columns, inserting 3)
INSERT INTO "path_validation_rules" ("pattern", "regex", "common_violations") VALUES
  ('path_validation_rules_pattern_1', 'path_validation_rules_regex_1', '{"key": "value"}'::jsonb),
  ('path_validation_rules_pattern_2', 'path_validation_rules_regex_2', '{"key": "value"}'::jsonb),
  ('path_validation_rules_pattern_3', 'path_validation_rules_regex_3', '{"key": "value"}'::jsonb);

-- Table: key_rotation_schedules (12 columns, inserting 6)
INSERT INTO "key_rotation_schedules" ("key_id", "algorithm", "rotation_interval", "grace_period", "previous_version", "next_rotation") VALUES
  ('key_rota_key_id_1', 'key_rotation_schedules_algorithm_1', 'key_rotation_schedules_rotation_interval_1', 'key_rotation_schedules_grace_period_1', 90, '2026-02-13 00:00:00'::timestamp),
  ('key_rota_key_id_2', 'key_rotation_schedules_algorithm_2', 'key_rotation_schedules_rotation_interval_2', 'key_rotation_schedules_grace_period_2', 16, '2026-05-11 00:00:00'::timestamp),
  ('key_rota_key_id_3', 'key_rotation_schedules_algorithm_3', 'key_rotation_schedules_rotation_interval_3', 'key_rotation_schedules_grace_period_3', 77, '2025-08-01 00:00:00'::timestamp);

-- Table: network_policies (10 columns, inserting 5)
INSERT INTO "network_policies" ("name", "namespace", "pod_selector", "ingress_rules", "egress_rules") VALUES
  ('Danladi Garba', 'network_policies_namespace_1', 'network_policies_pod_selector_1', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb),
  ('Abuja Properties Ltd', 'network_policies_namespace_2', 'network_policies_pod_selector_2', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb),
  ('Obinna Chukwu', 'network_policies_namespace_3', 'network_policies_pod_selector_3', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb);

-- Table: vault_engines (10 columns, inserting 5)
INSERT INTO "vault_engines" ("path", "engine_type", "description", "max_ttl", "default_ttl") VALUES
  ('vault_engines_path_1', 'premium', '54Bank vault_engines record 1', 'vault_engines_max_ttl_1', 'vault_engines_default_ttl_1'),
  ('vault_engines_path_2', 'premium', '54Bank vault_engines record 2', 'vault_engines_max_ttl_2', 'vault_engines_default_ttl_2'),
  ('vault_engines_path_3', 'premium', '54Bank vault_engines record 3', 'vault_engines_max_ttl_3', 'vault_engines_default_ttl_3');

-- Table: anomaly_models (13 columns, inserting 8)
INSERT INTO "anomaly_models" ("name", "model_type", "features", "accuracy", "precision", "recall", "f1_score", "training_size") VALUES
  ('Ngozi Okafor', 'standard', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 30.6022, 92.8313, 8.4282, 3.4331, 29075900185),
  ('Abuja Properties Ltd', 'premium', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 17.5291, 67.775, 40.961, 12.6111, 19391614531),
  ('Aisha Mohammed', 'basic', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 82.9884, 57.1839, 42.1509, 6.4088, 39561250509);

-- Table: ndpr_records (10 columns, inserting 7)
INSERT INTO "ndpr_records" ("record_type", "subject", "request_type", "response_time_days", "sla_deadline_days", "data_categories", "dpo") VALUES
  ('standard', 'ndpr_records_subject_1', 'standard', 47, 80, '{"key": "value"}'::jsonb, 'ndpr_records_dpo_1'),
  ('basic', 'ndpr_records_subject_2', 'basic', 4, 80, '{"key": "value"}'::jsonb, 'ndpr_records_dpo_2'),
  ('basic', 'ndpr_records_subject_3', 'standard', 75, 97, '{"key": "value"}'::jsonb, 'ndpr_records_dpo_3');

-- Table: output_encoding_rules (8 columns, inserting 3)
INSERT INTO "output_encoding_rules" ("context", "encoder", "chars_encoded") VALUES
  ('output_encoding_rules_context_1', 'output_e_encoder_1', '{"key": "value"}'::jsonb),
  ('output_encoding_rules_context_2', 'output_e_encoder_2', '{"key": "value"}'::jsonb),
  ('output_encoding_rules_context_3', 'output_e_encoder_3', '{"key": "value"}'::jsonb);

-- Table: image_scans (13 columns, inserting 4)
INSERT INTO "image_scans" ("image_name", "registry", "base_image", "last_scanned") VALUES
  ('image_scans_image_name_1', 'image_scans_registry_1', 'image_scans_base_image_1', '2025-11-20 00:00:00'::timestamp),
  ('image_scans_image_name_2', 'image_scans_registry_2', 'image_scans_base_image_2', '2026-03-10 00:00:00'::timestamp),
  ('image_scans_image_name_3', 'image_scans_registry_3', 'image_scans_base_image_3', '2025-12-01 00:00:00'::timestamp);

-- Table: waf_rules (11 columns, inserting 4)
INSERT INTO "waf_rules" ("rule_id", "name", "category", "severity") VALUES
  ('waf_rule_rule_id_1', 'Adewale Ogundimu', 'premium', 'waf_rules_severity_1'),
  ('waf_rule_rule_id_2', 'Emeka & Sons Trading', 'premium', 'waf_rules_severity_2'),
  ('waf_rule_rule_id_3', 'Ibrahim Musa', 'premium', 'waf_rules_severity_3');

-- Table: ddos_rules (9 columns, inserting 4)
INSERT INTO "ddos_rules" ("name", "layer", "threshold", "action") VALUES
  ('Samuel Eze', 'ddos_rules_layer_1', 'ddos_rules_threshold_1', 'ddos_rules_action_1'),
  ('Emeka & Sons Trading', 'ddos_rules_layer_2', 'ddos_rules_threshold_2', 'ddos_rules_action_2'),
  ('Kemi Adeyemi', 'ddos_rules_layer_3', 'ddos_rules_threshold_3', 'ddos_rules_action_3');

-- Table: ip_rules (10 columns, inserting 5)
INSERT INTO "ip_rules" ("name", "cidr", "rule_type", "applies_to", "geo_country") VALUES
  ('Kemi Adeyemi', 'ip_rules_cidr_1', 'premium', 'ip_rules_applies_to_1', 'Nigeria'),
  ('Lagos Agro-Allied Co', 'ip_rules_cidr_2', 'basic', 'ip_rules_applies_to_2', 'Nigeria'),
  ('Danladi Garba', 'ip_rules_cidr_3', 'basic', 'ip_rules_applies_to_3', 'Nigeria');

-- Table: siem_pipelines (10 columns, inserting 6)
INSERT INTO "siem_pipelines" ("name", "format", "destination", "avg_latency_ms", "error_rate", "batch_size") VALUES
  ('Yetunde Olowe', 'siem_pipelines_format_1', 'siem_pipelines_destination_1', 24.6777, 3.2313, 377),
  ('Oando Energy', 'siem_pipelines_format_2', 'siem_pipelines_destination_2', 93.2944, 11.2332, 92),
  ('Danladi Garba', 'siem_pipelines_format_3', 'siem_pipelines_destination_3', 78.768, 18.5327, 371);

-- Table: cbn_compliance_checks (12 columns, inserting 6)
INSERT INTO "cbn_compliance_checks" ("circular", "title", "category", "compliance_score", "last_assessed", "next_assessment") VALUES
  ('cbn_compliance_checks_circular_1', 'cbn_compliance_checks_title_1', 'standard', 24.3952, '2025-10-16 00:00:00'::timestamp, '2026-01-22 00:00:00'::timestamp),
  ('cbn_compliance_checks_circular_2', 'cbn_compliance_checks_title_2', 'standard', 5.4897, '2026-04-15 00:00:00'::timestamp, '2026-04-19 00:00:00'::timestamp),
  ('cbn_compliance_checks_circular_3', 'cbn_compliance_checks_title_3', 'basic', 16.5127, '2025-07-15 00:00:00'::timestamp, '2025-05-14 00:00:00'::timestamp);

-- Table: egress_policies (10 columns, inserting 4)
INSERT INTO "egress_policies" ("name", "domains", "ports", "protocol") VALUES
  ('Amina Yusuf', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'egress_policies_protocol_1'),
  ('Emeka & Sons Trading', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'egress_policies_protocol_2'),
  ('Godwin Etim', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'egress_policies_protocol_3');

-- Table: incidents (14 columns, inserting 10)
INSERT INTO "incidents" ("title", "severity", "category", "affected_systems", "containment_actions", "assignee", "detected_at", "contained_at", "ttd_minutes", "ttc_minutes") VALUES
  ('incidents_title_1', 'incidents_severity_1', 'basic', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'incidents_assignee_1', '2026-05-05 00:00:00'::timestamp, '2025-10-15 00:00:00'::timestamp, 85, 69),
  ('incidents_title_2', 'incidents_severity_2', 'premium', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'incidents_assignee_2', '2025-09-04 00:00:00'::timestamp, '2026-03-16 00:00:00'::timestamp, 4, 98),
  ('incidents_title_3', 'incidents_severity_3', 'basic', '{"key": "value"}'::jsonb, '{"key": "value"}'::jsonb, 'incidents_assignee_3', '2025-11-20 00:00:00'::timestamp, '2026-04-05 00:00:00'::timestamp, 42, 66);

-- Table: immutable_audit_blocks (11 columns, inserting 6)
INSERT INTO "immutable_audit_blocks" ("block_number", "previous_hash", "merkle_root", "validator", "anchored_to_chain", "anchor_tx_hash") VALUES
  (35070682698, 'immutable_audit_blocks_previous_hash_1', 'immutable_audit_blocks_merkle_root_1', 'immutabl_validator_1', 'immutable_audit_blocks_anchored_to_chain_1', 'immutable_audit_blocks_anchor_tx_hash_1'),
  (25531809691, 'immutable_audit_blocks_previous_hash_2', 'immutable_audit_blocks_merkle_root_2', 'immutabl_validator_2', 'immutable_audit_blocks_anchored_to_chain_2', 'immutable_audit_blocks_anchor_tx_hash_2'),
  (28362485180, 'immutable_audit_blocks_previous_hash_3', 'immutable_audit_blocks_merkle_root_3', 'immutabl_validator_3', 'immutable_audit_blocks_anchored_to_chain_3', 'immutable_audit_blocks_anchor_tx_hash_3');

-- Table: soc2_evidence (11 columns, inserting 8)
INSERT INTO "soc2_evidence" ("control_id", "category", "title", "evidence_type", "result", "period", "artifacts", "auditor") VALUES
  ('soc2_evi_control_id_1', 'basic', 'soc2_evidence_title_1', 'premium', 'soc2_evidence_result_1', 'soc2_evidence_period_1', '{"key": "value"}'::jsonb, 'soc2_evidence_auditor_1'),
  ('soc2_evi_control_id_2', 'basic', 'soc2_evidence_title_2', 'premium', 'soc2_evidence_result_2', 'soc2_evidence_period_2', '{"key": "value"}'::jsonb, 'soc2_evidence_auditor_2'),
  ('soc2_evi_control_id_3', 'standard', 'soc2_evidence_title_3', 'basic', 'soc2_evidence_result_3', 'soc2_evidence_period_3', '{"key": "value"}'::jsonb, 'soc2_evidence_auditor_3');

-- Table: pentest_scans (14 columns, inserting 5)
INSERT INTO "pentest_scans" ("name", "scope", "scan_type", "target", "vendor") VALUES
  ('Oluwaseun Ajayi', 'pentest_scans_scope_1', 'standard', 'pentest_scans_target_1', 'pentest_scans_vendor_1'),
  ('Oando Energy', 'pentest_scans_scope_2', 'standard', 'pentest_scans_target_2', 'pentest_scans_vendor_2'),
  ('Rashida Bello', 'pentest_scans_scope_3', 'standard', 'pentest_scans_target_3', 'pentest_scans_vendor_3');

-- Table: sri_hashes (9 columns, inserting 5)
INSERT INTO "sri_hashes" ("resource", "algorithm", "hash", "last_verified", "cdn_provider") VALUES
  ('sri_hashes_resource_1', 'sri_hashes_algorithm_1', 'sri_hashes_hash_1', '2025-05-22 00:00:00'::timestamp, 'sri_hash_cdn_provider_1'),
  ('sri_hashes_resource_2', 'sri_hashes_algorithm_2', 'sri_hashes_hash_2', '2025-07-01 00:00:00'::timestamp, 'sri_hash_cdn_provider_2'),
  ('sri_hashes_resource_3', 'sri_hashes_algorithm_3', 'sri_hashes_hash_3', '2025-12-30 00:00:00'::timestamp, 'sri_hash_cdn_provider_3');

-- Table: csp_policies (8 columns, inserting 3)
INSERT INTO "csp_policies" ("domain", "directives", "report_uri") VALUES
  ('csp_policies_domain_1', '{"key": "value"}'::jsonb, 'csp_policies_report_uri_1'),
  ('csp_policies_domain_2', '{"key": "value"}'::jsonb, 'csp_policies_report_uri_2'),
  ('csp_policies_domain_3', '{"key": "value"}'::jsonb, 'csp_policies_report_uri_3');

-- Table: frame_policies (9 columns, inserting 4)
INSERT INTO "frame_policies" ("domain", "frame_ancestors", "x_frame_options", "frame_detection") VALUES
  ('frame_policies_domain_1', 'frame_policies_frame_ancestors_1', 'frame_policies_x_frame_options_1', 'frame_policies_frame_detection_1'),
  ('frame_policies_domain_2', 'frame_policies_frame_ancestors_2', 'frame_policies_x_frame_options_2', 'frame_policies_frame_detection_2'),
  ('frame_policies_domain_3', 'frame_policies_frame_ancestors_3', 'frame_policies_x_frame_options_3', 'frame_policies_frame_detection_3');

-- Table: device_profiles (12 columns, inserting 7)
INSERT INTO "device_profiles" ("fingerprint_hash", "user_id", "device_type", "browser", "os", "screen_res", "timezone") VALUES
  ('device_profiles_fingerprint_hash_1', 'device_p_user_id_1', 'standard', 'device_profiles_browser_1', 'device_profiles_os_1', 'device_profiles_screen_res_1', 'device_profiles_timezone_1'),
  ('device_profiles_fingerprint_hash_2', 'device_p_user_id_2', 'premium', 'device_profiles_browser_2', 'device_profiles_os_2', 'device_profiles_screen_res_2', 'device_profiles_timezone_2'),
  ('device_profiles_fingerprint_hash_3', 'device_p_user_id_3', 'standard', 'device_profiles_browser_3', 'device_profiles_os_3', 'device_profiles_screen_res_3', 'device_profiles_timezone_3');

-- Table: redis_cache_entries (10 columns, inserting 2)
INSERT INTO "redis_cache_entries" ("route", "hitRate") VALUES
  ('redis_cache_entries_route_1', 'redis_cache_entries_hitrate_1'),
  ('redis_cache_entries_route_2', 'redis_cache_entries_hitrate_2'),
  ('redis_cache_entries_route_3', 'redis_cache_entries_hitrate_3');

-- Table: redis_sessions (9 columns, inserting 5)
INSERT INTO "redis_sessions" ("sessionId", "userId", "deviceType", "ipAddress", "expiresIn") VALUES
  ('redis_se_sessionid_1', 'redis_se_userid_1', 'standard', '65 Marina Street, Ogun', 'redis_sessions_expiresin_1'),
  ('redis_se_sessionid_2', 'redis_se_userid_2', 'premium', '19 Ahmadu Bello Street, Anambra', 'redis_sessions_expiresin_2'),
  ('redis_se_sessionid_3', 'redis_se_userid_3', 'basic', '100 Broad Street, Kaduna', 'redis_sessions_expiresin_3');

-- Table: cache_invalidations (8 columns, inserting 2)
INSERT INTO "cache_invalidations" ("channel", "pattern") VALUES
  ('cache_invalidations_channel_1', 'cache_invalidations_pattern_1'),
  ('cache_invalidations_channel_2', 'cache_invalidations_pattern_2'),
  ('cache_invalidations_channel_3', 'cache_invalidations_pattern_3');

-- Table: bloom_filters (9 columns, inserting 2)
INSERT INTO "bloom_filters" ("name", "falsePositiveRate") VALUES
  ('Emeka Nwosu', 'bloom_filters_falsepositiverate_1'),
  ('Oando Energy', 'bloom_filters_falsepositiverate_2'),
  ('Folake Adeniyi', 'bloom_filters_falsepositiverate_3');

-- Table: sorted_set_rankings (8 columns, inserting 2)
INSERT INTO "sorted_set_rankings" ("name", "updateFrequency") VALUES
  ('Aisha Mohammed', 'sorted_set_rankings_updatefrequency_1'),
  ('Oando Energy', 'sorted_set_rankings_updatefrequency_2'),
  ('Folake Adeniyi', 'sorted_set_rankings_updatefrequency_3');

-- Table: pgbouncer_pools (9 columns, inserting 2)
INSERT INTO "pgbouncer_pools" ("database", "poolMode") VALUES
  ('pgbouncer_pools_database_1', 'pgbouncer_pools_poolmode_1'),
  ('pgbouncer_pools_database_2', 'pgbouncer_pools_poolmode_2'),
  ('pgbouncer_pools_database_3', 'pgbouncer_pools_poolmode_3');

-- Table: query_cache_entries (9 columns, inserting 3)
INSERT INTO "query_cache_entries" ("queryHash", "tableName", "hitRate") VALUES
  ('query_cache_entries_queryhash_1', 'query_cache_entries_tablename_1', 'query_cache_entries_hitrate_1'),
  ('query_cache_entries_queryhash_2', 'query_cache_entries_tablename_2', 'query_cache_entries_hitrate_2'),
  ('query_cache_entries_queryhash_3', 'query_cache_entries_tablename_3', 'query_cache_entries_hitrate_3');

-- Table: prepared_statements (8 columns, inserting 3)
INSERT INTO "prepared_statements" ("queryPattern", "planCacheHits", "paramTypes") VALUES
  ('prepared_statements_querypattern_1', 'prepared_statements_plancachehits_1', 'basic'),
  ('prepared_statements_querypattern_2', 'prepared_statements_plancachehits_2', 'standard'),
  ('prepared_statements_querypattern_3', 'prepared_statements_plancachehits_3', 'standard');

-- Table: table_partitions (8 columns, inserting 4)
INSERT INTO "table_partitions" ("tableName", "partitionKey", "partitionType", "rowsPerPartition") VALUES
  ('table_partitions_tablename_1', 'table_pa_partitionkey_1', 'premium', 'table_partitions_rowsperpartition_1'),
  ('table_partitions_tablename_2', 'table_pa_partitionkey_2', 'premium', 'table_partitions_rowsperpartition_2'),
  ('table_partitions_tablename_3', 'table_pa_partitionkey_3', 'standard', 'table_partitions_rowsperpartition_3');

-- Table: materialized_views_perf (8 columns, inserting 1)
INSERT INTO "materialized_views_perf" ("viewName") VALUES
  ('materialized_views_perf_viewname_1'),
  ('materialized_views_perf_viewname_2'),
  ('materialized_views_perf_viewname_3');

-- Table: hot_data_caches (9 columns, inserting 3)
INSERT INTO "hot_data_caches" ("service", "cacheType", "hitRate") VALUES
  ('hot_data_caches_service_1', 'standard', 'hot_data_caches_hitrate_1'),
  ('hot_data_caches_service_2', 'premium', 'hot_data_caches_hitrate_2'),
  ('hot_data_caches_service_3', 'basic', 'hot_data_caches_hitrate_3');

-- Table: batch_aggregator_configs (8 columns, inserting 1)
INSERT INTO "batch_aggregator_configs" ("endpoint") VALUES
  ('batch_aggregator_configs_endpoint_1'),
  ('batch_aggregator_configs_endpoint_2'),
  ('batch_aggregator_configs_endpoint_3');

-- Table: keepalive_configs (8 columns, inserting 2)
INSERT INTO "keepalive_configs" ("service", "reuseRate") VALUES
  ('keepalive_configs_service_1', 'keepalive_configs_reuserate_1'),
  ('keepalive_configs_service_2', 'keepalive_configs_reuserate_2'),
  ('keepalive_configs_service_3', 'keepalive_configs_reuserate_3');

-- Table: compression_configs (8 columns, inserting 3)
INSERT INTO "compression_configs" ("algorithm", "compressionRatio", "bandwidthSaved24h") VALUES
  ('compression_configs_algorithm_1', 'compression_configs_compressionratio_1', 'compress_bandwidthsaved24h_1'),
  ('compression_configs_algorithm_2', 'compression_configs_compressionratio_2', 'compress_bandwidthsaved24h_2'),
  ('compression_configs_algorithm_3', 'compression_configs_compressionratio_3', 'compress_bandwidthsaved24h_3');

-- Table: grpc_services (8 columns, inserting 3)
INSERT INTO "grpc_services" ("service", "proto", "compressionRatio") VALUES
  ('grpc_services_service_1', 'grpc_services_proto_1', 'grpc_services_compressionratio_1'),
  ('grpc_services_service_2', 'grpc_services_proto_2', 'grpc_services_compressionratio_2'),
  ('grpc_services_service_3', 'grpc_services_proto_3', 'grpc_services_compressionratio_3');

-- Table: route_trie_stats (8 columns, inserting 2)
INSERT INTO "route_trie_stats" ("routePrefix", "cacheHitRate") VALUES
  ('54B-ROUT-517531', 'route_trie_stats_cachehitrate_1'),
  ('54B-ROUT-913269', 'route_trie_stats_cachehitrate_2'),
  ('54B-ROUT-146458', 'route_trie_stats_cachehitrate_3');

-- Table: stream_response_configs (8 columns, inserting 3)
INSERT INTO "stream_response_configs" ("endpoint", "bytesStreamed24h", "memoryReductionPct") VALUES
  ('stream_response_configs_endpoint_1', 'stream_response_configs_bytesstreamed24h_1', 'stream_response_configs_memoryreductionpct_1'),
  ('stream_response_configs_endpoint_2', 'stream_response_configs_bytesstreamed24h_2', 'stream_response_configs_memoryreductionpct_2'),
  ('stream_response_configs_endpoint_3', 'stream_response_configs_bytesstreamed24h_3', 'stream_response_configs_memoryreductionpct_3');

-- Table: http2_connections (8 columns, inserting 2)
INSERT INTO "http2_connections" ("clientIp", "windowSize") VALUES
  ('http2_connections_clientip_1', 'http2_connections_windowsize_1'),
  ('http2_connections_clientip_2', 'http2_connections_windowsize_2'),
  ('http2_connections_clientip_3', 'http2_connections_windowsize_3');

-- Table: coalescing_rules (8 columns, inserting 2)
INSERT INTO "coalescing_rules" ("route", "savingsRatio") VALUES
  ('coalescing_rules_route_1', 'coalescing_rules_savingsratio_1'),
  ('coalescing_rules_route_2', 'coalescing_rules_savingsratio_2'),
  ('coalescing_rules_route_3', 'coalescing_rules_savingsratio_3');

-- Table: fast_json_schemas (8 columns, inserting 2)
INSERT INTO "fast_json_schemas" ("schemaName", "speedup") VALUES
  ('fast_json_schemas_schemaname_1', 'fast_json_schemas_speedup_1'),
  ('fast_json_schemas_schemaname_2', 'fast_json_schemas_speedup_2'),
  ('fast_json_schemas_schemaname_3', 'fast_json_schemas_speedup_3');

-- Table: sw_cache_strategies (8 columns, inserting 3)
INSERT INTO "sw_cache_strategies" ("pattern", "strategy", "cacheHitRate") VALUES
  ('sw_cache_strategies_pattern_1', 'sw_cache_strategies_strategy_1', 'sw_cache_strategies_cachehitrate_1'),
  ('sw_cache_strategies_pattern_2', 'sw_cache_strategies_strategy_2', 'sw_cache_strategies_cachehitrate_2'),
  ('sw_cache_strategies_pattern_3', 'sw_cache_strategies_strategy_3', 'sw_cache_strategies_cachehitrate_3');

-- Table: virtual_scroll_configs (8 columns, inserting 1)
INSERT INTO "virtual_scroll_configs" ("tableName") VALUES
  ('virtual_scroll_configs_tablename_1'),
  ('virtual_scroll_configs_tablename_2'),
  ('virtual_scroll_configs_tablename_3');

-- Table: memoization_targets (7 columns, inserting 3)
INSERT INTO "memoization_targets" ("component", "estimatedSavingPct", "recommendation") VALUES
  ('memoization_targets_component_1', 'memoization_targets_estimatedsavingpct_1', 'memoization_targets_recommendation_1'),
  ('memoization_targets_component_2', 'memoization_targets_estimatedsavingpct_2', 'memoization_targets_recommendation_2'),
  ('memoization_targets_component_3', 'memoization_targets_estimatedsavingpct_3', 'memoization_targets_recommendation_3');

-- Table: bundle_split_configs (8 columns, inserting 2)
INSERT INTO "bundle_split_configs" ("chunk", "preloadHint") VALUES
  ('bundle_split_configs_chunk_1', 'bundle_split_configs_preloadhint_1'),
  ('bundle_split_configs_chunk_2', 'bundle_split_configs_preloadhint_2'),
  ('bundle_split_configs_chunk_3', 'bundle_split_configs_preloadhint_3');

-- Table: optimistic_ui_configs (8 columns, inserting 3)
INSERT INTO "optimistic_ui_configs" ("action", "endpoint", "successRate") VALUES
  ('optimistic_ui_configs_action_1', 'optimistic_ui_configs_endpoint_1', 'optimistic_ui_configs_successrate_1'),
  ('optimistic_ui_configs_action_2', 'optimistic_ui_configs_endpoint_2', 'optimistic_ui_configs_successrate_2'),
  ('optimistic_ui_configs_action_3', 'optimistic_ui_configs_endpoint_3', 'optimistic_ui_configs_successrate_3');

-- Table: kafka_consumer_groups (9 columns, inserting 2)
INSERT INTO "kafka_consumer_groups" ("groupId", "topic") VALUES
  ('kafka_co_groupid_1', 'kafka_consumer_groups_topic_1'),
  ('kafka_co_groupid_2', 'kafka_consumer_groups_topic_2'),
  ('kafka_co_groupid_3', 'kafka_consumer_groups_topic_3');

-- Table: kafka_batch_producers (8 columns, inserting 2)
INSERT INTO "kafka_batch_producers" ("topic", "compressionType") VALUES
  ('kafka_batch_producers_topic_1', 'standard'),
  ('kafka_batch_producers_topic_2', 'basic'),
  ('kafka_batch_producers_topic_3', 'premium');

-- Table: avro_schemas (8 columns, inserting 3)
INSERT INTO "avro_schemas" ("subject", "compatibilityMode", "compressionRatio") VALUES
  ('avro_schemas_subject_1', 'avro_schemas_compatibilitymode_1', 'avro_schemas_compressionratio_1'),
  ('avro_schemas_subject_2', 'avro_schemas_compatibilitymode_2', 'avro_schemas_compressionratio_2'),
  ('avro_schemas_subject_3', 'avro_schemas_compatibilitymode_3', 'avro_schemas_compressionratio_3');

-- Table: fluvio_smart_modules (8 columns, inserting 2)
INSERT INTO "fluvio_smart_modules" ("name", "moduleType") VALUES
  ('Fatima Hassan', 'premium'),
  ('Kano Textiles Ltd', 'basic'),
  ('Ngozi Okafor', 'standard');

-- Table: event_dedup_configs (8 columns, inserting 2)
INSERT INTO "event_dedup_configs" ("topic", "strategy") VALUES
  ('event_dedup_configs_topic_1', 'event_dedup_configs_strategy_1'),
  ('event_dedup_configs_topic_2', 'event_dedup_configs_strategy_2'),
  ('event_dedup_configs_topic_3', 'event_dedup_configs_strategy_3');

-- Table: distroless_images (8 columns, inserting 3)
INSERT INTO "distroless_images" ("service", "baseImage", "reductionPct") VALUES
  ('distroless_images_service_1', 'distroless_images_baseimage_1', 'distroless_images_reductionpct_1'),
  ('distroless_images_service_2', 'distroless_images_baseimage_2', 'distroless_images_reductionpct_2'),
  ('distroless_images_service_3', 'distroless_images_baseimage_3', 'distroless_images_reductionpct_3');

-- Skipping tb_batch_configs: all columns have defaults
-- Table: hpa_configs (9 columns, inserting 2)
INSERT INTO "hpa_configs" ("deployment", "customMetric") VALUES
  ('hpa_configs_deployment_1', 'hpa_configs_custommetric_1'),
  ('hpa_configs_deployment_2', 'hpa_configs_custommetric_2'),
  ('hpa_configs_deployment_3', 'hpa_configs_custommetric_3');

-- Table: cdn_edge_configs (9 columns, inserting 3)
INSERT INTO "cdn_edge_configs" ("provider", "origin", "bandwidthSaved24h") VALUES
  ('cdn_edge_provider_1', 'cdn_edge_configs_origin_1', 'cdn_edge_bandwidthsaved24h_1'),
  ('cdn_edge_provider_2', 'cdn_edge_configs_origin_2', 'cdn_edge_bandwidthsaved24h_2'),
  ('cdn_edge_provider_3', 'cdn_edge_configs_origin_3', 'cdn_edge_bandwidthsaved24h_3');

-- Table: read_replica_configs (7 columns, inserting 1)
INSERT INTO "read_replica_configs" ("replicaHost") VALUES
  ('read_replica_configs_replicahost_1'),
  ('read_replica_configs_replicahost_2'),
  ('read_replica_configs_replicahost_3');

-- Table: keda_scale_triggers (8 columns, inserting 3)
INSERT INTO "keda_scale_triggers" ("scaleObject", "trigger", "metric") VALUES
  ('keda_scale_triggers_scaleobject_1', 'keda_scale_triggers_trigger_1', 'keda_scale_triggers_metric_1'),
  ('keda_scale_triggers_scaleobject_2', 'keda_scale_triggers_trigger_2', 'keda_scale_triggers_metric_2'),
  ('keda_scale_triggers_scaleobject_3', 'keda_scale_triggers_trigger_3', 'keda_scale_triggers_metric_3');

-- Table: prometheus_dashboards (8 columns, inserting 3)
INSERT INTO "prometheus_dashboards" ("dashboard", "refreshInterval", "dataSourceRetention") VALUES
  ('prometheus_dashboards_dashboard_1', '54B-PROM-176752', 'prometheus_dashboards_datasourceretention_1'),
  ('prometheus_dashboards_dashboard_2', '54B-PROM-623530', 'prometheus_dashboards_datasourceretention_2'),
  ('prometheus_dashboards_dashboard_3', '54B-PROM-516553', 'prometheus_dashboards_datasourceretention_3');

-- Table: opensearch_index_configs (8 columns, inserting 1)
INSERT INTO "opensearch_index_configs" ("indexName") VALUES
  ('opensearch_index_configs_indexname_1'),
  ('opensearch_index_configs_indexname_2'),
  ('opensearch_index_configs_indexname_3');

-- Table: temporal_memoized_activities (8 columns, inserting 5)
INSERT INTO "temporal_memoized_activities" ("workflow", "activity", "replaySpeedup", "cacheTTL", "cacheHitRate") VALUES
  ('temporal_memoized_activities_workflow_1', 'temporal_memoized_activities_activity_1', 'temporal_memoized_activities_replayspeedup_1', 'temporal_memoized_activities_cachettl_1', 'temporal_memoized_activities_cachehitrate_1'),
  ('temporal_memoized_activities_workflow_2', 'temporal_memoized_activities_activity_2', 'temporal_memoized_activities_replayspeedup_2', 'temporal_memoized_activities_cachettl_2', 'temporal_memoized_activities_cachehitrate_2'),
  ('temporal_memoized_activities_workflow_3', 'temporal_memoized_activities_activity_3', 'temporal_memoized_activities_replayspeedup_3', 'temporal_memoized_activities_cachettl_3', 'temporal_memoized_activities_cachehitrate_3');

-- Table: apisix_plugin_chains (6 columns, inserting 2)
INSERT INTO "apisix_plugin_chains" ("route", "latencySaving") VALUES
  ('apisix_plugin_chains_route_1', 'apisix_plugin_chains_latencysaving_1'),
  ('apisix_plugin_chains_route_2', 'apisix_plugin_chains_latencysaving_2'),
  ('apisix_plugin_chains_route_3', 'apisix_plugin_chains_latencysaving_3');

-- Table: aml_risk_scores (11 columns, inserting 4)
INSERT INTO "aml_risk_scores" ("customerId", "customerName", "riskLevel", "cddLevel") VALUES
  ('aml_risk_customerid_1', 'aml_risk_scores_customername_1', 'aml_risk_scores_risklevel_1', 'aml_risk_scores_cddlevel_1'),
  ('aml_risk_customerid_2', 'aml_risk_scores_customername_2', 'aml_risk_scores_risklevel_2', 'aml_risk_scores_cddlevel_2'),
  ('aml_risk_customerid_3', 'aml_risk_scores_customername_3', 'aml_risk_scores_risklevel_3', 'aml_risk_scores_cddlevel_3');

-- Table: sar_reports_aml (11 columns, inserting 7)
INSERT INTO "sar_reports_aml" ("customerId", "customerName", "reportType", "reason", "currency", "nfiuReference", "priority") VALUES
  ('sar_repo_customerid_1', 'sar_reports_aml_customername_1', 'basic', '54Bank sar_reports_aml record 1', 'EUR', '54B-SAR_-748161', 'sar_reports_aml_priority_1'),
  ('sar_repo_customerid_2', 'sar_reports_aml_customername_2', 'basic', '54Bank sar_reports_aml record 2', 'NGN', '54B-SAR_-249071', 'sar_reports_aml_priority_2'),
  ('sar_repo_customerid_3', 'sar_reports_aml_customername_3', 'basic', '54Bank sar_reports_aml record 3', 'EUR', '54B-SAR_-987797', 'sar_reports_aml_priority_3');

-- Table: ctr_reports_aml (11 columns, inserting 6)
INSERT INTO "ctr_reports_aml" ("customerId", "customerName", "transactionId", "currency", "transactionType", "nfiuReference") VALUES
  ('ctr_repo_customerid_1', 'ctr_reports_aml_customername_1', 'ctr_repo_transactionid_1', 'GBP', 'standard', '54B-CTR_-365598'),
  ('ctr_repo_customerid_2', 'ctr_reports_aml_customername_2', 'ctr_repo_transactionid_2', 'NGN', 'premium', '54B-CTR_-207801'),
  ('ctr_repo_customerid_3', 'ctr_reports_aml_customername_3', 'ctr_repo_transactionid_3', 'GBP', 'basic', '54B-CTR_-771257');

-- Table: aml_cases (9 columns, inserting 5)
INSERT INTO "aml_cases" ("customerId", "customerName", "caseType", "riskLevel", "assignedTo") VALUES
  ('aml_case_customerid_1', 'aml_cases_customername_1', 'basic', 'aml_cases_risklevel_1', 'aml_cases_assignedto_1'),
  ('aml_case_customerid_2', 'aml_cases_customername_2', 'premium', 'aml_cases_risklevel_2', 'aml_cases_assignedto_2'),
  ('aml_case_customerid_3', 'aml_cases_customername_3', 'premium', 'aml_cases_risklevel_3', 'aml_cases_assignedto_3');

-- Table: watchlist_sources (10 columns, inserting 5)
INSERT INTO "watchlist_sources" ("name", "source", "url", "format", "syncFrequency") VALUES
  ('Chidi Obi', 'watchlist_sources_source_1', 'https://api.54bank.ng/v1/watchlist_sources/1', 'watchlist_sources_format_1', 'watchlist_sources_syncfrequency_1'),
  ('Abuja Properties Ltd', 'watchlist_sources_source_2', 'https://api.54bank.ng/v1/watchlist_sources/2', 'watchlist_sources_format_2', 'watchlist_sources_syncfrequency_2'),
  ('Godwin Etim', 'watchlist_sources_source_3', 'https://api.54bank.ng/v1/watchlist_sources/3', 'watchlist_sources_format_3', 'watchlist_sources_syncfrequency_3');

-- Table: adverse_media_scans (8 columns, inserting 4)
INSERT INTO "adverse_media_scans" ("customerId", "customerName", "sentiment", "riskImpact") VALUES
  ('adverse__customerid_1', 'adverse_media_scans_customername_1', 'adverse_media_scans_sentiment_1', 'adverse_media_scans_riskimpact_1'),
  ('adverse__customerid_2', 'adverse_media_scans_customername_2', 'adverse_media_scans_sentiment_2', 'adverse_media_scans_riskimpact_2'),
  ('adverse__customerid_3', 'adverse_media_scans_customername_3', 'adverse_media_scans_sentiment_3', 'adverse_media_scans_riskimpact_3');

-- Table: beneficial_owners (8 columns, inserting 4)
INSERT INTO "beneficial_owners" ("entityId", "entityName", "entityType", "rcNumber") VALUES
  ('benefici_entityid_1', 'beneficial_owners_entityname_1', 'standard', 'benefici_rcnumber_1'),
  ('benefici_entityid_2', 'beneficial_owners_entityname_2', 'standard', 'benefici_rcnumber_2'),
  ('benefici_entityid_3', 'beneficial_owners_entityname_3', 'standard', 'benefici_rcnumber_3');

-- Table: txn_pattern_analyses (8 columns, inserting 4)
INSERT INTO "txn_pattern_analyses" ("customerId", "customerName", "baselineDeviation", "recommendation") VALUES
  ('txn_patt_customerid_1', 'txn_pattern_analyses_customername_1', 'txn_pattern_analyses_baselinedeviation_1', 'txn_pattern_analyses_recommendation_1'),
  ('txn_patt_customerid_2', 'txn_pattern_analyses_customername_2', 'txn_pattern_analyses_baselinedeviation_2', 'txn_pattern_analyses_recommendation_2'),
  ('txn_patt_customerid_3', 'txn_pattern_analyses_customername_3', 'txn_pattern_analyses_baselinedeviation_3', 'txn_pattern_analyses_recommendation_3');

-- Table: goaml_reports (8 columns, inserting 3)
INSERT INTO "goaml_reports" ("reportType", "subject", "nfiuAcknowledgement") VALUES
  ('standard', 'goaml_reports_subject_1', 'goaml_reports_nfiuacknowledgement_1'),
  ('basic', 'goaml_reports_subject_2', 'goaml_reports_nfiuacknowledgement_2'),
  ('premium', 'goaml_reports_subject_3', 'goaml_reports_nfiuacknowledgement_3');

-- Table: aml_compliance_metrics (8 columns, inserting 1)
INSERT INTO "aml_compliance_metrics" ("period") VALUES
  ('aml_compliance_metrics_period_1'),
  ('aml_compliance_metrics_period_2'),
  ('aml_compliance_metrics_period_3');

-- Table: sanctions_batch_runs (7 columns, inserting 1)
INSERT INTO "sanctions_batch_runs" ("triggerType") VALUES
  ('basic'),
  ('basic'),
  ('basic');

-- Table: aml_training_records (8 columns, inserting 4)
INSERT INTO "aml_training_records" ("staffId", "staffName", "role", "trainingModule") VALUES
  ('aml_trai_staffid_1', 'aml_training_records_staffname_1', 'user', 'aml_training_records_trainingmodule_1'),
  ('aml_trai_staffid_2', 'aml_training_records_staffname_2', 'user', 'aml_training_records_trainingmodule_2'),
  ('aml_trai_staffid_3', 'aml_training_records_staffname_3', 'branch_manager', 'aml_training_records_trainingmodule_3');

-- Table: wire_transfer_monitor (8 columns, inserting 3)
INSERT INTO "wire_transfer_monitor" ("originatorName", "beneficiaryName", "currency") VALUES
  ('wire_transfer_monitor_originatorname_1', 'wire_transfer_monitor_beneficiaryname_1', 'USD'),
  ('wire_transfer_monitor_originatorname_2', 'wire_transfer_monitor_beneficiaryname_2', 'GBP'),
  ('wire_transfer_monitor_originatorname_3', 'wire_transfer_monitor_beneficiaryname_3', 'NGN');

-- Table: regulatory_reports_aml (7 columns, inserting 4)
INSERT INTO "regulatory_reports_aml" ("reportType", "period", "submittedTo", "filedDate") VALUES
  ('basic', 'regulatory_reports_aml_period_1', 'regulatory_reports_aml_submittedto_1', 'regulatory_reports_aml_fileddate_1'),
  ('standard', 'regulatory_reports_aml_period_2', 'regulatory_reports_aml_submittedto_2', 'regulatory_reports_aml_fileddate_2'),
  ('premium', 'regulatory_reports_aml_period_3', 'regulatory_reports_aml_submittedto_3', 'regulatory_reports_aml_fileddate_3');

-- Table: typology_matches (8 columns, inserting 3)
INSERT INTO "typology_matches" ("typologyCode", "typologyName", "riskLevel") VALUES
  ('typology_typologycode_1', 'typology_matches_typologyname_1', 'typology_matches_risklevel_1'),
  ('typology_typologycode_2', 'typology_matches_typologyname_2', 'typology_matches_risklevel_2'),
  ('typology_typologycode_3', 'typology_matches_typologyname_3', 'typology_matches_risklevel_3');

-- Table: cooperative_management (13 columns, inserting 9)
INSERT INTO "cooperative_management" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'cooperat_record_id_1', 'Kemi Adeyemi', 'basic', '54Bank cooperative_management record 1', 'approved', 'Nigeria', '54B-COOP-494590', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'cooperat_record_id_2', 'Abuja Properties Ltd', 'standard', '54Bank cooperative_management record 2', 'pending', 'Nigeria', '54B-COOP-733709', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'cooperat_record_id_3', 'Obinna Chukwu', 'premium', '54Bank cooperative_management record 3', 'approved', 'Nigeria', '54B-COOP-461156', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: livestock_management (13 columns, inserting 9)
INSERT INTO "livestock_management" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'livestoc_record_id_1', 'Uchenna Ikenna', 'standard', '54Bank livestock_management record 1', 'pending', 'Nigeria', '54B-LIVE-935771', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'livestoc_record_id_2', 'Oando Energy', 'standard', '54Bank livestock_management record 2', 'pending', 'Nigeria', '54B-LIVE-697130', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'livestoc_record_id_3', 'Rashida Bello', 'premium', '54Bank livestock_management record 3', 'approved', 'Nigeria', '54B-LIVE-965853', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_input_marketplace (13 columns, inserting 9)
INSERT INTO "agri_input_marketplace" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'agri_inp_record_id_1', 'Folake Adeniyi', 'basic', '54Bank agri_input_marketplace record 1', 'approved', 'Nigeria', '54B-AGRI-750876', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'agri_inp_record_id_2', 'Kano Textiles Ltd', 'premium', '54Bank agri_input_marketplace record 2', 'active', 'Nigeria', '54B-AGRI-626037', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'agri_inp_record_id_3', 'Rashida Bello', 'standard', '54Bank agri_input_marketplace record 3', 'active', 'Nigeria', '54B-AGRI-720931', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: nirsal_credit_guarantee (13 columns, inserting 9)
INSERT INTO "nirsal_credit_guarantee" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'nirsal_c_record_id_1', 'Chidi Obi', 'basic', '54Bank nirsal_credit_guarantee record 1', 'rejected', 'Nigeria', '54B-NIRS-432596', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'nirsal_c_record_id_2', 'Emeka & Sons Trading', 'standard', '54Bank nirsal_credit_guarantee record 2', 'completed', 'Nigeria', '54B-NIRS-896406', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'nirsal_c_record_id_3', 'Fatima Hassan', 'premium', '54Bank nirsal_credit_guarantee record 3', 'rejected', 'Nigeria', '54B-NIRS-446614', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: cbn_anchor_borrowers (13 columns, inserting 9)
INSERT INTO "cbn_anchor_borrowers" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'cbn_anch_record_id_1', 'Rashida Bello', 'basic', '54Bank cbn_anchor_borrowers record 1', 'approved', 'Nigeria', '54B-CBN_-258642', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'cbn_anch_record_id_2', 'Emeka & Sons Trading', 'basic', '54Bank cbn_anchor_borrowers record 2', 'pending', 'Nigeria', '54B-CBN_-602997', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'cbn_anch_record_id_3', 'Oluwaseun Ajayi', 'standard', '54Bank cbn_anchor_borrowers record 3', 'pending', 'Nigeria', '54B-CBN_-794588', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: interactive_ussd_agri (13 columns, inserting 9)
INSERT INTO "interactive_ussd_agri" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'interact_record_id_1', 'Rashida Bello', 'premium', '54Bank interactive_ussd_agri record 1', 'inactive', 'Nigeria', '54B-INTE-528327', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'interact_record_id_2', 'Oando Energy', 'premium', '54Bank interactive_ussd_agri record 2', 'active', 'Nigeria', '54B-INTE-844937', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'interact_record_id_3', 'Adewale Ogundimu', 'standard', '54Bank interactive_ussd_agri record 3', 'approved', 'Nigeria', '54B-INTE-336816', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_savings_cycles (13 columns, inserting 9)
INSERT INTO "agri_savings_cycles" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'agri_sav_record_id_1', 'Adewale Ogundimu', 'basic', '54Bank agri_savings_cycles record 1', 'approved', 'Nigeria', '54B-AGRI-255815', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'agri_sav_record_id_2', 'Emeka & Sons Trading', 'standard', '54Bank agri_savings_cycles record 2', 'pending', 'Nigeria', '54B-AGRI-555674', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'agri_sav_record_id_3', 'Rashida Bello', 'standard', '54Bank agri_savings_cycles record 3', 'inactive', 'Nigeria', '54B-AGRI-825948', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: livestock_finance (13 columns, inserting 9)
INSERT INTO "livestock_finance" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'livestoc_record_id_1', 'Danladi Garba', 'standard', '54Bank livestock_finance record 1', 'approved', 'Nigeria', '54B-LIVE-421100', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'livestoc_record_id_2', 'Abuja Properties Ltd', 'premium', '54Bank livestock_finance record 2', 'active', 'Nigeria', '54B-LIVE-752490', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'livestoc_record_id_3', 'Folake Adeniyi', 'premium', '54Bank livestock_finance record 3', 'rejected', 'Nigeria', '54B-LIVE-891350', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: commodity_exchange (13 columns, inserting 9)
INSERT INTO "commodity_exchange" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'commodit_record_id_1', 'Yetunde Olowe', 'basic', '54Bank commodity_exchange record 1', 'inactive', 'Nigeria', '54B-COMM-344905', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'commodit_record_id_2', 'Emeka & Sons Trading', 'basic', '54Bank commodity_exchange record 2', 'active', 'Nigeria', '54B-COMM-679855', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'commodit_record_id_3', 'Uchenna Ikenna', 'basic', '54Bank commodity_exchange record 3', 'active', 'Nigeria', '54B-COMM-232115', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_evoucher (13 columns, inserting 9)
INSERT INTO "agri_evoucher" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'agri_evo_record_id_1', 'Fatima Hassan', 'premium', '54Bank agri_evoucher record 1', 'pending', 'Nigeria', '54B-AGRI-679091', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'agri_evo_record_id_2', 'Abuja Properties Ltd', 'basic', '54Bank agri_evoucher record 2', 'rejected', 'Nigeria', '54B-AGRI-893264', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'agri_evo_record_id_3', 'Godwin Etim', 'basic', '54Bank agri_evoucher record 3', 'rejected', 'Nigeria', '54B-AGRI-767852', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: commodity_price_intelligence (13 columns, inserting 9)
INSERT INTO "commodity_price_intelligence" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'commodit_record_id_1', 'Danladi Garba', 'standard', '54Bank commodity_price_intelligence record 1', 'active', 'Nigeria', '54B-COMM-758739', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'commodit_record_id_2', 'Lagos Agro-Allied Co', 'premium', '54Bank commodity_price_intelligence record 2', 'pending', 'Nigeria', '54B-COMM-344379', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'commodit_record_id_3', 'Yetunde Olowe', 'premium', '54Bank commodity_price_intelligence record 3', 'active', 'Nigeria', '54B-COMM-551608', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: satellite_crop_monitor (13 columns, inserting 9)
INSERT INTO "satellite_crop_monitor" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'satellit_record_id_1', 'Amina Yusuf', 'premium', '54Bank satellite_crop_monitor record 1', 'rejected', 'Nigeria', '54B-SATE-930691', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'satellit_record_id_2', 'Emeka & Sons Trading', 'premium', '54Bank satellite_crop_monitor record 2', 'active', 'Nigeria', '54B-SATE-375462', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'satellit_record_id_3', 'Oluwaseun Ajayi', 'premium', '54Bank satellite_crop_monitor record 3', 'active', 'Nigeria', '54B-SATE-946950', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: cooperative_credit_scoring (13 columns, inserting 9)
INSERT INTO "cooperative_credit_scoring" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'cooperat_record_id_1', 'Rashida Bello', 'basic', '54Bank cooperative_credit_scoring record 1', 'inactive', 'Nigeria', '54B-COOP-897797', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'cooperat_record_id_2', 'Lagos Agro-Allied Co', 'basic', '54Bank cooperative_credit_scoring record 2', 'pending', 'Nigeria', '54B-COOP-370140', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'cooperat_record_id_3', 'Danladi Garba', 'standard', '54Bank cooperative_credit_scoring record 3', 'completed', 'Nigeria', '54B-COOP-719731', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: fisheries_aquaculture (13 columns, inserting 9)
INSERT INTO "fisheries_aquaculture" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'fisherie_record_id_1', 'Tunde Bakare', 'basic', '54Bank fisheries_aquaculture record 1', 'inactive', 'Nigeria', '54B-FISH-210049', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'fisherie_record_id_2', 'Abuja Properties Ltd', 'basic', '54Bank fisheries_aquaculture record 2', 'pending', 'Nigeria', '54B-FISH-660155', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'fisherie_record_id_3', 'Tunde Bakare', 'premium', '54Bank fisheries_aquaculture record 3', 'pending', 'Nigeria', '54B-FISH-212854', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: farm_boundary_mapping (13 columns, inserting 9)
INSERT INTO "farm_boundary_mapping" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'farm_bou_record_id_1', 'Ngozi Okafor', 'premium', '54Bank farm_boundary_mapping record 1', 'active', 'Nigeria', '54B-FARM-500573', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'farm_bou_record_id_2', 'Oando Energy', 'basic', '54Bank farm_boundary_mapping record 2', 'approved', 'Nigeria', '54B-FARM-582137', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'farm_bou_record_id_3', 'Halima Abdullahi', 'standard', '54Bank farm_boundary_mapping record 3', 'active', 'Nigeria', '54B-FARM-203825', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: area_yield_index_insurance (13 columns, inserting 9)
INSERT INTO "area_yield_index_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'area_yie_record_id_1', 'Aisha Mohammed', 'standard', '54Bank area_yield_index_insurance record 1', 'completed', 'Nigeria', '54B-AREA-158208', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'area_yie_record_id_2', 'Dangote Industries Ltd', 'premium', '54Bank area_yield_index_insurance record 2', 'rejected', 'Nigeria', '54B-AREA-213073', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'area_yie_record_id_3', 'Obinna Chukwu', 'premium', '54Bank area_yield_index_insurance record 3', 'completed', 'Nigeria', '54B-AREA-117431', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: warehouse_management (13 columns, inserting 9)
INSERT INTO "warehouse_management" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'warehous_record_id_1', 'Amina Yusuf', 'premium', '54Bank warehouse_management record 1', 'approved', 'Nigeria', '54B-WARE-941530', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'warehous_record_id_2', 'Abuja Properties Ltd', 'premium', '54Bank warehouse_management record 2', 'approved', 'Nigeria', '54B-WARE-623054', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'warehous_record_id_3', 'Ibrahim Musa', 'premium', '54Bank warehouse_management record 3', 'pending', 'Nigeria', '54B-WARE-972724', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agent_farmer_onboarding (13 columns, inserting 9)
INSERT INTO "agent_farmer_onboarding" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'agent_fa_record_id_1', 'Ibrahim Musa', 'premium', '54Bank agent_farmer_onboarding record 1', 'completed', 'Nigeria', '54B-AGEN-364152', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'agent_fa_record_id_2', 'Abuja Properties Ltd', 'basic', '54Bank agent_farmer_onboarding record 2', 'inactive', 'Nigeria', '54B-AGEN-270363', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'agent_fa_record_id_3', 'Ngozi Okafor', 'basic', '54Bank agent_farmer_onboarding record 3', 'approved', 'Nigeria', '54B-AGEN-203544', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: livestock_insurance (13 columns, inserting 9)
INSERT INTO "livestock_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'livestoc_record_id_1', 'Kemi Adeyemi', 'basic', '54Bank livestock_insurance record 1', 'rejected', 'Nigeria', '54B-LIVE-345649', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'livestoc_record_id_2', 'Emeka & Sons Trading', 'premium', '54Bank livestock_insurance record 2', 'completed', 'Nigeria', '54B-LIVE-857467', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'livestoc_record_id_3', 'Adewale Ogundimu', 'basic', '54Bank livestock_insurance record 3', 'approved', 'Nigeria', '54B-LIVE-676088', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: equipment_leasing (13 columns, inserting 9)
INSERT INTO "equipment_leasing" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'equipmen_record_id_1', 'Obinna Chukwu', 'premium', '54Bank equipment_leasing record 1', 'rejected', 'Nigeria', '54B-EQUI-510904', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'equipmen_record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank equipment_leasing record 2', 'active', 'Nigeria', '54B-EQUI-694422', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'equipmen_record_id_3', 'Oluwaseun Ajayi', 'premium', '54Bank equipment_leasing record 3', 'pending', 'Nigeria', '54B-EQUI-445218', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: crop_yield_prediction (13 columns, inserting 9)
INSERT INTO "crop_yield_prediction" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'crop_yie_record_id_1', 'Obinna Chukwu', 'basic', '54Bank crop_yield_prediction record 1', 'approved', 'Nigeria', '54B-CROP-114716', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'crop_yie_record_id_2', 'Kano Textiles Ltd', 'premium', '54Bank crop_yield_prediction record 2', 'inactive', 'Nigeria', '54B-CROP-823214', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'crop_yie_record_id_3', 'Obinna Chukwu', 'basic', '54Bank crop_yield_prediction record 3', 'completed', 'Nigeria', '54B-CROP-942920', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: multi_peril_crop_insurance (13 columns, inserting 9)
INSERT INTO "multi_peril_crop_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'multi_pe_record_id_1', 'Oluwaseun Ajayi', 'premium', '54Bank multi_peril_crop_insurance record 1', 'active', 'Nigeria', '54B-MULT-422884', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'multi_pe_record_id_2', 'Kano Textiles Ltd', 'premium', '54Bank multi_peril_crop_insurance record 2', 'rejected', 'Nigeria', '54B-MULT-766906', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'multi_pe_record_id_3', 'Danladi Garba', 'premium', '54Bank multi_peril_crop_insurance record 3', 'pending', 'Nigeria', '54B-MULT-590304', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_logistics (13 columns, inserting 9)
INSERT INTO "agri_logistics" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'agri_log_record_id_1', 'Ibrahim Musa', 'standard', '54Bank agri_logistics record 1', 'active', 'Nigeria', '54B-AGRI-930351', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'agri_log_record_id_2', 'Oando Energy', 'basic', '54Bank agri_logistics record 2', 'inactive', 'Nigeria', '54B-AGRI-818992', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'agri_log_record_id_3', 'Yetunde Olowe', 'standard', '54Bank agri_logistics record 3', 'completed', 'Nigeria', '54B-AGRI-987877', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: cbn_agri_returns (13 columns, inserting 9)
INSERT INTO "cbn_agri_returns" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'cbn_agri_record_id_1', 'Fatima Hassan', 'standard', '54Bank cbn_agri_returns record 1', 'pending', 'Nigeria', '54B-CBN_-827808', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'cbn_agri_record_id_2', 'Oando Energy', 'premium', '54Bank cbn_agri_returns record 2', 'rejected', 'Nigeria', '54B-CBN_-732223', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'cbn_agri_record_id_3', 'Fatima Hassan', 'standard', '54Bank cbn_agri_returns record 3', 'pending', 'Nigeria', '54B-CBN_-219618', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: animal_id_traceability (13 columns, inserting 9)
INSERT INTO "animal_id_traceability" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'animal_i_record_id_1', 'Fatima Hassan', 'basic', '54Bank animal_id_traceability record 1', 'rejected', 'Nigeria', '54B-ANIM-960530', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'animal_i_record_id_2', 'Dangote Industries Ltd', 'premium', '54Bank animal_id_traceability record 2', 'inactive', 'Nigeria', '54B-ANIM-568972', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'animal_i_record_id_3', 'Adewale Ogundimu', 'basic', '54Bank animal_id_traceability record 3', 'rejected', 'Nigeria', '54B-ANIM-184365', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: nirsal_agro_geocoop (13 columns, inserting 9)
INSERT INTO "nirsal_agro_geocoop" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'nirsal_a_record_id_1', 'Godwin Etim', 'standard', '54Bank nirsal_agro_geocoop record 1', 'completed', 'Nigeria', '54B-NIRS-422776', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'nirsal_a_record_id_2', 'Abuja Properties Ltd', 'premium', '54Bank nirsal_agro_geocoop record 2', 'active', 'Nigeria', '54B-NIRS-739527', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'nirsal_a_record_id_3', 'Oluwaseun Ajayi', 'basic', '54Bank nirsal_agro_geocoop record 3', 'completed', 'Nigeria', '54B-NIRS-806371', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_iot_sensor (13 columns, inserting 9)
INSERT INTO "agri_iot_sensor" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'agri_iot_record_id_1', 'Rashida Bello', 'basic', '54Bank agri_iot_sensor record 1', 'approved', 'Nigeria', '54B-AGRI-169832', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'agri_iot_record_id_2', 'Lagos Agro-Allied Co', 'standard', '54Bank agri_iot_sensor record 2', 'active', 'Nigeria', '54B-AGRI-468578', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'agri_iot_record_id_3', 'Samuel Eze', 'standard', '54Bank agri_iot_sensor record 3', 'approved', 'Nigeria', '54B-AGRI-377248', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_reinsurance (13 columns, inserting 9)
INSERT INTO "agri_reinsurance" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'agri_rei_record_id_1', 'Ngozi Okafor', 'premium', '54Bank agri_reinsurance record 1', 'rejected', 'Nigeria', '54B-AGRI-111911', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'agri_rei_record_id_2', 'Kano Textiles Ltd', 'basic', '54Bank agri_reinsurance record 2', 'pending', 'Nigeria', '54B-AGRI-751167', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'agri_rei_record_id_3', 'Halima Abdullahi', 'basic', '54Bank agri_reinsurance record 3', 'completed', 'Nigeria', '54B-AGRI-690501', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: quality_certification (13 columns, inserting 9)
INSERT INTO "quality_certification" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'quality__record_id_1', 'Ibrahim Musa', 'basic', '54Bank quality_certification record 1', 'pending', 'Nigeria', '54B-QUAL-127842', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'quality__record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank quality_certification record 2', 'approved', 'Nigeria', '54B-QUAL-811245', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'quality__record_id_3', 'Fatima Hassan', 'basic', '54Bank quality_certification record 3', 'completed', 'Nigeria', '54B-QUAL-350108', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: agri_esg_impact (13 columns, inserting 9)
INSERT INTO "agri_esg_impact" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'agri_esg_record_id_1', 'Obinna Chukwu', 'premium', '54Bank agri_esg_impact record 1', 'inactive', 'Nigeria', '54B-AGRI-956088', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'agri_esg_record_id_2', 'Lagos Agro-Allied Co', 'basic', '54Bank agri_esg_impact record 2', 'active', 'Nigeria', '54B-AGRI-861152', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'agri_esg_record_id_3', 'Oluwaseun Ajayi', 'premium', '54Bank agri_esg_impact record 3', 'completed', 'Nigeria', '54B-AGRI-316724', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: crossborder_agri_trade (13 columns, inserting 9)
INSERT INTO "crossborder_agri_trade" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'crossbor_record_id_1', 'Oluwaseun Ajayi', 'standard', '54Bank crossborder_agri_trade record 1', 'approved', 'Nigeria', '54B-CROS-122583', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'crossbor_record_id_2', 'Dangote Industries Ltd', 'premium', '54Bank crossborder_agri_trade record 2', 'completed', 'Nigeria', '54B-CROS-742487', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'crossbor_record_id_3', 'Yetunde Olowe', 'premium', '54Bank crossborder_agri_trade record 3', 'active', 'Nigeria', '54B-CROS-805073', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: cooperative_meetings (13 columns, inserting 9)
INSERT INTO "cooperative_meetings" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'cooperat_record_id_1', 'Ibrahim Musa', 'basic', '54Bank cooperative_meetings record 1', 'pending', 'Nigeria', '54B-COOP-354707', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'cooperat_record_id_2', 'Kano Textiles Ltd', 'basic', '54Bank cooperative_meetings record 2', 'approved', 'Nigeria', '54B-COOP-756704', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'cooperat_record_id_3', 'Amina Yusuf', 'standard', '54Bank cooperative_meetings record 3', 'approved', 'Nigeria', '54B-COOP-383789', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: cooperative_financials (13 columns, inserting 9)
INSERT INTO "cooperative_financials" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'cooperat_record_id_1', 'Tunde Bakare', 'basic', '54Bank cooperative_financials record 1', 'pending', 'Nigeria', '54B-COOP-304483', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'cooperat_record_id_2', 'Oando Energy', 'premium', '54Bank cooperative_financials record 2', 'completed', 'Nigeria', '54B-COOP-134534', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'cooperat_record_id_3', 'Samuel Eze', 'basic', '54Bank cooperative_financials record 3', 'inactive', 'Nigeria', '54B-COOP-951875', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: soil_analysis (13 columns, inserting 9)
INSERT INTO "soil_analysis" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'soil_ana_record_id_1', 'Amina Yusuf', 'standard', '54Bank soil_analysis record 1', 'completed', 'Nigeria', '54B-SOIL-432681', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'soil_ana_record_id_2', 'Oando Energy', 'standard', '54Bank soil_analysis record 2', 'completed', 'Nigeria', '54B-SOIL-767671', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'soil_ana_record_id_3', 'Uchenna Ikenna', 'basic', '54Bank soil_analysis record 3', 'approved', 'Nigeria', '54B-SOIL-597956', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: insurance_portfolio_analytics (13 columns, inserting 9)
INSERT INTO "insurance_portfolio_analytics" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'insuranc_record_id_1', 'Uchenna Ikenna', 'basic', '54Bank insurance_portfolio_analytics record 1', 'approved', 'Nigeria', '54B-INSU-185524', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'insuranc_record_id_2', 'Oando Energy', 'basic', '54Bank insurance_portfolio_analytics record 2', 'inactive', 'Nigeria', '54B-INSU-680704', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'insuranc_record_id_3', 'Amina Yusuf', 'premium', '54Bank insurance_portfolio_analytics record 3', 'inactive', 'Nigeria', '54B-INSU-481173', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: parametric_insurance_iot (13 columns, inserting 9)
INSERT INTO "parametric_insurance_iot" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-ph-south', 'parametr_record_id_1', 'Oluwaseun Ajayi', 'premium', '54Bank parametric_insurance_iot record 1', 'completed', 'Nigeria', '54B-PARA-346537', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'parametr_record_id_2', 'Oando Energy', 'standard', '54Bank parametric_insurance_iot record 2', 'active', 'Nigeria', '54B-PARA-139717', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'parametr_record_id_3', 'Halima Abdullahi', 'basic', '54Bank parametric_insurance_iot record 3', 'approved', 'Nigeria', '54B-PARA-886918', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: post_harvest_loss_tracker (13 columns, inserting 9)
INSERT INTO "post_harvest_loss_tracker" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'post_har_record_id_1', 'Godwin Etim', 'standard', '54Bank post_harvest_loss_tracker record 1', 'inactive', 'Nigeria', '54B-POST-945473', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'post_har_record_id_2', 'Emeka & Sons Trading', 'basic', '54Bank post_harvest_loss_tracker record 2', 'completed', 'Nigeria', '54B-POST-981820', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'post_har_record_id_3', 'Adewale Ogundimu', 'standard', '54Bank post_harvest_loss_tracker record 3', 'active', 'Nigeria', '54B-POST-815588', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: aggregation_center (13 columns, inserting 9)
INSERT INTO "aggregation_center" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-abuja-hq', 'aggregat_record_id_1', 'Kemi Adeyemi', 'basic', '54Bank aggregation_center record 1', 'rejected', 'Nigeria', '54B-AGGR-801099', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'aggregat_record_id_2', 'Oando Energy', 'basic', '54Bank aggregation_center record 2', 'approved', 'Nigeria', '54B-AGGR-448830', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'aggregat_record_id_3', 'Rashida Bello', 'premium', '54Bank aggregation_center record 3', 'inactive', 'Nigeria', '54B-AGGR-557088', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: cbn_agsmeis (13 columns, inserting 9)
INSERT INTO "cbn_agsmeis" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-kano-north', 'cbn_agsm_record_id_1', 'Samuel Eze', 'standard', '54Bank cbn_agsmeis record 1', 'inactive', 'Nigeria', '54B-CBN_-506576', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'cbn_agsm_record_id_2', 'Lagos Agro-Allied Co', 'premium', '54Bank cbn_agsmeis record 2', 'active', 'Nigeria', '54B-CBN_-839276', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'cbn_agsm_record_id_3', 'Uchenna Ikenna', 'basic', '54Bank cbn_agsmeis record 3', 'rejected', 'Nigeria', '54B-CBN_-778094', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: acgsf_guarantee (13 columns, inserting 9)
INSERT INTO "acgsf_guarantee" ("tenant_id", "record_id", "name", "category", "description", "status", "region", "reference", "metadata") VALUES
  ('tenant-lagos-main', 'acgsf_gu_record_id_1', 'Aisha Mohammed', 'basic', '54Bank acgsf_guarantee record 1', 'pending', 'Nigeria', '54B-ACGS-245584', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'acgsf_gu_record_id_2', 'Dangote Industries Ltd', 'premium', '54Bank acgsf_guarantee record 2', 'completed', 'Nigeria', '54B-ACGS-851586', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'acgsf_gu_record_id_3', 'Amina Yusuf', 'basic', '54Bank acgsf_guarantee record 3', 'active', 'Nigeria', '54B-ACGS-111073', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_banking_gateway (14 columns, inserting 10)
INSERT INTO "voice_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'voice_ba_record_id_1', 'Oluwaseun Ajayi', 'standard', '54Bank voice_banking_gateway record 1', 'pending', 'voice_banking_gateway_channel_1', 'voice_banking_gateway_msisdn_1', 'voice_ba_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'voice_ba_record_id_2', 'Kano Textiles Ltd', 'premium', '54Bank voice_banking_gateway record 2', 'pending', 'voice_banking_gateway_channel_2', 'voice_banking_gateway_msisdn_2', 'voice_ba_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'voice_ba_record_id_3', 'Aisha Mohammed', 'basic', '54Bank voice_banking_gateway record 3', 'inactive', 'voice_banking_gateway_channel_3', 'voice_banking_gateway_msisdn_3', 'voice_ba_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_tts_nigerian (14 columns, inserting 10)
INSERT INTO "voice_tts_nigerian" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-lagos-main', 'voice_tt_record_id_1', 'Rashida Bello', 'premium', '54Bank voice_tts_nigerian record 1', 'active', 'voice_tts_nigerian_channel_1', 'voice_tts_nigerian_msisdn_1', 'voice_tt_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'voice_tt_record_id_2', 'Emeka & Sons Trading', 'basic', '54Bank voice_tts_nigerian record 2', 'rejected', 'voice_tts_nigerian_channel_2', 'voice_tts_nigerian_msisdn_2', 'voice_tt_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'voice_tt_record_id_3', 'Yetunde Olowe', 'premium', '54Bank voice_tts_nigerian record 3', 'approved', 'voice_tts_nigerian_channel_3', 'voice_tts_nigerian_msisdn_3', 'voice_tt_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_asr_nigerian (14 columns, inserting 10)
INSERT INTO "voice_asr_nigerian" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-kano-north', 'voice_as_record_id_1', 'Rashida Bello', 'premium', '54Bank voice_asr_nigerian record 1', 'completed', 'voice_asr_nigerian_channel_1', 'voice_asr_nigerian_msisdn_1', 'voice_as_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'voice_as_record_id_2', 'Kano Textiles Ltd', 'premium', '54Bank voice_asr_nigerian record 2', 'pending', 'voice_asr_nigerian_channel_2', 'voice_asr_nigerian_msisdn_2', 'voice_as_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'voice_as_record_id_3', 'Ngozi Okafor', 'premium', '54Bank voice_asr_nigerian record 3', 'pending', 'voice_asr_nigerian_channel_3', 'voice_asr_nigerian_msisdn_3', 'voice_as_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_nlu_banking (14 columns, inserting 10)
INSERT INTO "voice_nlu_banking" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-abuja-hq', 'voice_nl_record_id_1', 'Folake Adeniyi', 'premium', '54Bank voice_nlu_banking record 1', 'pending', 'voice_nlu_banking_channel_1', 'voice_nlu_banking_msisdn_1', 'voice_nl_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'voice_nl_record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank voice_nlu_banking record 2', 'completed', 'voice_nlu_banking_channel_2', 'voice_nlu_banking_msisdn_2', 'voice_nl_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'voice_nl_record_id_3', 'Yetunde Olowe', 'standard', '54Bank voice_nlu_banking record 3', 'pending', 'voice_nlu_banking_channel_3', 'voice_nlu_banking_msisdn_3', 'voice_nl_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_biometric_auth (14 columns, inserting 10)
INSERT INTO "voice_biometric_auth" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'voice_bi_record_id_1', 'Oluwaseun Ajayi', 'standard', '54Bank voice_biometric_auth record 1', 'approved', 'voice_biometric_auth_channel_1', 'voice_biometric_auth_msisdn_1', 'voice_bi_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'voice_bi_record_id_2', 'Emeka & Sons Trading', 'standard', '54Bank voice_biometric_auth record 2', 'completed', 'voice_biometric_auth_channel_2', 'voice_biometric_auth_msisdn_2', 'voice_bi_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'voice_bi_record_id_3', 'Oluwaseun Ajayi', 'standard', '54Bank voice_biometric_auth record 3', 'active', 'voice_biometric_auth_channel_3', 'voice_biometric_auth_msisdn_3', 'voice_bi_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_ivr_menu (14 columns, inserting 10)
INSERT INTO "voice_ivr_menu" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-abuja-hq', 'voice_iv_record_id_1', 'Samuel Eze', 'basic', '54Bank voice_ivr_menu record 1', 'inactive', 'voice_ivr_menu_channel_1', 'voice_ivr_menu_msisdn_1', 'voice_iv_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'voice_iv_record_id_2', 'Kano Textiles Ltd', 'standard', '54Bank voice_ivr_menu record 2', 'inactive', 'voice_ivr_menu_channel_2', 'voice_ivr_menu_msisdn_2', 'voice_iv_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'voice_iv_record_id_3', 'Ibrahim Musa', 'basic', '54Bank voice_ivr_menu record 3', 'active', 'voice_ivr_menu_channel_3', 'voice_ivr_menu_msisdn_3', 'voice_iv_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_call_analytics (14 columns, inserting 10)
INSERT INTO "voice_call_analytics" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-abuja-hq', 'voice_ca_record_id_1', 'Chidi Obi', 'premium', '54Bank voice_call_analytics record 1', 'pending', 'voice_call_analytics_channel_1', 'voice_call_analytics_msisdn_1', 'voice_ca_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'voice_ca_record_id_2', 'Abuja Properties Ltd', 'basic', '54Bank voice_call_analytics record 2', 'active', 'voice_call_analytics_channel_2', 'voice_call_analytics_msisdn_2', 'voice_ca_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'voice_ca_record_id_3', 'Aisha Mohammed', 'basic', '54Bank voice_call_analytics record 3', 'inactive', 'voice_call_analytics_channel_3', 'voice_call_analytics_msisdn_3', 'voice_ca_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: voice_agent_escalation (14 columns, inserting 10)
INSERT INTO "voice_agent_escalation" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'voice_ag_record_id_1', 'Oluwaseun Ajayi', 'basic', '54Bank voice_agent_escalation record 1', 'completed', 'voice_agent_escalation_channel_1', 'voice_agent_escalation_msisdn_1', 'voice_ag_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'voice_ag_record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank voice_agent_escalation record 2', 'active', 'voice_agent_escalation_channel_2', 'voice_agent_escalation_msisdn_2', 'voice_ag_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'voice_ag_record_id_3', 'Oluwaseun Ajayi', 'premium', '54Bank voice_agent_escalation record 3', 'active', 'voice_agent_escalation_channel_3', 'voice_agent_escalation_msisdn_3', 'voice_ag_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: telegram_bot_gateway (14 columns, inserting 10)
INSERT INTO "telegram_bot_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-lagos-main', 'telegram_record_id_1', 'Tunde Bakare', 'standard', '54Bank telegram_bot_gateway record 1', 'inactive', 'telegram_bot_gateway_channel_1', 'telegram_bot_gateway_msisdn_1', 'telegram_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'telegram_record_id_2', 'Oando Energy', 'basic', '54Bank telegram_bot_gateway record 2', 'inactive', 'telegram_bot_gateway_channel_2', 'telegram_bot_gateway_msisdn_2', 'telegram_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'telegram_record_id_3', 'Uchenna Ikenna', 'standard', '54Bank telegram_bot_gateway record 3', 'rejected', 'telegram_bot_gateway_channel_3', 'telegram_bot_gateway_msisdn_3', 'telegram_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: telegram_banking_commands (14 columns, inserting 10)
INSERT INTO "telegram_banking_commands" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-kano-north', 'telegram_record_id_1', 'Godwin Etim', 'premium', '54Bank telegram_banking_commands record 1', 'rejected', 'telegram_banking_commands_channel_1', 'telegram_banking_commands_msisdn_1', 'telegram_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'telegram_record_id_2', 'Oando Energy', 'basic', '54Bank telegram_banking_commands record 2', 'active', 'telegram_banking_commands_channel_2', 'telegram_banking_commands_msisdn_2', 'telegram_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'telegram_record_id_3', 'Ibrahim Musa', 'standard', '54Bank telegram_banking_commands record 3', 'pending', 'telegram_banking_commands_channel_3', 'telegram_banking_commands_msisdn_3', 'telegram_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: telegram_notification (14 columns, inserting 10)
INSERT INTO "telegram_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'telegram_record_id_1', 'Godwin Etim', 'premium', '54Bank telegram_notification record 1', 'approved', 'telegram_notification_channel_1', 'telegram_notification_msisdn_1', 'telegram_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'telegram_record_id_2', 'Abuja Properties Ltd', 'basic', '54Bank telegram_notification record 2', 'inactive', 'telegram_notification_channel_2', 'telegram_notification_msisdn_2', 'telegram_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'telegram_record_id_3', 'Adewale Ogundimu', 'basic', '54Bank telegram_notification record 3', 'completed', 'telegram_notification_channel_3', 'telegram_notification_msisdn_3', 'telegram_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: telegram_mini_app (14 columns, inserting 10)
INSERT INTO "telegram_mini_app" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-abuja-hq', 'telegram_record_id_1', 'Rashida Bello', 'premium', '54Bank telegram_mini_app record 1', 'active', 'telegram_mini_app_channel_1', 'telegram_mini_app_msisdn_1', 'telegram_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'telegram_record_id_2', 'Emeka & Sons Trading', 'basic', '54Bank telegram_mini_app record 2', 'pending', 'telegram_mini_app_channel_2', 'telegram_mini_app_msisdn_2', 'telegram_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'telegram_record_id_3', 'Aisha Mohammed', 'premium', '54Bank telegram_mini_app record 3', 'completed', 'telegram_mini_app_channel_3', 'telegram_mini_app_msisdn_3', 'telegram_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: telegram_kyc_bot (14 columns, inserting 10)
INSERT INTO "telegram_kyc_bot" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'telegram_record_id_1', 'Samuel Eze', 'premium', '54Bank telegram_kyc_bot record 1', 'rejected', 'telegram_kyc_bot_channel_1', 'telegram_kyc_bot_msisdn_1', 'telegram_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'telegram_record_id_2', 'Kano Textiles Ltd', 'standard', '54Bank telegram_kyc_bot record 2', 'pending', 'telegram_kyc_bot_channel_2', 'telegram_kyc_bot_msisdn_2', 'telegram_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'telegram_record_id_3', 'Ngozi Okafor', 'premium', '54Bank telegram_kyc_bot record 3', 'completed', 'telegram_kyc_bot_channel_3', 'telegram_kyc_bot_msisdn_3', 'telegram_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: whatsapp_business_gateway (14 columns, inserting 10)
INSERT INTO "whatsapp_business_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-lagos-main', 'whatsapp_record_id_1', 'Obinna Chukwu', 'basic', '54Bank whatsapp_business_gateway record 1', 'inactive', 'whatsapp_business_gateway_channel_1', 'whatsapp_business_gateway_msisdn_1', 'whatsapp_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'whatsapp_record_id_2', 'Abuja Properties Ltd', 'standard', '54Bank whatsapp_business_gateway record 2', 'active', 'whatsapp_business_gateway_channel_2', 'whatsapp_business_gateway_msisdn_2', 'whatsapp_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'whatsapp_record_id_3', 'Samuel Eze', 'basic', '54Bank whatsapp_business_gateway record 3', 'active', 'whatsapp_business_gateway_channel_3', 'whatsapp_business_gateway_msisdn_3', 'whatsapp_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: whatsapp_banking_flows (14 columns, inserting 10)
INSERT INTO "whatsapp_banking_flows" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-lagos-main', 'whatsapp_record_id_1', 'Godwin Etim', 'premium', '54Bank whatsapp_banking_flows record 1', 'active', 'whatsapp_banking_flows_channel_1', 'whatsapp_banking_flows_msisdn_1', 'whatsapp_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'whatsapp_record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank whatsapp_banking_flows record 2', 'rejected', 'whatsapp_banking_flows_channel_2', 'whatsapp_banking_flows_msisdn_2', 'whatsapp_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'whatsapp_record_id_3', 'Yetunde Olowe', 'premium', '54Bank whatsapp_banking_flows record 3', 'rejected', 'whatsapp_banking_flows_channel_3', 'whatsapp_banking_flows_msisdn_3', 'whatsapp_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: whatsapp_payment_integration (14 columns, inserting 10)
INSERT INTO "whatsapp_payment_integration" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'whatsapp_record_id_1', 'Rashida Bello', 'basic', '54Bank whatsapp_payment_integration record 1', 'pending', 'whatsapp_payment_integration_channel_1', 'whatsapp_payment_integration_msisdn_1', 'whatsapp_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'whatsapp_record_id_2', 'Oando Energy', 'standard', '54Bank whatsapp_payment_integration record 2', 'rejected', 'whatsapp_payment_integration_channel_2', 'whatsapp_payment_integration_msisdn_2', 'whatsapp_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'whatsapp_record_id_3', 'Tunde Bakare', 'standard', '54Bank whatsapp_payment_integration record 3', 'active', 'whatsapp_payment_integration_channel_3', 'whatsapp_payment_integration_msisdn_3', 'whatsapp_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: whatsapp_notification (14 columns, inserting 10)
INSERT INTO "whatsapp_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-lagos-main', 'whatsapp_record_id_1', 'Rashida Bello', 'premium', '54Bank whatsapp_notification record 1', 'rejected', 'whatsapp_notification_channel_1', 'whatsapp_notification_msisdn_1', 'whatsapp_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'whatsapp_record_id_2', 'Lagos Agro-Allied Co', 'standard', '54Bank whatsapp_notification record 2', 'active', 'whatsapp_notification_channel_2', 'whatsapp_notification_msisdn_2', 'whatsapp_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'whatsapp_record_id_3', 'Obinna Chukwu', 'basic', '54Bank whatsapp_notification record 3', 'active', 'whatsapp_notification_channel_3', 'whatsapp_notification_msisdn_3', 'whatsapp_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: whatsapp_document_service (14 columns, inserting 10)
INSERT INTO "whatsapp_document_service" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'whatsapp_record_id_1', 'Obinna Chukwu', 'standard', '54Bank whatsapp_document_service record 1', 'completed', 'whatsapp_document_service_channel_1', 'whatsapp_document_service_msisdn_1', 'whatsapp_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'whatsapp_record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank whatsapp_document_service record 2', 'completed', 'whatsapp_document_service_channel_2', 'whatsapp_document_service_msisdn_2', 'whatsapp_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'whatsapp_record_id_3', 'Ngozi Okafor', 'premium', '54Bank whatsapp_document_service record 3', 'approved', 'whatsapp_document_service_channel_3', 'whatsapp_document_service_msisdn_3', 'whatsapp_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: ussd_banking_gateway (14 columns, inserting 10)
INSERT INTO "ussd_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'ussd_ban_record_id_1', 'Rashida Bello', 'premium', '54Bank ussd_banking_gateway record 1', 'pending', 'ussd_banking_gateway_channel_1', 'ussd_banking_gateway_msisdn_1', 'ussd_ban_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'ussd_ban_record_id_2', 'Kano Textiles Ltd', 'standard', '54Bank ussd_banking_gateway record 2', 'active', 'ussd_banking_gateway_channel_2', 'ussd_banking_gateway_msisdn_2', 'ussd_ban_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'ussd_ban_record_id_3', 'Ngozi Okafor', 'basic', '54Bank ussd_banking_gateway record 3', 'pending', 'ussd_banking_gateway_channel_3', 'ussd_banking_gateway_msisdn_3', 'ussd_ban_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: ussd_transaction_engine (14 columns, inserting 10)
INSERT INTO "ussd_transaction_engine" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'ussd_tra_record_id_1', 'Amina Yusuf', 'basic', '54Bank ussd_transaction_engine record 1', 'approved', 'ussd_transaction_engine_channel_1', 'ussd_transaction_engine_msisdn_1', 'ussd_tra_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'ussd_tra_record_id_2', 'Kano Textiles Ltd', 'standard', '54Bank ussd_transaction_engine record 2', 'completed', 'ussd_transaction_engine_channel_2', 'ussd_transaction_engine_msisdn_2', 'ussd_tra_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'ussd_tra_record_id_3', 'Halima Abdullahi', 'premium', '54Bank ussd_transaction_engine record 3', 'active', 'ussd_transaction_engine_channel_3', 'ussd_transaction_engine_msisdn_3', 'ussd_tra_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: ussd_multilingual (14 columns, inserting 10)
INSERT INTO "ussd_multilingual" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-kano-north', 'ussd_mul_record_id_1', 'Oluwaseun Ajayi', 'premium', '54Bank ussd_multilingual record 1', 'inactive', 'ussd_multilingual_channel_1', 'ussd_multilingual_msisdn_1', 'ussd_mul_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'ussd_mul_record_id_2', 'Dangote Industries Ltd', 'standard', '54Bank ussd_multilingual record 2', 'inactive', 'ussd_multilingual_channel_2', 'ussd_multilingual_msisdn_2', 'ussd_mul_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-ph-south', 'ussd_mul_record_id_3', 'Uchenna Ikenna', 'standard', '54Bank ussd_multilingual record 3', 'pending', 'ussd_multilingual_channel_3', 'ussd_multilingual_msisdn_3', 'ussd_mul_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: ussd_sim_toolkit (14 columns, inserting 10)
INSERT INTO "ussd_sim_toolkit" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'ussd_sim_record_id_1', 'Amina Yusuf', 'standard', '54Bank ussd_sim_toolkit record 1', 'pending', 'ussd_sim_toolkit_channel_1', 'ussd_sim_toolkit_msisdn_1', 'ussd_sim_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'ussd_sim_record_id_2', 'Kano Textiles Ltd', 'standard', '54Bank ussd_sim_toolkit record 2', 'active', 'ussd_sim_toolkit_channel_2', 'ussd_sim_toolkit_msisdn_2', 'ussd_sim_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'ussd_sim_record_id_3', 'Samuel Eze', 'premium', '54Bank ussd_sim_toolkit record 3', 'completed', 'ussd_sim_toolkit_channel_3', 'ussd_sim_toolkit_msisdn_3', 'ussd_sim_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: sms_banking_gateway (14 columns, inserting 10)
INSERT INTO "sms_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'sms_bank_record_id_1', 'Yetunde Olowe', 'basic', '54Bank sms_banking_gateway record 1', 'pending', 'sms_banking_gateway_channel_1', 'sms_banking_gateway_msisdn_1', 'sms_bank_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'sms_bank_record_id_2', 'Kano Textiles Ltd', 'premium', '54Bank sms_banking_gateway record 2', 'approved', 'sms_banking_gateway_channel_2', 'sms_banking_gateway_msisdn_2', 'sms_bank_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'sms_bank_record_id_3', 'Samuel Eze', 'basic', '54Bank sms_banking_gateway record 3', 'rejected', 'sms_banking_gateway_channel_3', 'sms_banking_gateway_msisdn_3', 'sms_bank_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: sms_otp_service (14 columns, inserting 10)
INSERT INTO "sms_otp_service" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-ph-south', 'sms_otp__record_id_1', 'Ibrahim Musa', 'basic', '54Bank sms_otp_service record 1', 'approved', 'sms_otp_service_channel_1', 'sms_otp_service_msisdn_1', 'sms_otp__session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-lagos-main', 'sms_otp__record_id_2', 'Dangote Industries Ltd', 'premium', '54Bank sms_otp_service record 2', 'completed', 'sms_otp_service_channel_2', 'sms_otp_service_msisdn_2', 'sms_otp__session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'sms_otp__record_id_3', 'Samuel Eze', 'standard', '54Bank sms_otp_service record 3', 'pending', 'sms_otp_service_channel_3', 'sms_otp_service_msisdn_3', 'sms_otp__session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

-- Table: sms_alert_notification (14 columns, inserting 10)
INSERT INTO "sms_alert_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "channel", "msisdn", "session_id", "metadata") VALUES
  ('tenant-abuja-hq', 'sms_aler_record_id_1', 'Fatima Hassan', 'standard', '54Bank sms_alert_notification record 1', 'inactive', 'sms_alert_notification_channel_1', 'sms_alert_notification_msisdn_1', 'sms_aler_session_id_1', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-abuja-hq', 'sms_aler_record_id_2', 'Abuja Properties Ltd', 'premium', '54Bank sms_alert_notification record 2', 'rejected', 'sms_alert_notification_channel_2', 'sms_alert_notification_msisdn_2', 'sms_aler_session_id_2', '{"region": "west_africa", "currency": "NGN"}'::jsonb),
  ('tenant-kano-north', 'sms_aler_record_id_3', 'Fatima Hassan', 'basic', '54Bank sms_alert_notification record 3', 'approved', 'sms_alert_notification_channel_3', 'sms_alert_notification_msisdn_3', 'sms_aler_session_id_3', '{"region": "west_africa", "currency": "NGN"}'::jsonb);

COMMIT;
-- Done: 267 tables, 801 rows
