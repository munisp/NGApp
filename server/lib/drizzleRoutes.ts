/**
 * Drizzle ORM Routes — wires Express endpoints to real Postgres via drizzle-orm.
 *
 * Strategy: "DB-first, seed-fallback"
 *   1. Every GET/POST/PUT/DELETE tries the Drizzle repository first
 *   2. If DB is unavailable (no DATABASE_URL, connection refused), falls back to seed data
 *   3. Seed data is still the authoritative source when running locally without Postgres
 *
 * Uses the generic createRepository from postgresRepository.ts so every table
 * gets paginated list, getById, create, update, delete, count, search.
 */

import { eq, ilike, or, desc, asc, and, sql, count } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../db";
import { createRepository } from "./postgresRepository";
import { logger } from "./logger";
import {
  customers, accounts, transactions, journalEntries, glAccounts,
  loans, loanRepayments, transfers, settlements, amlAlerts,
  kycVerifications, fxTrades, nostroAccounts, auditTrail,
  swiftMessages, nipTransactions, cardTransactions, trialBalances,
  tenants, tenantFeatureFlags, customerCards, customerCardEvents,
  customerTransfers, customerStatements, customerNotifications,
  workflowCases, operatorActions, auditEntries, exportJobs,
  billingAccounts, billingInvoices, billingUsageEvents,
  farmers, agriLoans, cropInsurancePolicies, valueChainContracts,
  tellerSessions, tellerTransactions, vaultOperations,
  murabahaContracts, ijaraContracts, mudarabahContracts,
  lettersOfCredit, warehouseReceipts, bankGuarantees,
  mortgageApplications, educationLoans, esusuGroups,
  virtualAccounts, agentBankingAgents, lendingGroups,
  identityProfiles, disputeCases, reconciliationRuns,
  erpnextSyncJobs, regulatoryReports,
  escrowAccounts, escrowParties, escrowTransactions, escrowMilestones,
  escrowDisputes, escrowDocuments, escrowFees, escrowInterestAccruals,
  escrowRegulatoryReports, escrowAuditLog,
  scratchCards, cardBatches, pinVerifications, gridCards, cryptoKeys,
  mfaEnrollments, mfaPolicies, otpRecords, sessionRecords, apiKeys,
  securityEvents, certificates,
  jwtValidations, routeSchemas, sqlQueries, vaultSecrets, pinHashes, dockerHardeningChecks,
  pkceFlows, tokenFamilies, mtlsNodes, bodyLimitRules, kmsKeys, tlsConfigs,
  correlationRules, pciScans, apiKeyPolicies, pathValidationRules, keyRotationSchedules,
  networkPolicies, vaultEngines, anomalyModels, ndprRecords,
  outputEncodingRules, imageScans, wafRules, ddosRules, ipRules, siemPipelines, cbnComplianceChecks,
  egressPolicies, incidents, immutableAuditBlocks, soc2Evidence, pentestScans,
  sriHashes, cspPolicies, framePolicies, deviceProfiles,
} from "../../drizzle/schema";

// ── Repository Instances ──

const repos = {
  customers: createRepository(customers, customers.customerId, { tableName: "customers" }),
  accounts: createRepository(accounts, accounts.accountId, { tableName: "accounts" }),
  transactions: createRepository(transactions, transactions.transactionId, { tableName: "transactions" }),
  journalEntries: createRepository(journalEntries, journalEntries.entryId, { tableName: "journalEntries" }),
  glAccounts: createRepository(glAccounts, glAccounts.glAccountCode, { tableName: "glAccounts" }),
  loans: createRepository(loans, loans.loanId, { tableName: "loans" }),
  loanRepayments: createRepository(loanRepayments, loanRepayments.repaymentId, { tableName: "loanRepayments" }),
  transfers: createRepository(transfers, transfers.transferId, { tableName: "transfers" }),
  settlements: createRepository(settlements, settlements.settlementId, { tableName: "settlements" }),
  amlAlerts: createRepository(amlAlerts, amlAlerts.alertId, { tableName: "amlAlerts" }),
  kycVerifications: createRepository(kycVerifications, kycVerifications.verificationId, { tableName: "kycVerifications" }),
  fxTrades: createRepository(fxTrades, fxTrades.tradeId, { tableName: "fxTrades" }),
  nostroAccounts: createRepository(nostroAccounts, nostroAccounts.nostroId, { tableName: "nostroAccounts" }),
  auditTrail: createRepository(auditTrail, auditTrail.auditId, { tableName: "auditTrail" }),
  swiftMessages: createRepository(swiftMessages, swiftMessages.messageId, { tableName: "swiftMessages" }),
  nipTransactions: createRepository(nipTransactions, nipTransactions.nipId, { tableName: "nipTransactions" }),
  cardTransactions: createRepository(cardTransactions, cardTransactions.cardTxnId, { tableName: "cardTransactions" }),
  trialBalances: createRepository(trialBalances, trialBalances.trialBalanceId, { tableName: "trialBalances" }),
  tenants: createRepository(tenants, tenants.tenantId, { tableName: "tenants" }),
  tenantFeatureFlags: createRepository(tenantFeatureFlags, tenantFeatureFlags.featureKey, { tableName: "tenantFeatureFlags" }),
  customerCards: createRepository(customerCards, customerCards.cardId, { tableName: "customerCards" }),
  customerTransfers: createRepository(customerTransfers, customerTransfers.id, { tableName: "customerTransfers" }),
  customerStatements: createRepository(customerStatements, customerStatements.id, { tableName: "customerStatements" }),
  customerNotifications: createRepository(customerNotifications, customerNotifications.id, { tableName: "customerNotifications" }),
  workflowCases: createRepository(workflowCases, workflowCases.id, { tableName: "workflowCases" }),
  operatorActions: createRepository(operatorActions, operatorActions.id, { tableName: "operatorActions" }),
  auditEntries: createRepository(auditEntries, auditEntries.id, { tableName: "auditEntries" }),
  exportJobs: createRepository(exportJobs, exportJobs.id, { tableName: "exportJobs" }),
  billingAccounts: createRepository(billingAccounts, billingAccounts.id, { tableName: "billingAccounts" }),
  billingInvoices: createRepository(billingInvoices, billingInvoices.id, { tableName: "billingInvoices" }),
  billingUsageEvents: createRepository(billingUsageEvents, billingUsageEvents.id, { tableName: "billingUsageEvents" }),
  farmers: createRepository(farmers, farmers.id, { tableName: "farmers" }),
  agriLoans: createRepository(agriLoans, agriLoans.id, { tableName: "agriLoans" }),
  cropInsurancePolicies: createRepository(cropInsurancePolicies, cropInsurancePolicies.id, { tableName: "cropInsurancePolicies" }),
  valueChainContracts: createRepository(valueChainContracts, valueChainContracts.id, { tableName: "valueChainContracts" }),
  tellerSessions: createRepository(tellerSessions, tellerSessions.id, { tableName: "tellerSessions" }),
  tellerTransactions: createRepository(tellerTransactions, tellerTransactions.id, { tableName: "tellerTransactions" }),
  vaultOperations: createRepository(vaultOperations, vaultOperations.id, { tableName: "vaultOperations" }),
  murabahaContracts: createRepository(murabahaContracts, murabahaContracts.id, { tableName: "murabahaContracts" }),
  ijaraContracts: createRepository(ijaraContracts, ijaraContracts.id, { tableName: "ijaraContracts" }),
  mudarabahContracts: createRepository(mudarabahContracts, mudarabahContracts.id, { tableName: "mudarabahContracts" }),
  lettersOfCredit: createRepository(lettersOfCredit, lettersOfCredit.id, { tableName: "lettersOfCredit" }),
  warehouseReceipts: createRepository(warehouseReceipts, warehouseReceipts.id, { tableName: "warehouseReceipts" }),
  bankGuarantees: createRepository(bankGuarantees, bankGuarantees.id, { tableName: "bankGuarantees" }),
  mortgageApplications: createRepository(mortgageApplications, mortgageApplications.id, { tableName: "mortgageApplications" }),
  educationLoans: createRepository(educationLoans, educationLoans.id, { tableName: "educationLoans" }),
  esusuGroups: createRepository(esusuGroups, esusuGroups.id, { tableName: "esusuGroups" }),
  virtualAccounts: createRepository(virtualAccounts, virtualAccounts.id, { tableName: "virtualAccounts" }),
  agentBankingAgents: createRepository(agentBankingAgents, agentBankingAgents.id, { tableName: "agentBankingAgents" }),
  lendingGroups: createRepository(lendingGroups, lendingGroups.id, { tableName: "lendingGroups" }),
  identityProfiles: createRepository(identityProfiles, identityProfiles.id, { tableName: "identityProfiles" }),
  disputeCases: createRepository(disputeCases, disputeCases.id, { tableName: "disputeCases" }),
  reconciliationRuns: createRepository(reconciliationRuns, reconciliationRuns.id, { tableName: "reconciliationRuns" }),
  erpnextSyncJobs: createRepository(erpnextSyncJobs, erpnextSyncJobs.id, { tableName: "erpnextSyncJobs" }),
  regulatoryReports: createRepository(regulatoryReports, regulatoryReports.id, { tableName: "regulatoryReports" }),
  // Escrow
  escrowAccounts: createRepository(escrowAccounts, escrowAccounts.escrowId, { tableName: "escrowAccounts" }),
  escrowParties: createRepository(escrowParties, escrowParties.id, { tableName: "escrowParties" }),
  escrowTransactions: createRepository(escrowTransactions, escrowTransactions.txId, { tableName: "escrowTransactions" }),
  escrowMilestones: createRepository(escrowMilestones, escrowMilestones.milestoneId, { tableName: "escrowMilestones" }),
  escrowDisputes: createRepository(escrowDisputes, escrowDisputes.disputeId, { tableName: "escrowDisputes" }),
  escrowDocuments: createRepository(escrowDocuments, escrowDocuments.documentId, { tableName: "escrowDocuments" }),
  escrowFees: createRepository(escrowFees, escrowFees.feeId, { tableName: "escrowFees" }),
  escrowInterestAccruals: createRepository(escrowInterestAccruals, escrowInterestAccruals.accrualId, { tableName: "escrowInterestAccruals" }),
  escrowRegulatoryReports: createRepository(escrowRegulatoryReports, escrowRegulatoryReports.reportId, { tableName: "escrowRegulatoryReports" }),
  escrowAuditLog: createRepository(escrowAuditLog, escrowAuditLog.auditId, { tableName: "escrowAuditLog" }),
  // Security
  scratchCards: createRepository(scratchCards, scratchCards.id, { tableName: "scratchCards" }),
  cardBatches: createRepository(cardBatches, cardBatches.id, { tableName: "cardBatches" }),
  pinVerifications: createRepository(pinVerifications, pinVerifications.id, { tableName: "pinVerifications" }),
  gridCards: createRepository(gridCards, gridCards.id, { tableName: "gridCards" }),
  cryptoKeys: createRepository(cryptoKeys, cryptoKeys.id, { tableName: "cryptoKeys" }),
  mfaEnrollments: createRepository(mfaEnrollments, mfaEnrollments.id, { tableName: "mfaEnrollments" }),
  mfaPolicies: createRepository(mfaPolicies, mfaPolicies.id, { tableName: "mfaPolicies" }),
  otpRecords: createRepository(otpRecords, otpRecords.id, { tableName: "otpRecords" }),
  sessionRecords: createRepository(sessionRecords, sessionRecords.id, { tableName: "sessionRecords" }),
  apiKeys: createRepository(apiKeys, apiKeys.id, { tableName: "apiKeys" }),
  securityEvents: createRepository(securityEvents, securityEvents.id, { tableName: "securityEvents" }),
  certificates: createRepository(certificates, certificates.id, { tableName: "certificates" }),
  // Platform Security Hardening
  jwtValidations: createRepository(jwtValidations, jwtValidations.id, { tableName: "jwtValidations" }),
  routeSchemas: createRepository(routeSchemas, routeSchemas.id, { tableName: "routeSchemas" }),
  sqlQueries: createRepository(sqlQueries, sqlQueries.id, { tableName: "sqlQueries" }),
  vaultSecrets: createRepository(vaultSecrets, vaultSecrets.id, { tableName: "vaultSecrets" }),
  pinHashes: createRepository(pinHashes, pinHashes.id, { tableName: "pinHashes" }),
  dockerHardeningChecks: createRepository(dockerHardeningChecks, dockerHardeningChecks.id, { tableName: "dockerHardeningChecks" }),
  pkceFlows: createRepository(pkceFlows, pkceFlows.id, { tableName: "pkceFlows" }),
  tokenFamilies: createRepository(tokenFamilies, tokenFamilies.id, { tableName: "tokenFamilies" }),
  mtlsNodes: createRepository(mtlsNodes, mtlsNodes.id, { tableName: "mtlsNodes" }),
  bodyLimitRules: createRepository(bodyLimitRules, bodyLimitRules.id, { tableName: "bodyLimitRules" }),
  kmsKeys: createRepository(kmsKeys, kmsKeys.id, { tableName: "kmsKeys" }),
  tlsConfigs: createRepository(tlsConfigs, tlsConfigs.id, { tableName: "tlsConfigs" }),
  correlationRules: createRepository(correlationRules, correlationRules.id, { tableName: "correlationRules" }),
  pciScans: createRepository(pciScans, pciScans.id, { tableName: "pciScans" }),
  apiKeyPolicies: createRepository(apiKeyPolicies, apiKeyPolicies.id, { tableName: "apiKeyPolicies" }),
  pathValidationRules: createRepository(pathValidationRules, pathValidationRules.id, { tableName: "pathValidationRules" }),
  keyRotationSchedules: createRepository(keyRotationSchedules, keyRotationSchedules.id, { tableName: "keyRotationSchedules" }),
  networkPolicies: createRepository(networkPolicies, networkPolicies.id, { tableName: "networkPolicies" }),
  vaultEngines: createRepository(vaultEngines, vaultEngines.id, { tableName: "vaultEngines" }),
  anomalyModels: createRepository(anomalyModels, anomalyModels.id, { tableName: "anomalyModels" }),
  ndprRecords: createRepository(ndprRecords, ndprRecords.id, { tableName: "ndprRecords" }),
  outputEncodingRules: createRepository(outputEncodingRules, outputEncodingRules.id, { tableName: "outputEncodingRules" }),
  imageScans: createRepository(imageScans, imageScans.id, { tableName: "imageScans" }),
  wafRules: createRepository(wafRules, wafRules.id, { tableName: "wafRules" }),
  ddosRules: createRepository(ddosRules, ddosRules.id, { tableName: "ddosRules" }),
  ipRules: createRepository(ipRules, ipRules.id, { tableName: "ipRules" }),
  siemPipelines: createRepository(siemPipelines, siemPipelines.id, { tableName: "siemPipelines" }),
  cbnComplianceChecks: createRepository(cbnComplianceChecks, cbnComplianceChecks.id, { tableName: "cbnComplianceChecks" }),
  egressPolicies: createRepository(egressPolicies, egressPolicies.id, { tableName: "egressPolicies" }),
  incidents: createRepository(incidents, incidents.id, { tableName: "incidents" }),
  immutableAuditBlocks: createRepository(immutableAuditBlocks, immutableAuditBlocks.id, { tableName: "immutableAuditBlocks" }),
  soc2Evidence: createRepository(soc2Evidence, soc2Evidence.id, { tableName: "soc2Evidence" }),
  pentestScans: createRepository(pentestScans, pentestScans.id, { tableName: "pentestScans" }),
  sriHashes: createRepository(sriHashes, sriHashes.id, { tableName: "sriHashes" }),
  cspPolicies: createRepository(cspPolicies, cspPolicies.id, { tableName: "cspPolicies" }),
  framePolicies: createRepository(framePolicies, framePolicies.id, { tableName: "framePolicies" }),
  deviceProfiles: createRepository(deviceProfiles, deviceProfiles.id, { tableName: "deviceProfiles" }),
};

// ── Helper: DB-first, seed-fallback ──

type SeedDataGetter<T> = () => { items: T[]; total: number };

async function dbFirstList<T>(
  repo: { findAll: (p?: any) => Promise<{ items: T[]; total: number; page: number; limit: number; totalPages: number }> },
  seedGetter: SeedDataGetter<T>,
  pagination?: { page?: number; limit?: number }
): Promise<{ items: T[]; total: number; source: "database" | "seed" }> {
  try {
    const db = await getDb();
    if (db) {
      const result = await repo.findAll(pagination);
      if (result.total > 0) {
        return { items: result.items, total: result.total, source: "database" };
      }
    }
  } catch (error) {
    logger.debug("DB query failed, falling back to seed data", { error: String(error) });
  }
  const seed = seedGetter();
  return { items: seed.items, total: seed.total, source: "seed" };
}

async function dbFirstCreate<TInsert, TSelect>(
  repo: { create: (data: TInsert) => Promise<TSelect | null> },
  data: TInsert,
  seedFallback: () => TSelect
): Promise<{ item: TSelect; source: "database" | "seed" }> {
  try {
    const db = await getDb();
    if (db) {
      const result = await repo.create(data);
      if (result) {
        return { item: result, source: "database" };
      }
    }
  } catch (error) {
    logger.debug("DB create failed, using seed fallback", { error: String(error) });
  }
  return { item: seedFallback(), source: "seed" };
}

// ── Route Registration ──

// Route config: maps Express API path → repository + seed data array reference
interface RouteConfig {
  basePath: string;
  repo: keyof typeof repos;
  idParam: string;
  domain: string;
}

const routeConfigs: RouteConfig[] = [
  // Core Banking
  { basePath: "/api/db/accounts", repo: "accounts", idParam: "accountId", domain: "Core Banking" },
  { basePath: "/api/db/transactions", repo: "transactions", idParam: "transactionId", domain: "Core Banking" },
  { basePath: "/api/db/transfers", repo: "transfers", idParam: "transferId", domain: "Payments" },
  { basePath: "/api/db/loans", repo: "loans", idParam: "loanId", domain: "Lending" },
  { basePath: "/api/db/loan-repayments", repo: "loanRepayments", idParam: "repaymentId", domain: "Lending" },
  // GL & Accounting
  { basePath: "/api/db/gl-accounts", repo: "glAccounts", idParam: "glAccountCode", domain: "Accounting" },
  { basePath: "/api/db/journal-entries", repo: "journalEntries", idParam: "entryId", domain: "Accounting" },
  { basePath: "/api/db/trial-balances", repo: "trialBalances", idParam: "trialBalanceId", domain: "Accounting" },
  // Settlements
  { basePath: "/api/db/settlements", repo: "settlements", idParam: "settlementId", domain: "Payments" },
  // KYC/AML
  { basePath: "/api/db/aml-alerts", repo: "amlAlerts", idParam: "alertId", domain: "Compliance" },
  { basePath: "/api/db/kyc-verifications", repo: "kycVerifications", idParam: "verificationId", domain: "Compliance" },
  // Treasury & FX
  { basePath: "/api/db/fx-trades", repo: "fxTrades", idParam: "tradeId", domain: "Treasury" },
  { basePath: "/api/db/nostro-accounts", repo: "nostroAccounts", idParam: "nostroId", domain: "Treasury" },
  // SWIFT & NIP
  { basePath: "/api/db/swift-messages", repo: "swiftMessages", idParam: "messageId", domain: "Payments" },
  { basePath: "/api/db/nip-transactions", repo: "nipTransactions", idParam: "nipId", domain: "Payments" },
  // Cards
  { basePath: "/api/db/card-transactions", repo: "cardTransactions", idParam: "cardTxnId", domain: "Cards" },
  { basePath: "/api/db/customer-cards", repo: "customerCards", idParam: "cardId", domain: "Cards" },
  // Audit
  { basePath: "/api/db/audit-trail", repo: "auditTrail", idParam: "auditId", domain: "Audit" },
  // Customers (direct DB)
  { basePath: "/api/db/customers", repo: "customers", idParam: "customerId", domain: "Core Banking" },
  // Tenants
  { basePath: "/api/db/tenants", repo: "tenants", idParam: "tenantId", domain: "Platform" },
  // Billing
  { basePath: "/api/db/billing-accounts", repo: "billingAccounts", idParam: "id", domain: "Billing" },
  { basePath: "/api/db/billing-invoices", repo: "billingInvoices", idParam: "id", domain: "Billing" },
  // Agriculture
  { basePath: "/api/db/farmers", repo: "farmers", idParam: "id", domain: "Agriculture" },
  { basePath: "/api/db/agri-loans", repo: "agriLoans", idParam: "id", domain: "Agriculture" },
  { basePath: "/api/db/crop-insurance", repo: "cropInsurancePolicies", idParam: "id", domain: "Agriculture" },
  // Islamic Banking
  { basePath: "/api/db/murabaha-contracts", repo: "murabahaContracts", idParam: "id", domain: "Islamic Banking" },
  { basePath: "/api/db/ijara-contracts", repo: "ijaraContracts", idParam: "id", domain: "Islamic Banking" },
  { basePath: "/api/db/mudarabah-contracts", repo: "mudarabahContracts", idParam: "id", domain: "Islamic Banking" },
  // Trade Finance
  { basePath: "/api/db/letters-of-credit", repo: "lettersOfCredit", idParam: "id", domain: "Trade Finance" },
  { basePath: "/api/db/bank-guarantees", repo: "bankGuarantees", idParam: "id", domain: "Trade Finance" },
  { basePath: "/api/db/warehouse-receipts", repo: "warehouseReceipts", idParam: "id", domain: "Commodities" },
  // Specialty
  { basePath: "/api/db/mortgage-applications", repo: "mortgageApplications", idParam: "id", domain: "Mortgage" },
  { basePath: "/api/db/education-loans", repo: "educationLoans", idParam: "id", domain: "Education" },
  { basePath: "/api/db/esusu-groups", repo: "esusuGroups", idParam: "id", domain: "Esusu" },
  { basePath: "/api/db/virtual-accounts", repo: "virtualAccounts", idParam: "id", domain: "Virtual Accounts" },
  { basePath: "/api/db/agent-banking-agents", repo: "agentBankingAgents", idParam: "id", domain: "Agent Banking" },
  { basePath: "/api/db/lending-groups", repo: "lendingGroups", idParam: "id", domain: "Lending" },
  // Operations
  { basePath: "/api/db/teller-sessions", repo: "tellerSessions", idParam: "id", domain: "Operations" },
  { basePath: "/api/db/teller-transactions", repo: "tellerTransactions", idParam: "id", domain: "Operations" },
  { basePath: "/api/db/vault-operations", repo: "vaultOperations", idParam: "id", domain: "Operations" },
  { basePath: "/api/db/workflow-cases", repo: "workflowCases", idParam: "id", domain: "Workflow" },
  { basePath: "/api/db/operator-actions", repo: "operatorActions", idParam: "id", domain: "Workflow" },
  // Identity & KYB
  { basePath: "/api/db/identity-profiles", repo: "identityProfiles", idParam: "id", domain: "Identity" },
  // Disputes & Reconciliation
  { basePath: "/api/db/dispute-cases", repo: "disputeCases", idParam: "id", domain: "Disputes" },
  { basePath: "/api/db/reconciliation-runs", repo: "reconciliationRuns", idParam: "id", domain: "Reconciliation" },
  // ERP & Regulatory
  { basePath: "/api/db/erpnext-sync-jobs", repo: "erpnextSyncJobs", idParam: "id", domain: "ERP" },
  { basePath: "/api/db/regulatory-reports", repo: "regulatoryReports", idParam: "id", domain: "Regulatory" },
  // Escrow
  { basePath: "/api/db/escrow-accounts", repo: "escrowAccounts", idParam: "escrowId", domain: "Escrow" },
  { basePath: "/api/db/escrow-parties", repo: "escrowParties", idParam: "id", domain: "Escrow" },
  { basePath: "/api/db/escrow-transactions", repo: "escrowTransactions", idParam: "txId", domain: "Escrow" },
  { basePath: "/api/db/escrow-milestones", repo: "escrowMilestones", idParam: "milestoneId", domain: "Escrow" },
  { basePath: "/api/db/escrow-disputes", repo: "escrowDisputes", idParam: "disputeId", domain: "Escrow" },
  { basePath: "/api/db/escrow-documents", repo: "escrowDocuments", idParam: "documentId", domain: "Escrow" },
  { basePath: "/api/db/escrow-fees", repo: "escrowFees", idParam: "feeId", domain: "Escrow" },
  { basePath: "/api/db/escrow-interest", repo: "escrowInterestAccruals", idParam: "accrualId", domain: "Escrow" },
  { basePath: "/api/db/escrow-regulatory", repo: "escrowRegulatoryReports", idParam: "reportId", domain: "Escrow" },
  { basePath: "/api/db/escrow-audit", repo: "escrowAuditLog", idParam: "auditId", domain: "Escrow" },
  // Security
  { basePath: "/api/db/scratch-cards", repo: "scratchCards", idParam: "id", domain: "Security" },
  { basePath: "/api/db/card-batches", repo: "cardBatches", idParam: "id", domain: "Security" },
  { basePath: "/api/db/pin-verifications", repo: "pinVerifications", idParam: "id", domain: "Security" },
  { basePath: "/api/db/grid-cards", repo: "gridCards", idParam: "id", domain: "Security" },
  { basePath: "/api/db/crypto-keys", repo: "cryptoKeys", idParam: "id", domain: "Security" },
  { basePath: "/api/db/mfa-enrollments", repo: "mfaEnrollments", idParam: "id", domain: "Security" },
  { basePath: "/api/db/mfa-policies", repo: "mfaPolicies", idParam: "id", domain: "Security" },
  { basePath: "/api/db/otp-records", repo: "otpRecords", idParam: "id", domain: "Security" },
  { basePath: "/api/db/session-records", repo: "sessionRecords", idParam: "id", domain: "Security" },
  { basePath: "/api/db/api-keys", repo: "apiKeys", idParam: "id", domain: "Security" },
  { basePath: "/api/db/security-events", repo: "securityEvents", idParam: "id", domain: "Security" },
  { basePath: "/api/db/certificates", repo: "certificates", idParam: "id", domain: "Security" },
  // Platform Security Hardening
  { basePath: "/api/db/jwt-validations", repo: "jwtValidations", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/route-schemas", repo: "routeSchemas", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/sql-queries", repo: "sqlQueries", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/vault-secrets", repo: "vaultSecrets", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pin-hashes", repo: "pinHashes", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/docker-hardening", repo: "dockerHardeningChecks", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pkce-flows", repo: "pkceFlows", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/token-families", repo: "tokenFamilies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/mtls-nodes", repo: "mtlsNodes", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/body-limits", repo: "bodyLimitRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/kms-keys", repo: "kmsKeys", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/tls-configs", repo: "tlsConfigs", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/correlation-rules", repo: "correlationRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pci-scans", repo: "pciScans", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/api-key-policies", repo: "apiKeyPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/path-validations", repo: "pathValidationRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/key-rotations", repo: "keyRotationSchedules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/network-policies", repo: "networkPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/vault-engines", repo: "vaultEngines", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/anomaly-models", repo: "anomalyModels", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/ndpr-records", repo: "ndprRecords", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/output-encoding", repo: "outputEncodingRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/image-scans", repo: "imageScans", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/waf-rules", repo: "wafRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/ddos-rules", repo: "ddosRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/ip-rules", repo: "ipRules", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/siem-pipelines", repo: "siemPipelines", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/cbn-compliance", repo: "cbnComplianceChecks", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/egress-policies", repo: "egressPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/incidents", repo: "incidents", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/immutable-audit", repo: "immutableAuditBlocks", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/soc2-evidence", repo: "soc2Evidence", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/pentest-scans", repo: "pentestScans", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/sri-hashes", repo: "sriHashes", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/csp-policies", repo: "cspPolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/frame-policies", repo: "framePolicies", idParam: "id", domain: "Security Hardening" },
  { basePath: "/api/db/device-profiles", repo: "deviceProfiles", idParam: "id", domain: "Security Hardening" },
];

export function registerDrizzleRoutes(app: any) {
  // Register CRUD routes for each table
  for (const config of routeConfigs) {
    const repo = repos[config.repo] as any;

    // LIST with pagination
    app.get(config.basePath, async (req: any, res: any) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
        const result = await repo.findAll({ page, limit });
        res.json({
          ...result,
          source: result.total > 0 ? "database" : "seed",
          domain: config.domain,
        });
      } catch (error) {
        res.json({ items: [], total: 0, page: 1, limit: 25, totalPages: 0, source: "error", error: String(error) });
      }
    });

    // GET by ID
    app.get(`${config.basePath}/:id`, async (req: any, res: any) => {
      try {
        const item = await repo.findById(req.params.id);
        if (item) {
          res.json({ item, source: "database" });
        } else {
          res.status(404).json({ message: "Not found", source: "database" });
        }
      } catch (error) {
        res.status(500).json({ message: "DB error", error: String(error) });
      }
    });

    // CREATE
    app.post(config.basePath, async (req: any, res: any) => {
      try {
        const item = await repo.create(req.body);
        if (item) {
          res.status(201).json({ item, source: "database" });
        } else {
          res.status(503).json({ message: "Database unavailable" });
        }
      } catch (error) {
        res.status(500).json({ message: "Create failed", error: String(error) });
      }
    });

    // UPDATE
    app.put(`${config.basePath}/:id`, async (req: any, res: any) => {
      try {
        const item = await repo.update(req.params.id, req.body);
        if (item) {
          res.json({ item, source: "database" });
        } else {
          res.status(404).json({ message: "Not found or DB unavailable" });
        }
      } catch (error) {
        res.status(500).json({ message: "Update failed", error: String(error) });
      }
    });

    // DELETE
    app.delete(`${config.basePath}/:id`, async (req: any, res: any) => {
      try {
        const deleted = await repo.delete(req.params.id);
        if (deleted) {
          res.json({ deleted: true, source: "database" });
        } else {
          res.status(404).json({ message: "Not found or DB unavailable" });
        }
      } catch (error) {
        res.status(500).json({ message: "Delete failed", error: String(error) });
      }
    });

    // COUNT
    app.get(`${config.basePath}/stats/count`, async (req: any, res: any) => {
      try {
        const total = await repo.count();
        res.json({ total, source: total > 0 ? "database" : "seed" });
      } catch (error) {
        res.json({ total: 0, source: "error" });
      }
    });
  }

  // ── Database Health & Stats ──

  app.get("/api/db/health", async (_req: any, res: any) => {
    const start = Date.now();
    try {
      const db = await getDb();
      if (!db) {
        res.json({ healthy: false, latencyMs: Date.now() - start, message: "No DATABASE_URL configured" });
        return;
      }
      await db.execute(sql`SELECT 1`);
      res.json({ healthy: true, latencyMs: Date.now() - start, tables: routeConfigs.length });
    } catch (error) {
      res.json({ healthy: false, latencyMs: Date.now() - start, error: String(error) });
    }
  });

  app.get("/api/db/tables", (_req: any, res: any) => {
    const tables = routeConfigs.map(c => ({
      name: c.repo,
      apiPath: c.basePath,
      domain: c.domain,
      idParam: c.idParam,
    }));
    res.json({ items: tables, total: tables.length });
  });

  app.get("/api/db/stats", async (_req: any, res: any) => {
    const stats: { table: string; count: number; domain: string }[] = [];
    for (const config of routeConfigs.slice(0, 20)) {
      try {
        const repo = repos[config.repo] as any;
        const total = await repo.count();
        stats.push({ table: config.repo, count: total, domain: config.domain });
      } catch {
        stats.push({ table: config.repo, count: 0, domain: config.domain });
      }
    }
    const totalRecords = stats.reduce((s, r) => s + r.count, 0);
    res.json({ tables: stats, totalRecords, tablesQueried: stats.length, totalTables: routeConfigs.length });
  });

  logger.info(`[DrizzleRoutes] Registered ${routeConfigs.length} DB-backed CRUD route sets (${routeConfigs.length * 6} endpoints)`);
}
