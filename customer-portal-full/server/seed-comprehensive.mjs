#!/usr/bin/env node
/**
 * Comprehensive Database Seeding Script for InsurePortal (NGApp)
 * 
 * Seeds ALL 57 tables with realistic Nigerian insurance platform data.
 * Runs independently — requires only DATABASE_URL environment variable.
 * 
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:5432/db node server/seed-comprehensive.mjs
 *   
 * Options:
 *   --clean    Drop and recreate all tables before seeding
 *   --append   Append to existing data (default: upsert/skip conflicts)
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  pgTable, serial, varchar, text, timestamp, pgEnum, numeric, boolean, integer,
} from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Definitions (inline for standalone operation)
// ═══════════════════════════════════════════════════════════════════════════════

const roleEnum = pgEnum('role', ['user', 'admin']);
const policyTypeEnum = pgEnum('policy_type', ['Health', 'Auto', 'Property', 'Life', 'Group_Life', 'Microinsurance', 'Agricultural', 'Parametric']);
const policyStatusEnum = pgEnum('policy_status', ['Active', 'Expired', 'Cancelled', 'Pending', 'Suspended']);
const claimStatusEnum = pgEnum('claim_status', ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid', 'Escalated']);
const paymentStatusEnum = pgEnum('payment_status', ['Pending', 'Completed', 'Failed', 'Refunded', 'Partial']);
const referralStatusEnum = pgEnum('referral_status', ['Pending', 'Completed', 'Rewarded']);
const reviewTypeEnum = pgEnum('review_type', ['Agent', 'Service', 'Claim', 'Policy']);
const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high', 'critical']);
const fraudDecisionEnum = pgEnum('fraud_decision', ['allow', 'flag', 'review', 'block']);
const erpnextSyncStatusEnum = pgEnum('erpnext_sync_status', ['Pending', 'Synced', 'Failed', 'Conflict']);

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  policyNumber: varchar("policyNumber", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  type: policyTypeEnum("type").notNull(),
  premium: numeric("premium", { precision: 10, scale: 2 }).notNull(),
  status: policyStatusEnum("status").default("Active").notNull(),
  startDate: timestamp("startDate").notNull(),
  expiryDate: timestamp("expiryDate").notNull(),
  sumAssured: numeric("sumAssured", { precision: 15, scale: 2 }),
  coverageDetails: text("coverageDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  policyId: serial("policyId").notNull(),
  claimNumber: varchar("claimNumber", { length: 50 }).notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: claimStatusEnum("status").default("Submitted").notNull(),
  incidentDate: timestamp("incidentDate").notNull(),
  description: text("description").notNull(),
  fraudScore: numeric("fraudScore", { precision: 5, scale: 4 }),
  adjudicatorId: integer("adjudicatorId"),
  settlementAmount: numeric("settlementAmount", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  policyId: serial("policyId").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum("status").default("Pending").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  transactionRef: varchar("transactionRef", { length: 128 }),
  currency: varchar("currency", { length: 8 }).default("NGN"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: serial("referrerId").notNull(),
  referredUserId: serial("referredUserId"),
  referredEmail: varchar("referredEmail", { length: 320 }),
  referredPhone: varchar("referredPhone", { length: 20 }),
  referralCode: varchar("referralCode", { length: 20 }).notNull().unique(),
  status: referralStatusEnum("status").default("Pending").notNull(),
  rewardAmount: numeric("rewardAmount", { precision: 10, scale: 2 }).default("500.00").notNull(),
  rewardPaidDate: timestamp("rewardPaidDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  reviewType: reviewTypeEnum("reviewType").notNull(),
  entityId: serial("entityId").notNull(),
  rating: serial("rating").notNull(),
  comment: text("comment"),
  agentName: varchar("agentName", { length: 255 }),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const fraudScores = pgTable("fraud_scores", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  scoreId: varchar("scoreId", { length: 64 }).notNull().unique(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 128 }).notNull(),
  score: numeric("score", { precision: 5, scale: 4 }).notNull(),
  riskLevel: riskLevelEnum("riskLevel").notNull(),
  decision: fraudDecisionEnum("decision").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  processingTime: serial("processingTime").notNull(),
  topFactors: text("topFactors").array(),
  matchedRules: text("matchedRules").array(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const fraudRings = pgTable("fraud_rings", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  ringId: varchar("ringId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  memberCount: serial("memberCount").notNull().default(0),
  totalLoss: numeric("totalLoss", { precision: 15, scale: 2 }).default("0"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const fraudAlerts = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  alertId: varchar("alertId", { length: 64 }).notNull().unique(),
  severity: riskLevelEnum("severity").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 128 }).notNull(),
  message: text("message").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

const erpnextTransactions = pgTable("erpnext_transactions", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  erpDocType: varchar("erpDocType", { length: 64 }).notNull(),
  erpDocId: varchar("erpDocId", { length: 128 }).notNull(),
  localEntityType: varchar("localEntityType", { length: 64 }).notNull(),
  localEntityId: varchar("localEntityId", { length: 128 }).notNull(),
  syncStatus: erpnextSyncStatusEnum("syncStatus").default("Pending").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("NGN"),
  lastSyncAt: timestamp("lastSyncAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const erpnextReconciliation = pgTable("erpnext_reconciliation", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  period: varchar("period", { length: 7 }).notNull(),
  localAmount: numeric("localAmount", { precision: 15, scale: 2 }).notNull(),
  erpAmount: numeric("erpAmount", { precision: 15, scale: 2 }).notNull(),
  variance: numeric("variance", { precision: 15, scale: 2 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("Pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const premiumRateTables = pgTable("premium_rate_tables", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  productType: varchar("productType", { length: 64 }).notNull(),
  effectiveDate: timestamp("effectiveDate").notNull(),
  expiryDate: timestamp("expiryDate"),
  status: varchar("status", { length: 32 }).notNull().default("Active"),
  baseRate: numeric("baseRate", { precision: 8, scale: 4 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const premiumRiskFactors = pgTable("premium_risk_factors", {
  id: serial("id").primaryKey(),
  tableId: serial("tableId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  weight: numeric("weight", { precision: 5, scale: 4 }).notNull(),
  minValue: numeric("minValue", { precision: 10, scale: 4 }),
  maxValue: numeric("maxValue", { precision: 10, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const premiumRateChanges = pgTable("premium_rate_changes", {
  id: serial("id").primaryKey(),
  tableId: serial("tableId").notNull(),
  factorId: serial("factorId").notNull(),
  oldRate: numeric("oldRate", { precision: 8, scale: 4 }).notNull(),
  newRate: numeric("newRate", { precision: 8, scale: 4 }).notNull(),
  changedBy: serial("changedBy").notNull(),
  reason: text("reason").notNull(),
  effectiveDate: timestamp("effectiveDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const premiumRateAuditLogs = pgTable("premium_rate_audit_logs", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: serial("entityId").notNull(),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const brokerApiKeys = pgTable("broker_api_keys", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  apiKey: varchar("apiKey", { length: 64 }).notNull().unique(),
  permissions: text("permissions").array().notNull(),
  rateLimit: serial("rateLimit").notNull().default(1000),
  status: varchar("status", { length: 32 }).notNull().default("Active"),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const brokerApiUsage = pgTable("broker_api_usage", {
  id: serial("id").primaryKey(),
  keyId: serial("keyId").notNull(),
  userId: serial("userId").notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 8 }).notNull(),
  statusCode: serial("statusCode").notNull(),
  responseTimeMs: serial("responseTimeMs").notNull(),
  requestDate: timestamp("requestDate").defaultNow().notNull(),
});

const knowledgeGraphNodes = pgTable("knowledge_graph_nodes", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  nodeId: varchar("nodeId", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  properties: text("properties"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const knowledgeGraphEdges = pgTable("knowledge_graph_edges", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  sourceNodeId: varchar("sourceNodeId", { length: 128 }).notNull(),
  targetNodeId: varchar("targetNodeId", { length: 128 }).notNull(),
  relationship: varchar("relationship", { length: 128 }).notNull(),
  weight: numeric("weight", { precision: 5, scale: 4 }).default("1.0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const telcoCreditScores = pgTable("telco_credit_scores", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  score: serial("score").notNull(),
  grade: varchar("grade", { length: 2 }).notNull(),
  factors: text("factors").array(),
  consentGiven: boolean("consentGiven").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

const actuarialCalculations = pgTable("actuarial_calculations", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  calculationType: varchar("calculationType", { length: 64 }).notNull(),
  policyType: varchar("policyType", { length: 64 }),
  inputParams: text("inputParams"),
  result: numeric("result", { precision: 15, scale: 4 }),
  breakdown: text("breakdown"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const bancassurancePartners = pgTable("bancassurance_partners", {
  id: serial("id").primaryKey(),
  bankName: varchar("bankName", { length: 255 }).notNull(),
  bankCode: varchar("bankCode", { length: 20 }),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 4 }),
  products: text("products").array(),
  status: varchar("status", { length: 32 }).default("Active"),
  apiEndpoint: text("apiEndpoint"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const bancassuranceOffers = pgTable("bancassurance_offers", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  partnerId: serial("partnerId").notNull(),
  offerType: varchar("offerType", { length: 64 }).notNull(),
  premium: numeric("premium", { precision: 10, scale: 2 }),
  sumAssured: numeric("sumAssured", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Pending"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const groupLifeSchemes = pgTable("group_life_schemes", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  schemeName: varchar("schemeName", { length: 255 }).notNull(),
  employerName: varchar("employerName", { length: 255 }),
  employerId: varchar("employerId", { length: 64 }),
  schemeType: varchar("schemeType", { length: 32 }).default("contributory"),
  totalMembers: integer("totalMembers").default(0),
  totalSumAssured: numeric("totalSumAssured", { precision: 15, scale: 2 }),
  annualPremium: numeric("annualPremium", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Active"),
  renewalDate: timestamp("renewalDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const groupLifeMembers = pgTable("group_life_members", {
  id: serial("id").primaryKey(),
  schemeId: serial("schemeId").notNull(),
  memberName: varchar("memberName", { length: 255 }).notNull(),
  staffId: varchar("staffId", { length: 64 }),
  dateOfBirth: timestamp("dateOfBirth"),
  salary: numeric("salary", { precision: 15, scale: 2 }),
  sumAssured: numeric("sumAssured", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Active"),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
});

const nmidVerifications = pgTable("nmid_verifications", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  vehicleRegistration: varchar("vehicleRegistration", { length: 20 }).notNull(),
  chassisNumber: varchar("chassisNumber", { length: 64 }),
  engineNumber: varchar("engineNumber", { length: 64 }),
  vehicleMake: varchar("vehicleMake", { length: 64 }),
  vehicleModel: varchar("vehicleModel", { length: 64 }),
  vehicleYear: integer("vehicleYear"),
  ownerName: varchar("ownerName", { length: 255 }),
  verificationStatus: varchar("verificationStatus", { length: 32 }).default("pending"),
  nmidRef: varchar("nmidRef", { length: 128 }),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const pfaPartners = pgTable("pfa_partners", {
  id: serial("id").primaryKey(),
  pfaName: varchar("pfaName", { length: 255 }).notNull(),
  pfaCode: varchar("pfaCode", { length: 20 }),
  licenseNumber: varchar("licenseNumber", { length: 64 }),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 4 }),
  products: text("products").array(),
  status: varchar("status", { length: 32 }).default("Active"),
  apiEndpoint: text("apiEndpoint"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const pfaAnnuityQuotes = pgTable("pfa_annuity_quotes", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  pfaId: serial("pfaId").notNull(),
  rsaPin: varchar("rsaPin", { length: 32 }),
  retirementAge: integer("retirementAge"),
  accumulatedFund: numeric("accumulatedFund", { precision: 15, scale: 2 }),
  monthlyAnnuity: numeric("monthlyAnnuity", { precision: 10, scale: 2 }),
  annuityType: varchar("annuityType", { length: 64 }),
  quoteRef: varchar("quoteRef", { length: 128 }),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const reinsuranceTreaties = pgTable("reinsurance_treaties", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  treatyName: varchar("treatyName", { length: 255 }).notNull(),
  treatyType: varchar("treatyType", { length: 64 }).notNull(),
  reinsurer: varchar("reinsurer", { length: 255 }),
  reinsurerShare: numeric("reinsurerShare", { precision: 5, scale: 4 }),
  retentionLimit: numeric("retentionLimit", { precision: 15, scale: 2 }),
  coverLimit: numeric("coverLimit", { precision: 15, scale: 2 }),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 4 }),
  effectiveDate: timestamp("effectiveDate"),
  expiryDate: timestamp("expiryDate"),
  status: varchar("status", { length: 32 }).default("Active"),
  linesOfBusiness: text("linesOfBusiness").array(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const reinsuranceCessions = pgTable("reinsurance_cessions", {
  id: serial("id").primaryKey(),
  treatyId: serial("treatyId").notNull(),
  policyId: serial("policyId").notNull(),
  cedingAmount: numeric("cedingAmount", { precision: 15, scale: 2 }).notNull(),
  retainedAmount: numeric("retainedAmount", { precision: 15, scale: 2 }).notNull(),
  reinsurerPremium: numeric("reinsurerPremium", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Active"),
  cessionDate: timestamp("cessionDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  agentCode: varchar("agentCode", { length: 32 }).notNull().unique(),
  licenseNumber: varchar("licenseNumber", { length: 64 }),
  agencyName: varchar("agencyName", { length: 255 }),
  region: varchar("region", { length: 64 }),
  tier: varchar("tier", { length: 32 }).default("standard"),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 4 }),
  totalPoliciesSold: integer("totalPoliciesSold").default(0),
  totalPremiumCollected: numeric("totalPremiumCollected", { precision: 15, scale: 2 }).default("0"),
  status: varchar("status", { length: 32 }).default("Active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const agentCommissions = pgTable("agent_commissions", {
  id: serial("id").primaryKey(),
  agentId: serial("agentId").notNull(),
  policyId: serial("policyId").notNull(),
  commissionAmount: numeric("commissionAmount", { precision: 10, scale: 2 }).notNull(),
  commissionRate: numeric("commissionRate", { precision: 5, scale: 4 }).notNull(),
  status: varchar("status", { length: 32 }).default("Pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const kycVerifications = pgTable("kyc_verifications", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  verificationType: varchar("verificationType", { length: 32 }).notNull(),
  documentType: varchar("documentType", { length: 64 }),
  documentNumber: varchar("documentNumber", { length: 128 }),
  status: varchar("status", { length: 32 }).default("Pending"),
  verifiedAt: timestamp("verifiedAt"),
  expiresAt: timestamp("expiresAt"),
  riskScore: numeric("riskScore", { precision: 5, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const naicomFilings = pgTable("naicom_filings", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  filingType: varchar("filingType", { length: 64 }).notNull(),
  period: varchar("period", { length: 7 }).notNull(),
  status: varchar("status", { length: 32 }).default("Draft"),
  submittedAt: timestamp("submittedAt"),
  dueDate: timestamp("dueDate"),
  filingRef: varchar("filingRef", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  channel: varchar("channel", { length: 32 }).default("in_app"),
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: serial("userId"),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 128 }),
  properties: text("properties"),
  sessionId: varchar("sessionId", { length: 128 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const auditTrail = pgTable("audit_trail", {
  id: serial("id").primaryKey(),
  userId: serial("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 128 }),
  oldValues: text("oldValues"),
  newValues: text("newValues"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const loyaltyPoints = pgTable("loyalty_points", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  points: integer("points").notNull().default(0),
  tier: varchar("tier", { length: 32 }).default("Bronze"),
  totalEarned: integer("totalEarned").notNull().default(0),
  totalRedeemed: integer("totalRedeemed").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  points: integer("points").notNull(),
  transactionType: varchar("transactionType", { length: 32 }).notNull(),
  description: text("description"),
  referenceId: varchar("referenceId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const ussdSessions = pgTable("ussd_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 128 }).notNull().unique(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(),
  currentMenu: varchar("currentMenu", { length: 64 }),
  sessionData: text("sessionData"),
  status: varchar("status", { length: 32 }).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: integer("entityId"),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: integer("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  status: varchar("status", { length: 32 }).default("Active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const emergencyIncidents = pgTable("emergency_incidents", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  incidentType: varchar("incidentType", { length: 64 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  description: text("description"),
  status: varchar("status", { length: 32 }).default("Dispatched"),
  emergencyServices: text("emergencyServices").array(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const p2pPools = pgTable("p2p_pools", {
  id: serial("id").primaryKey(),
  poolName: varchar("poolName", { length: 255 }).notNull(),
  totalFund: numeric("totalFund", { precision: 15, scale: 2 }).default("0"),
  coveragePerMember: numeric("coveragePerMember", { precision: 15, scale: 2 }),
  monthlyContribution: numeric("monthlyContribution", { precision: 10, scale: 2 }),
  memberCount: integer("memberCount").default(0),
  status: varchar("status", { length: 32 }).default("Active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const p2pMemberships = pgTable("p2p_memberships", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  poolId: serial("poolId").notNull(),
  contribution: numeric("contribution", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Active"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

const microinsurancePolicies = pgTable("microinsurance_policies", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  productId: varchar("productId", { length: 64 }).notNull(),
  productName: varchar("productName", { length: 255 }),
  premium: numeric("premium", { precision: 10, scale: 2 }),
  coverage: numeric("coverage", { precision: 15, scale: 2 }),
  duration: integer("duration").notNull(),
  status: varchar("status", { length: 32 }).default("Active"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const gigCoveragePolicies = pgTable("gig_coverage_policies", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  planId: varchar("planId", { length: 64 }).notNull(),
  planName: varchar("planName", { length: 255 }),
  platform: varchar("platform", { length: 64 }),
  premium: numeric("premium", { precision: 10, scale: 2 }),
  coverage: numeric("coverage", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Active"),
  activatedAt: timestamp("activatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const smePolicies = pgTable("sme_policies", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  productId: varchar("productId", { length: 64 }).notNull(),
  businessName: varchar("businessName", { length: 255 }),
  businessType: varchar("businessType", { length: 64 }),
  annualPremium: numeric("annualPremium", { precision: 10, scale: 2 }),
  coverageAmount: numeric("coverageAmount", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const dynamicPricingHistory = pgTable("dynamic_pricing_history", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  productType: varchar("productType", { length: 64 }).notNull(),
  basePremium: numeric("basePremium", { precision: 10, scale: 2 }),
  adjustedPremium: numeric("adjustedPremium", { precision: 10, scale: 2 }),
  riskScore: integer("riskScore"),
  quoteId: varchar("quoteId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const savingsAccounts = pgTable("savings_accounts", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  planId: varchar("planId", { length: 64 }).notNull(),
  planName: varchar("planName", { length: 255 }),
  balance: numeric("balance", { precision: 15, scale: 2 }).default("0"),
  targetAmount: numeric("targetAmount", { precision: 15, scale: 2 }),
  interestRate: numeric("interestRate", { precision: 5, scale: 4 }),
  status: varchar("status", { length: 32 }).default("Active"),
  maturityDate: timestamp("maturityDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const mcmcResults = pgTable("mcmc_results", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  simulationId: varchar("simulationId", { length: 128 }).notNull(),
  iterations: integer("iterations"),
  meanLoss: numeric("meanLoss", { precision: 15, scale: 2 }),
  stdDev: numeric("stdDev", { precision: 15, scale: 2 }),
  var95: numeric("var95", { precision: 15, scale: 2 }),
  var99: numeric("var99", { precision: 15, scale: 2 }),
  processingTime: numeric("processingTime", { precision: 8, scale: 2 }),
  status: varchar("status", { length: 32 }).default("Completed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const familyMembers = pgTable("family_members", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  memberName: varchar("memberName", { length: 255 }).notNull(),
  relationship: varchar("relationship", { length: 64 }).notNull(),
  dateOfBirth: timestamp("dateOfBirth"),
  gender: varchar("gender", { length: 16 }),
  coveredPolicyId: integer("coveredPolicyId"),
  status: varchar("status", { length: 32 }).default("Active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const claimEvidence = pgTable("claim_evidence", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  claimId: integer("claimId").notNull(),
  evidenceType: varchar("evidenceType", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileUrl: text("fileUrl"),
  description: text("description"),
  status: varchar("status", { length: 32 }).default("Uploaded"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  direction: varchar("direction", { length: 16 }).notNull(),
  messageType: varchar("messageType", { length: 32 }).default("text"),
  content: text("content"),
  status: varchar("status", { length: 32 }).default("sent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const voiceSessions = pgTable("voice_sessions", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  language: varchar("language", { length: 8 }).default("en"),
  transcription: text("transcription"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  intent: varchar("intent", { length: 128 }),
  status: varchar("status", { length: 32 }).default("Completed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const insuranceApplications = pgTable("insurance_applications", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  applicationId: varchar("applicationId", { length: 128 }).notNull(),
  productType: varchar("productType", { length: 64 }),
  status: varchar("status", { length: 32 }).default("Draft"),
  currentStep: varchar("currentStep", { length: 64 }),
  totalSteps: integer("totalSteps").default(5),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

const customerFeedback = pgTable("customer_feedback", {
  id: serial("id").primaryKey(),
  userId: serial("userId").notNull(),
  feedbackType: varchar("feedbackType", { length: 64 }),
  subject: varchar("subject", { length: 255 }),
  message: text("message"),
  rating: integer("rating"),
  status: varchar("status", { length: 32 }).default("Open"),
  ticketId: varchar("ticketId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

const now = new Date();
const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
const daysFromNow = (d) => new Date(now.getTime() + d * 86400000);
const monthsAgo = (m) => daysAgo(m * 30);
const monthsFromNow = (m) => daysFromNow(m * 30);

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min, max, decimals = 2) {
  return (Math.random() * (max - min) + min).toFixed(decimals);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Seed Data
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    console.error("Usage: DATABASE_URL=postgres://user:pass@host:5432/db node server/seed-comprehensive.mjs");
    process.exit(1);
  }

  const doClean = process.argv.includes("--clean");

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("=== InsurePortal Comprehensive Database Seeder ===\n");

  if (doClean) {
    console.log("Cleaning existing data...");
    // Drop in reverse dependency order
    const tableNames = [
      "customer_feedback", "insurance_applications", "voice_sessions", "whatsapp_messages",
      "claim_evidence", "family_members", "mcmc_results", "savings_accounts",
      "dynamic_pricing_history", "sme_policies", "gig_coverage_policies", "microinsurance_policies",
      "p2p_memberships", "p2p_pools", "emergency_incidents", "documents", "ussd_sessions",
      "loyalty_transactions", "loyalty_points", "audit_trail", "analytics_events",
      "notifications", "naicom_filings", "kyc_verifications", "agent_commissions", "agents",
      "reinsurance_cessions", "reinsurance_treaties", "pfa_annuity_quotes", "pfa_partners",
      "nmid_verifications", "group_life_members", "group_life_schemes",
      "bancassurance_offers", "bancassurance_partners", "actuarial_calculations",
      "telco_credit_scores", "knowledge_graph_edges", "knowledge_graph_nodes",
      "broker_api_usage", "broker_api_keys", "premium_rate_audit_logs",
      "premium_rate_changes", "premium_risk_factors", "premium_rate_tables",
      "erpnext_reconciliation", "erpnext_transactions", "fraud_alerts", "fraud_rings",
      "fraud_scores", "reviews", "referrals", "payments", "claims", "policies", "users",
    ];
    for (const t of tableNames) {
      await client`DELETE FROM ${client(t)}`.catch(() => {});
    }
    console.log("  Cleaned all tables\n");
  }

  let seeded = 0;

  try {
    // ── 1. Users (10 users: 2 admin, 8 regular) ────────────────────────
    console.log("[1/56] Seeding users...");
    const usersData = [
      { openId: "seed-admin-001", name: "Adebayo Okonkwo", email: "adebayo.okonkwo@insureportal.ng", role: "admin", loginMethod: "email" },
      { openId: "seed-admin-002", name: "Chidinma Eze", email: "chidinma.eze@insureportal.ng", role: "admin", loginMethod: "email" },
      { openId: "seed-user-001", name: "Oluwaseun Adeyemi", email: "seun.adeyemi@gmail.com", role: "user", loginMethod: "google" },
      { openId: "seed-user-002", name: "Fatima Abdullahi", email: "fatima.abdullahi@yahoo.com", role: "user", loginMethod: "email" },
      { openId: "seed-user-003", name: "Chukwuemeka Nwosu", email: "emeka.nwosu@hotmail.com", role: "user", loginMethod: "email" },
      { openId: "seed-user-004", name: "Aisha Mohammed", email: "aisha.m@gmail.com", role: "user", loginMethod: "google" },
      { openId: "seed-user-005", name: "Tunde Bakare", email: "tunde.bakare@outlook.com", role: "user", loginMethod: "email" },
      { openId: "seed-user-006", name: "Ngozi Okafor", email: "ngozi.okafor@gmail.com", role: "user", loginMethod: "google" },
      { openId: "seed-user-007", name: "Ibrahim Suleiman", email: "ibrahim.s@yahoo.com", role: "user", loginMethod: "email" },
      { openId: "seed-user-008", name: "Blessing Ekwueme", email: "blessing.e@gmail.com", role: "user", loginMethod: "google" },
    ];
    const createdUsers = await db.insert(users).values(usersData).onConflictDoNothing().returning();
    const userIds = createdUsers.map(u => u.id);
    console.log(`  Created ${createdUsers.length} users`);
    seeded++;

    if (userIds.length === 0) {
      console.log("  No new users created (already exist). Fetching existing...");
      const existing = await client`SELECT id FROM users WHERE "openId" LIKE 'seed-%' ORDER BY id`;
      userIds.push(...existing.map(r => r.id));
    }

    const uid = (i = 0) => userIds[i % userIds.length];

    // ── 2. Policies (15 policies across all types) ─────────────────────
    console.log("[2/56] Seeding policies...");
    const policiesData = [
      { userId: uid(0), policyNumber: "POL-2026-001", name: "Comprehensive Health Cover", type: "Health", premium: "45000.00", status: "Active", startDate: monthsAgo(6), expiryDate: monthsFromNow(6), sumAssured: "5000000.00", coverageDetails: "Full medical, dental, optical. Family plan with 4 dependents." },
      { userId: uid(0), policyNumber: "POL-2026-002", name: "Third Party Auto Insurance", type: "Auto", premium: "18500.00", status: "Active", startDate: monthsAgo(3), expiryDate: monthsFromNow(9), sumAssured: "2000000.00", coverageDetails: "Third party liability + fire/theft. Toyota Camry 2022." },
      { userId: uid(1), policyNumber: "POL-2026-003", name: "Home Property Insurance", type: "Property", premium: "75000.00", status: "Active", startDate: monthsAgo(2), expiryDate: monthsFromNow(10), sumAssured: "50000000.00", coverageDetails: "Building + contents. Lekki Phase 1 property." },
      { userId: uid(2), policyNumber: "POL-2026-004", name: "Term Life Assurance", type: "Life", premium: "120000.00", status: "Active", startDate: monthsAgo(12), expiryDate: monthsFromNow(108), sumAssured: "100000000.00", coverageDetails: "20-year term. Death + total disability benefit." },
      { userId: uid(3), policyNumber: "POL-2026-005", name: "Group Life - Dangote Cement", type: "Group_Life", premium: "850000.00", status: "Active", startDate: monthsAgo(1), expiryDate: monthsFromNow(11), sumAssured: "500000000.00", coverageDetails: "250 employees. 3x annual salary coverage." },
      { userId: uid(4), policyNumber: "POL-2026-006", name: "Crop Insurance - Rice Farm", type: "Agricultural", premium: "35000.00", status: "Active", startDate: monthsAgo(4), expiryDate: monthsFromNow(8), sumAssured: "8000000.00", coverageDetails: "Flood/drought index. 50 hectares rice paddy, Kebbi State." },
      { userId: uid(5), policyNumber: "POL-2026-007", name: "Rainfall Parametric Cover", type: "Parametric", premium: "12000.00", status: "Active", startDate: monthsAgo(2), expiryDate: monthsFromNow(4), sumAssured: "3000000.00", coverageDetails: "Auto-payout if rainfall <60mm in 30-day period." },
      { userId: uid(6), policyNumber: "POL-2026-008", name: "Mobile Screen Protection", type: "Microinsurance", premium: "1500.00", status: "Active", startDate: monthsAgo(1), expiryDate: monthsFromNow(11), sumAssured: "150000.00", coverageDetails: "Screen damage + theft. iPhone 15 Pro." },
      { userId: uid(0), policyNumber: "POL-2026-009", name: "Comprehensive Auto - Range Rover", type: "Auto", premium: "250000.00", status: "Active", startDate: monthsAgo(8), expiryDate: monthsFromNow(4), sumAssured: "45000000.00", coverageDetails: "Comprehensive including third party, fire, theft, own damage." },
      { userId: uid(2), policyNumber: "POL-2026-010", name: "Health Insurance - Family", type: "Health", premium: "95000.00", status: "Pending", startDate: daysFromNow(15), expiryDate: monthsFromNow(12), sumAssured: "10000000.00", coverageDetails: "Platinum tier. International coverage + evacuation." },
      { userId: uid(3), policyNumber: "POL-2026-011", name: "Warehouse Property Cover", type: "Property", premium: "180000.00", status: "Active", startDate: monthsAgo(5), expiryDate: monthsFromNow(7), sumAssured: "200000000.00", coverageDetails: "Commercial warehouse. Apapa port area. Stock + building." },
      { userId: uid(7), policyNumber: "POL-2026-012", name: "Student Health Plan", type: "Health", premium: "8500.00", status: "Active", startDate: monthsAgo(2), expiryDate: monthsFromNow(10), sumAssured: "1000000.00", coverageDetails: "Basic medical for university student." },
      { userId: uid(5), policyNumber: "POL-2026-013", name: "Expired Auto Policy", type: "Auto", premium: "15000.00", status: "Expired", startDate: monthsAgo(14), expiryDate: monthsAgo(2), sumAssured: "1500000.00", coverageDetails: "Third party only. Honda Accord 2019." },
      { userId: uid(4), policyNumber: "POL-2026-014", name: "Cancelled Life Policy", type: "Life", premium: "60000.00", status: "Cancelled", startDate: monthsAgo(8), expiryDate: monthsAgo(1), sumAssured: "20000000.00", coverageDetails: "Cancelled due to non-payment of premium." },
      { userId: uid(6), policyNumber: "POL-2026-015", name: "Livestock Insurance - Cattle", type: "Agricultural", premium: "28000.00", status: "Active", startDate: monthsAgo(3), expiryDate: monthsFromNow(9), sumAssured: "12000000.00", coverageDetails: "200 head of cattle. Disease + theft. Kaduna ranch." },
    ];
    const createdPolicies = await db.insert(policies).values(policiesData).onConflictDoNothing().returning();
    const policyIds = createdPolicies.map(p => p.id);
    console.log(`  Created ${createdPolicies.length} policies`);
    seeded++;

    const pid = (i = 0) => policyIds[i % policyIds.length];

    // ── 3. Claims (12 claims across statuses) ──────────────────────────
    console.log("[3/56] Seeding claims...");
    const claimsData = [
      { userId: uid(0), policyId: pid(0), claimNumber: "CLM-2026-001", amount: "350000.00", status: "Approved", incidentDate: daysAgo(45), description: "Hospitalization for appendectomy at Lagos University Teaching Hospital", fraudScore: "0.0523", settlementAmount: "320000.00" },
      { userId: uid(0), policyId: pid(1), claimNumber: "CLM-2026-002", amount: "185000.00", status: "Under Review", incidentDate: daysAgo(12), description: "Rear-end collision on Third Mainland Bridge. Bumper and taillight damage.", fraudScore: "0.1200" },
      { userId: uid(1), policyId: pid(2), claimNumber: "CLM-2026-003", amount: "2500000.00", status: "Submitted", incidentDate: daysAgo(5), description: "Flood damage to ground floor from Lagos rainstorm. Furniture and electronics.", fraudScore: "0.0340" },
      { userId: uid(2), policyId: pid(3), claimNumber: "CLM-2026-004", amount: "100000000.00", status: "Escalated", incidentDate: daysAgo(90), description: "Death benefit claim. Accidental death of policyholder.", fraudScore: "0.4500", adjudicatorId: uid(0) },
      { userId: uid(4), policyId: pid(5), claimNumber: "CLM-2026-005", amount: "4200000.00", status: "Paid", incidentDate: daysAgo(60), description: "Crop failure due to drought. 50 hectares rice paddy completely lost.", fraudScore: "0.0120", settlementAmount: "4000000.00" },
      { userId: uid(5), policyId: pid(6), claimNumber: "CLM-2026-006", amount: "3000000.00", status: "Approved", incidentDate: daysAgo(30), description: "Parametric trigger: rainfall below 60mm threshold for 30 consecutive days.", fraudScore: "0.0010", settlementAmount: "3000000.00" },
      { userId: uid(6), policyId: pid(7), claimNumber: "CLM-2026-007", amount: "85000.00", status: "Rejected", incidentDate: daysAgo(20), description: "Phone screen crack. Pre-existing damage found during inspection.", fraudScore: "0.7800" },
      { userId: uid(0), policyId: pid(8), claimNumber: "CLM-2026-008", amount: "1800000.00", status: "Under Review", incidentDate: daysAgo(8), description: "Range Rover side panel dented in parking garage. Awaiting assessor report.", fraudScore: "0.2100", adjudicatorId: uid(1) },
      { userId: uid(3), policyId: pid(10), claimNumber: "CLM-2026-009", amount: "15000000.00", status: "Submitted", incidentDate: daysAgo(3), description: "Fire outbreak at warehouse. Partial stock loss estimated at 15M NGN.", fraudScore: "0.3200" },
      { userId: uid(7), policyId: pid(11), claimNumber: "CLM-2026-010", amount: "45000.00", status: "Approved", incidentDate: daysAgo(15), description: "Malaria treatment and hospitalization at private clinic.", fraudScore: "0.0200", settlementAmount: "42000.00" },
      { userId: uid(2), policyId: pid(9), claimNumber: "CLM-2026-011", amount: "750000.00", status: "Submitted", incidentDate: daysAgo(2), description: "Emergency surgery abroad. Medical evacuation from Lagos to London.", fraudScore: "0.0800" },
      { userId: uid(6), policyId: pid(14), claimNumber: "CLM-2026-012", amount: "6500000.00", status: "Paid", incidentDate: daysAgo(75), description: "Cattle disease outbreak. 45 head lost to anthrax. Veterinary report attached.", fraudScore: "0.0500", settlementAmount: "6200000.00" },
    ];
    const createdClaims = await db.insert(claims).values(claimsData).onConflictDoNothing().returning();
    const claimIds = createdClaims.map(c => c.id);
    console.log(`  Created ${createdClaims.length} claims`);
    seeded++;

    // ── 4. Payments (18 payments) ──────────────────────────────────────
    console.log("[4/56] Seeding payments...");
    const paymentsData = [
      { userId: uid(0), policyId: pid(0), amount: "45000.00", status: "Completed", dueDate: monthsAgo(6), paidDate: monthsAgo(6), paymentMethod: "Credit Card", transactionRef: "TXN-PAY-001", currency: "NGN" },
      { userId: uid(0), policyId: pid(1), amount: "18500.00", status: "Completed", dueDate: monthsAgo(3), paidDate: monthsAgo(3), paymentMethod: "Bank Transfer", transactionRef: "TXN-PAY-002", currency: "NGN" },
      { userId: uid(1), policyId: pid(2), amount: "75000.00", status: "Completed", dueDate: monthsAgo(2), paidDate: monthsAgo(2), paymentMethod: "Paystack", transactionRef: "TXN-PAY-003", currency: "NGN" },
      { userId: uid(2), policyId: pid(3), amount: "120000.00", status: "Completed", dueDate: monthsAgo(12), paidDate: monthsAgo(12), paymentMethod: "Flutterwave", transactionRef: "TXN-PAY-004", currency: "NGN" },
      { userId: uid(2), policyId: pid(3), amount: "120000.00", status: "Pending", dueDate: daysFromNow(15), paymentMethod: null, transactionRef: null, currency: "NGN" },
      { userId: uid(3), policyId: pid(4), amount: "850000.00", status: "Completed", dueDate: monthsAgo(1), paidDate: monthsAgo(1), paymentMethod: "Bank Transfer", transactionRef: "TXN-PAY-006", currency: "NGN" },
      { userId: uid(4), policyId: pid(5), amount: "35000.00", status: "Completed", dueDate: monthsAgo(4), paidDate: monthsAgo(4), paymentMethod: "USSD", transactionRef: "TXN-PAY-007", currency: "NGN" },
      { userId: uid(5), policyId: pid(6), amount: "12000.00", status: "Completed", dueDate: monthsAgo(2), paidDate: monthsAgo(2), paymentMethod: "Mobile Money", transactionRef: "TXN-PAY-008", currency: "NGN" },
      { userId: uid(6), policyId: pid(7), amount: "1500.00", status: "Completed", dueDate: monthsAgo(1), paidDate: monthsAgo(1), paymentMethod: "Debit Card", transactionRef: "TXN-PAY-009", currency: "NGN" },
      { userId: uid(0), policyId: pid(8), amount: "250000.00", status: "Completed", dueDate: monthsAgo(8), paidDate: monthsAgo(8), paymentMethod: "Bank Transfer", transactionRef: "TXN-PAY-010", currency: "NGN" },
      { userId: uid(0), policyId: pid(0), amount: "45000.00", status: "Pending", dueDate: daysFromNow(30), paymentMethod: null, transactionRef: null, currency: "NGN" },
      { userId: uid(7), policyId: pid(11), amount: "8500.00", status: "Completed", dueDate: monthsAgo(2), paidDate: monthsAgo(2), paymentMethod: "Paystack", transactionRef: "TXN-PAY-012", currency: "NGN" },
      { userId: uid(4), policyId: pid(13), amount: "60000.00", status: "Failed", dueDate: monthsAgo(3), paymentMethod: "Credit Card", transactionRef: "TXN-PAY-013", currency: "NGN" },
      { userId: uid(3), policyId: pid(10), amount: "180000.00", status: "Completed", dueDate: monthsAgo(5), paidDate: monthsAgo(5), paymentMethod: "Bank Transfer", transactionRef: "TXN-PAY-014", currency: "NGN" },
      { userId: uid(6), policyId: pid(14), amount: "28000.00", status: "Completed", dueDate: monthsAgo(3), paidDate: monthsAgo(3), paymentMethod: "USSD", transactionRef: "TXN-PAY-015", currency: "NGN" },
      { userId: uid(0), policyId: pid(8), amount: "250000.00", status: "Refunded", dueDate: monthsAgo(4), paidDate: monthsAgo(4), paymentMethod: "Bank Transfer", transactionRef: "TXN-PAY-016", currency: "NGN" },
      { userId: uid(5), policyId: pid(12), amount: "15000.00", status: "Completed", dueDate: monthsAgo(14), paidDate: monthsAgo(14), paymentMethod: "Debit Card", transactionRef: "TXN-PAY-017", currency: "NGN" },
      { userId: uid(2), policyId: pid(9), amount: "95000.00", status: "Partial", dueDate: monthsAgo(1), paidDate: daysAgo(25), paymentMethod: "Bank Transfer", transactionRef: "TXN-PAY-018", currency: "NGN" },
    ];
    await db.insert(payments).values(paymentsData).onConflictDoNothing();
    console.log(`  Created ${paymentsData.length} payments`);
    seeded++;

    // ── 5. Referrals ───────────────────────────────────────────────────
    console.log("[5/56] Seeding referrals...");
    const referralsData = [
      { referrerId: uid(0), referredUserId: uid(2), referredEmail: "emeka.nwosu@hotmail.com", referralCode: "REF-SEUN-001", status: "Rewarded", rewardAmount: "1000.00", rewardPaidDate: monthsAgo(2), completedAt: monthsAgo(3) },
      { referrerId: uid(0), referredUserId: uid(3), referredEmail: "aisha.m@gmail.com", referralCode: "REF-SEUN-002", status: "Completed", rewardAmount: "500.00", completedAt: daysAgo(15) },
      { referrerId: uid(2), referredEmail: "friend@example.com", referralCode: "REF-EMEK-001", status: "Pending", rewardAmount: "500.00" },
      { referrerId: uid(5), referredUserId: uid(7), referredPhone: "+2348012345678", referralCode: "REF-NGOZ-001", status: "Rewarded", rewardAmount: "750.00", rewardPaidDate: daysAgo(10), completedAt: daysAgo(20) },
      { referrerId: uid(4), referredEmail: "colleague@company.ng", referralCode: "REF-TUND-001", status: "Pending", rewardAmount: "500.00" },
    ];
    await db.insert(referrals).values(referralsData).onConflictDoNothing();
    console.log(`  Created ${referralsData.length} referrals`);
    seeded++;

    // ── 6. Reviews ─────────────────────────────────────────────────────
    console.log("[6/56] Seeding reviews...");
    const reviewsData = [
      { userId: uid(0), reviewType: "Service", entityId: 1, rating: 5, comment: "Excellent claims processing. Got my settlement within 48 hours!", agentName: "Adebayo Okonkwo" },
      { userId: uid(2), reviewType: "Agent", entityId: 1, rating: 4, comment: "Very knowledgeable agent. Helped me choose the right policy.", agentName: "Fatima Abdullahi" },
      { userId: uid(3), reviewType: "Claim", entityId: 1, rating: 3, comment: "Claim took longer than expected but was eventually resolved.", agentName: null },
      { userId: uid(5), reviewType: "Policy", entityId: 1, rating: 5, comment: "Parametric insurance is amazing! Automatic payout when it didn't rain.", agentName: null },
      { userId: uid(7), reviewType: "Service", entityId: 1, rating: 4, comment: "Good mobile app experience. Easy to manage policies on the go.", agentName: null },
      { userId: uid(4), reviewType: "Agent", entityId: 1, rating: 5, comment: "Tunde helped set up our group life scheme quickly and professionally.", agentName: "Chidinma Eze" },
      { userId: uid(6), reviewType: "Service", entityId: 1, rating: 2, comment: "USSD service needs improvement. Timed out twice during purchase.", agentName: null },
      { userId: uid(1), reviewType: "Policy", entityId: 1, rating: 4, comment: "Good coverage for the price. Would recommend to anyone in Lagos.", agentName: null },
    ];
    await db.insert(reviews).values(reviewsData).onConflictDoNothing();
    console.log(`  Created ${reviewsData.length} reviews`);
    seeded++;

    // ── 7-9. Fraud Detection ───────────────────────────────────────────
    console.log("[7/56] Seeding fraud_scores...");
    const fraudScoresData = [
      { userId: uid(0), scoreId: "FS-2026-001", entityType: "claim", entityId: "CLM-2026-001", score: "0.0523", riskLevel: "low", decision: "allow", confidence: "0.9800", processingTime: 45, topFactors: ["valid_hospital", "consistent_history", "known_provider"], matchedRules: [] },
      { userId: uid(0), scoreId: "FS-2026-002", entityType: "claim", entityId: "CLM-2026-002", score: "0.1200", riskLevel: "low", decision: "allow", confidence: "0.9200", processingTime: 52, topFactors: ["recent_policy", "first_auto_claim"], matchedRules: ["new_policy_review"] },
      { userId: uid(2), scoreId: "FS-2026-003", entityType: "claim", entityId: "CLM-2026-004", score: "0.4500", riskLevel: "high", decision: "review", confidence: "0.8500", processingTime: 120, topFactors: ["high_value_claim", "policy_age_ratio", "beneficiary_change"], matchedRules: ["high_value_escalation", "beneficiary_alert"] },
      { userId: uid(6), scoreId: "FS-2026-004", entityType: "claim", entityId: "CLM-2026-007", score: "0.7800", riskLevel: "critical", decision: "block", confidence: "0.9500", processingTime: 35, topFactors: ["pre_existing_damage", "photo_inconsistency", "timeline_anomaly"], matchedRules: ["photo_forensic_fail", "timeline_check"] },
      { userId: uid(3), scoreId: "FS-2026-005", entityType: "policy", entityId: "POL-2026-011", score: "0.3200", riskLevel: "medium", decision: "flag", confidence: "0.8800", processingTime: 88, topFactors: ["high_value_property", "recent_policy_increase"], matchedRules: ["value_increase_review"] },
    ];
    await db.insert(fraudScores).values(fraudScoresData).onConflictDoNothing();
    console.log(`  Created ${fraudScoresData.length} fraud scores`);
    seeded++;

    console.log("[8/56] Seeding fraud_rings...");
    const fraudRingsData = [
      { userId: uid(0), ringId: "FR-2026-001", name: "Lagos Auto Ring - Mushin Area", status: "active", memberCount: 7, totalLoss: "4500000.00", detectedAt: daysAgo(30) },
      { userId: uid(0), ringId: "FR-2026-002", name: "Staged Accident Network - Surulere", status: "investigating", memberCount: 12, totalLoss: "18000000.00", detectedAt: daysAgo(15) },
      { userId: uid(1), ringId: "FR-2026-003", name: "Medical Fraud Ring - Ikeja GRA", status: "resolved", memberCount: 4, totalLoss: "2800000.00", detectedAt: monthsAgo(3) },
    ];
    await db.insert(fraudRings).values(fraudRingsData).onConflictDoNothing();
    console.log(`  Created ${fraudRingsData.length} fraud rings`);
    seeded++;

    console.log("[9/56] Seeding fraud_alerts...");
    const fraudAlertsData = [
      { userId: uid(0), alertId: "FA-2026-001", severity: "critical", entityType: "claim", entityId: "CLM-2026-007", message: "Photo forensic analysis detected pre-existing screen damage. Claim appears fraudulent.", resolved: true, resolvedAt: daysAgo(18) },
      { userId: uid(0), alertId: "FA-2026-002", severity: "high", entityType: "claim", entityId: "CLM-2026-004", message: "Unusually high claim amount relative to policy age. Beneficiary changed 2 weeks before incident.", resolved: false },
      { userId: uid(0), alertId: "FA-2026-003", severity: "medium", entityType: "policy", entityId: "POL-2026-011", message: "Sum assured increased by 300% in last 60 days. Manual review recommended.", resolved: false },
      { userId: uid(1), alertId: "FA-2026-004", severity: "low", entityType: "claim", entityId: "CLM-2026-008", message: "Assessor report pending. Parking garage CCTV requested.", resolved: false },
      { userId: uid(0), alertId: "FA-2026-005", severity: "high", entityType: "ring", entityId: "FR-2026-002", message: "New members identified in staged accident network. 3 additional claims flagged.", resolved: false },
    ];
    await db.insert(fraudAlerts).values(fraudAlertsData).onConflictDoNothing();
    console.log(`  Created ${fraudAlertsData.length} fraud alerts`);
    seeded++;

    // ── 10-11. ERPNext Integration ─────────────────────────────────────
    console.log("[10/56] Seeding erpnext_transactions...");
    const erpTxns = [
      { userId: uid(0), erpDocType: "Sales Invoice", erpDocId: "SINV-2026-001", localEntityType: "payment", localEntityId: "TXN-PAY-001", syncStatus: "Synced", amount: "45000.00", lastSyncAt: daysAgo(1) },
      { userId: uid(0), erpDocType: "Sales Invoice", erpDocId: "SINV-2026-002", localEntityType: "payment", localEntityId: "TXN-PAY-002", syncStatus: "Synced", amount: "18500.00", lastSyncAt: daysAgo(1) },
      { userId: uid(0), erpDocType: "Journal Entry", erpDocId: "JV-2026-001", localEntityType: "claim_settlement", localEntityId: "CLM-2026-001", syncStatus: "Synced", amount: "320000.00", lastSyncAt: daysAgo(2) },
      { userId: uid(0), erpDocType: "Sales Invoice", erpDocId: "SINV-2026-003", localEntityType: "payment", localEntityId: "TXN-PAY-003", syncStatus: "Failed", amount: "75000.00", errorMessage: "ERPNext server timeout after 30s" },
      { userId: uid(0), erpDocType: "Journal Entry", erpDocId: "JV-2026-002", localEntityType: "commission", localEntityId: "COM-001", syncStatus: "Pending", amount: "8500.00" },
    ];
    await db.insert(erpnextTransactions).values(erpTxns).onConflictDoNothing();
    console.log(`  Created ${erpTxns.length} ERPNext transactions`);
    seeded++;

    console.log("[11/56] Seeding erpnext_reconciliation...");
    const erpRecon = [
      { userId: uid(0), period: "2026-01", localAmount: "2850000.00", erpAmount: "2850000.00", variance: "0.00", status: "Reconciled" },
      { userId: uid(0), period: "2026-02", localAmount: "3420000.00", erpAmount: "3395000.00", variance: "25000.00", status: "Variance" },
      { userId: uid(0), period: "2026-03", localAmount: "4100000.00", erpAmount: "4100000.00", variance: "0.00", status: "Reconciled" },
      { userId: uid(0), period: "2026-04", localAmount: "3780000.00", erpAmount: "3780000.00", variance: "0.00", status: "Reconciled" },
      { userId: uid(0), period: "2026-05", localAmount: "5200000.00", erpAmount: "5125000.00", variance: "75000.00", status: "Pending" },
    ];
    await db.insert(erpnextReconciliation).values(erpRecon).onConflictDoNothing();
    console.log(`  Created ${erpRecon.length} reconciliation records`);
    seeded++;

    // ── 12-15. Premium Rate Management ─────────────────────────────────
    console.log("[12/56] Seeding premium_rate_tables...");
    const rateTables = [
      { userId: uid(0), name: "Health Insurance Base Rates 2026", productType: "Health", effectiveDate: monthsAgo(6), expiryDate: monthsFromNow(6), status: "Active", baseRate: "0.0450" },
      { userId: uid(0), name: "Motor Third Party Rates 2026", productType: "Auto", effectiveDate: monthsAgo(3), expiryDate: monthsFromNow(9), status: "Active", baseRate: "0.0350" },
      { userId: uid(0), name: "Property Insurance Rates", productType: "Property", effectiveDate: monthsAgo(12), status: "Active", baseRate: "0.0200" },
      { userId: uid(0), name: "Life Assurance Mortality Tables", productType: "Life", effectiveDate: monthsAgo(24), status: "Active", baseRate: "0.0080" },
      { userId: uid(0), name: "Agricultural Crop Index", productType: "Agricultural", effectiveDate: monthsAgo(4), expiryDate: monthsFromNow(8), status: "Active", baseRate: "0.0600" },
    ];
    const createdRateTables = await db.insert(premiumRateTables).values(rateTables).onConflictDoNothing().returning();
    console.log(`  Created ${createdRateTables.length} rate tables`);
    seeded++;

    console.log("[13/56] Seeding premium_risk_factors...");
    const rtid = (i) => createdRateTables[i % createdRateTables.length]?.id || 1;
    const riskFactors = [
      { tableId: rtid(0), name: "Age", category: "demographic", weight: "0.3500", minValue: "18.0000", maxValue: "75.0000" },
      { tableId: rtid(0), name: "BMI", category: "health", weight: "0.2000", minValue: "15.0000", maxValue: "45.0000" },
      { tableId: rtid(0), name: "Smoking Status", category: "lifestyle", weight: "0.2500" },
      { tableId: rtid(1), name: "Vehicle Age", category: "vehicle", weight: "0.3000", minValue: "0.0000", maxValue: "25.0000" },
      { tableId: rtid(1), name: "Driver Experience", category: "driver", weight: "0.2500", minValue: "0.0000", maxValue: "40.0000" },
      { tableId: rtid(1), name: "Claims History", category: "history", weight: "0.4500", minValue: "0.0000", maxValue: "10.0000" },
      { tableId: rtid(2), name: "Location Risk Zone", category: "geography", weight: "0.4000", minValue: "1.0000", maxValue: "5.0000" },
      { tableId: rtid(2), name: "Building Age", category: "structure", weight: "0.3000", minValue: "0.0000", maxValue: "100.0000" },
      { tableId: rtid(4), name: "Rainfall Variability", category: "climate", weight: "0.5000", minValue: "0.0000", maxValue: "1.0000" },
      { tableId: rtid(4), name: "Soil Quality Index", category: "agricultural", weight: "0.3000", minValue: "0.0000", maxValue: "10.0000" },
    ];
    const createdFactors = await db.insert(premiumRiskFactors).values(riskFactors).onConflictDoNothing().returning();
    console.log(`  Created ${createdFactors.length} risk factors`);
    seeded++;

    console.log("[14/56] Seeding premium_rate_changes...");
    const fid = (i) => createdFactors[i % createdFactors.length]?.id || 1;
    const rateChanges = [
      { tableId: rtid(0), factorId: fid(0), oldRate: "0.0420", newRate: "0.0450", changedBy: uid(0), reason: "Annual actuarial review - increased health costs", effectiveDate: monthsAgo(1) },
      { tableId: rtid(1), factorId: fid(3), oldRate: "0.0320", newRate: "0.0350", changedBy: uid(0), reason: "Increased auto theft rates in Lagos", effectiveDate: monthsAgo(2) },
      { tableId: rtid(4), factorId: fid(8), oldRate: "0.0550", newRate: "0.0600", changedBy: uid(1), reason: "Climate change increasing drought risk", effectiveDate: monthsAgo(4) },
    ];
    await db.insert(premiumRateChanges).values(rateChanges).onConflictDoNothing();
    console.log(`  Created ${rateChanges.length} rate changes`);
    seeded++;

    console.log("[15/56] Seeding premium_rate_audit_logs...");
    const rateAuditLogs = [
      { userId: uid(0), action: "UPDATE_RATE", entityType: "rate_table", entityId: rtid(0), details: "Health base rate updated from 4.2% to 4.5%", ipAddress: "10.0.1.50" },
      { userId: uid(0), action: "UPDATE_RATE", entityType: "rate_table", entityId: rtid(1), details: "Auto base rate updated from 3.2% to 3.5%", ipAddress: "10.0.1.50" },
      { userId: uid(1), action: "CREATE_TABLE", entityType: "rate_table", entityId: rtid(4), details: "New agricultural crop index created", ipAddress: "10.0.1.51" },
      { userId: uid(0), action: "VIEW_REPORT", entityType: "rate_table", entityId: rtid(0), details: "Generated rate comparison report Q1 2026", ipAddress: "10.0.1.50" },
    ];
    await db.insert(premiumRateAuditLogs).values(rateAuditLogs).onConflictDoNothing();
    console.log(`  Created ${rateAuditLogs.length} rate audit logs`);
    seeded++;

    // ── 16-17. Broker API ──────────────────────────────────────────────
    console.log("[16/56] Seeding broker_api_keys...");
    const brokerKeys = [
      { userId: uid(0), name: "AXA Mansard Production Key", apiKey: "brk_live_axa_mansard_2026_prod", permissions: ["policies.read", "policies.create", "claims.submit", "quotes.generate"], rateLimit: 5000, status: "Active", lastUsedAt: daysAgo(1), expiresAt: monthsFromNow(12) },
      { userId: uid(0), name: "Leadway Assurance API", apiKey: "brk_live_leadway_2026_prod", permissions: ["policies.read", "quotes.generate"], rateLimit: 2000, status: "Active", lastUsedAt: daysAgo(3), expiresAt: monthsFromNow(6) },
      { userId: uid(0), name: "AIICO Insurance Integration", apiKey: "brk_live_aiico_2026_test", permissions: ["policies.read", "policies.create", "claims.submit", "claims.read", "payments.read"], rateLimit: 1000, status: "Active", expiresAt: monthsFromNow(3) },
      { userId: uid(1), name: "Deprecated Custodian Key", apiKey: "brk_live_custodian_2025_old", permissions: ["policies.read"], rateLimit: 500, status: "Revoked" },
    ];
    const createdBrokerKeys = await db.insert(brokerApiKeys).values(brokerKeys).onConflictDoNothing().returning();
    console.log(`  Created ${createdBrokerKeys.length} broker API keys`);
    seeded++;

    console.log("[17/56] Seeding broker_api_usage...");
    const bkid = (i) => createdBrokerKeys[i % createdBrokerKeys.length]?.id || 1;
    const apiUsage = Array.from({ length: 20 }, (_, i) => ({
      keyId: bkid(i % 3),
      userId: uid(0),
      endpoint: pick(["/api/v1/policies", "/api/v1/quotes", "/api/v1/claims", "/api/v1/payments", "/api/v1/customers"]),
      method: pick(["GET", "POST", "PUT"]),
      statusCode: pick([200, 200, 200, 201, 400, 500]),
      responseTimeMs: randomBetween(15, 450),
      requestDate: daysAgo(randomBetween(0, 30)),
    }));
    await db.insert(brokerApiUsage).values(apiUsage).onConflictDoNothing();
    console.log(`  Created ${apiUsage.length} API usage records`);
    seeded++;

    // ── 18-19. Knowledge Graph ─────────────────────────────────────────
    console.log("[18/56] Seeding knowledge_graph_nodes...");
    const kgNodes = [
      { userId: uid(0), nodeId: "customer-001", entityType: "customer", label: "Oluwaseun Adeyemi", properties: JSON.stringify({ age: 35, location: "Lagos", riskTier: "low" }) },
      { userId: uid(0), nodeId: "policy-001", entityType: "policy", label: "POL-2026-001 Health", properties: JSON.stringify({ type: "Health", premium: 45000, sumAssured: 5000000 }) },
      { userId: uid(0), nodeId: "claim-001", entityType: "claim", label: "CLM-2026-001 Medical", properties: JSON.stringify({ amount: 350000, status: "Approved" }) },
      { userId: uid(0), nodeId: "agent-001", entityType: "agent", label: "Adebayo Okonkwo", properties: JSON.stringify({ region: "Lagos", tier: "premium", policiesSold: 342 }) },
      { userId: uid(0), nodeId: "hospital-001", entityType: "provider", label: "Lagos University Teaching Hospital", properties: JSON.stringify({ type: "hospital", tier: 1 }) },
      { userId: uid(0), nodeId: "fraud-ring-001", entityType: "fraud_ring", label: "Lagos Auto Ring", properties: JSON.stringify({ memberCount: 7, status: "active" }) },
      { userId: uid(0), nodeId: "bank-001", entityType: "partner", label: "First Bank Nigeria", properties: JSON.stringify({ partnerType: "bancassurance" }) },
      { userId: uid(0), nodeId: "reinsurer-001", entityType: "reinsurer", label: "Africa Re", properties: JSON.stringify({ share: 0.30, region: "Pan-African" }) },
    ];
    await db.insert(knowledgeGraphNodes).values(kgNodes).onConflictDoNothing();
    console.log(`  Created ${kgNodes.length} knowledge graph nodes`);
    seeded++;

    console.log("[19/56] Seeding knowledge_graph_edges...");
    const kgEdges = [
      { userId: uid(0), sourceNodeId: "customer-001", targetNodeId: "policy-001", relationship: "HAS_POLICY", weight: "1.0000" },
      { userId: uid(0), sourceNodeId: "policy-001", targetNodeId: "claim-001", relationship: "HAS_CLAIM", weight: "1.0000" },
      { userId: uid(0), sourceNodeId: "agent-001", targetNodeId: "policy-001", relationship: "SOLD_POLICY", weight: "0.9500" },
      { userId: uid(0), sourceNodeId: "claim-001", targetNodeId: "hospital-001", relationship: "TREATED_AT", weight: "1.0000" },
      { userId: uid(0), sourceNodeId: "customer-001", targetNodeId: "agent-001", relationship: "MANAGED_BY", weight: "0.8000" },
      { userId: uid(0), sourceNodeId: "bank-001", targetNodeId: "customer-001", relationship: "REFERRED", weight: "0.7000" },
      { userId: uid(0), sourceNodeId: "policy-001", targetNodeId: "reinsurer-001", relationship: "REINSURED_BY", weight: "0.3000" },
    ];
    await db.insert(knowledgeGraphEdges).values(kgEdges).onConflictDoNothing();
    console.log(`  Created ${kgEdges.length} knowledge graph edges`);
    seeded++;

    // ── 20. Telco Credit Scores ────────────────────────────────────────
    console.log("[20/56] Seeding telco_credit_scores...");
    const telcoScores = [
      { userId: uid(0), phoneNumber: "+2348031234567", provider: "MTN", score: 720, grade: "A", factors: ["consistent_recharge", "5yr_subscriber", "postpaid_account"], consentGiven: true, expiresAt: monthsFromNow(3) },
      { userId: uid(2), phoneNumber: "+2348051234568", provider: "Glo", score: 650, grade: "B", factors: ["regular_data_usage", "3yr_subscriber"], consentGiven: true, expiresAt: monthsFromNow(3) },
      { userId: uid(3), phoneNumber: "+2348091234569", provider: "9mobile", score: 580, grade: "C", factors: ["prepaid_only", "irregular_recharge"], consentGiven: true, expiresAt: monthsFromNow(2) },
      { userId: uid(5), phoneNumber: "+2348071234570", provider: "Airtel", score: 780, grade: "A", factors: ["corporate_account", "10yr_subscriber", "high_usage"], consentGiven: true, expiresAt: monthsFromNow(6) },
      { userId: uid(7), phoneNumber: "+2348061234571", provider: "MTN", score: 490, grade: "D", factors: ["new_subscriber", "low_recharge"], consentGiven: false },
    ];
    await db.insert(telcoCreditScores).values(telcoScores).onConflictDoNothing();
    console.log(`  Created ${telcoScores.length} telco credit scores`);
    seeded++;

    // ── 21. Actuarial Calculations ─────────────────────────────────────
    console.log("[21/56] Seeding actuarial_calculations...");
    const actuarialCalcs = [
      { userId: uid(0), calculationType: "loss_ratio", policyType: "Health", inputParams: JSON.stringify({ period: "2026-Q1", premiumEarned: 125000000, claimsPaid: 87500000 }), result: "0.7000", breakdown: JSON.stringify({ lossRatio: 0.70, expenseRatio: 0.15, combinedRatio: 0.85 }) },
      { userId: uid(0), calculationType: "reserve_estimate", policyType: "Auto", inputParams: JSON.stringify({ method: "chain_ladder", triangleYears: 5 }), result: "45000000.0000", breakdown: JSON.stringify({ ibnr: 15000000, case_reserves: 30000000, total: 45000000 }) },
      { userId: uid(0), calculationType: "mortality_rate", policyType: "Life", inputParams: JSON.stringify({ ageGroup: "30-39", gender: "male", smoker: false }), result: "0.0012", breakdown: JSON.stringify({ baseRate: 0.0010, loading: 0.0002, finalRate: 0.0012 }) },
      { userId: uid(1), calculationType: "premium_adequacy", policyType: "Property", inputParams: JSON.stringify({ zoneName: "Lagos Island", buildingClass: "A" }), result: "0.0185", breakdown: JSON.stringify({ pureRisk: 0.012, expenses: 0.004, profit: 0.0025, finalRate: 0.0185 }) },
      { userId: uid(0), calculationType: "catastrophe_model", policyType: "Agricultural", inputParams: JSON.stringify({ peril: "flood", region: "South-South", returnPeriod: 100 }), result: "2500000000.0000", breakdown: JSON.stringify({ aep_100: 2500000000, oep_100: 1800000000, aal: 450000000 }) },
    ];
    await db.insert(actuarialCalculations).values(actuarialCalcs).onConflictDoNothing();
    console.log(`  Created ${actuarialCalcs.length} actuarial calculations`);
    seeded++;

    // ── 22-23. Bancassurance ───────────────────────────────────────────
    console.log("[22/56] Seeding bancassurance_partners...");
    const bancPartners = [
      { bankName: "First Bank of Nigeria", bankCode: "011", commissionRate: "0.0800", products: ["Health", "Life", "Property"], status: "Active", apiEndpoint: "https://api.firstbanknigeria.com/insurance/v2" },
      { bankName: "GTBank", bankCode: "058", commissionRate: "0.0750", products: ["Health", "Auto", "Life"], status: "Active", apiEndpoint: "https://api.gtbank.com/bancassurance/v1" },
      { bankName: "Zenith Bank", bankCode: "057", commissionRate: "0.0900", products: ["Health", "Life", "Microinsurance"], status: "Active", apiEndpoint: "https://api.zenithbank.com/insurance/v1" },
      { bankName: "Access Bank", bankCode: "044", commissionRate: "0.0700", products: ["Auto", "Property"], status: "Inactive" },
    ];
    const createdBancPartners = await db.insert(bancassurancePartners).values(bancPartners).onConflictDoNothing().returning();
    console.log(`  Created ${createdBancPartners.length} bancassurance partners`);
    seeded++;

    console.log("[23/56] Seeding bancassurance_offers...");
    const bpid = (i) => createdBancPartners[i % createdBancPartners.length]?.id || 1;
    const bancOffers = [
      { userId: uid(0), partnerId: bpid(0), offerType: "Health", premium: "35000.00", sumAssured: "3000000.00", status: "Accepted", expiresAt: monthsFromNow(1) },
      { userId: uid(2), partnerId: bpid(1), offerType: "Auto", premium: "22000.00", sumAssured: "2500000.00", status: "Pending", expiresAt: daysFromNow(14) },
      { userId: uid(5), partnerId: bpid(2), offerType: "Life", premium: "80000.00", sumAssured: "50000000.00", status: "Pending", expiresAt: daysFromNow(7) },
      { userId: uid(3), partnerId: bpid(0), offerType: "Property", premium: "55000.00", sumAssured: "30000000.00", status: "Expired" },
    ];
    await db.insert(bancassuranceOffers).values(bancOffers).onConflictDoNothing();
    console.log(`  Created ${bancOffers.length} bancassurance offers`);
    seeded++;

    // ── 24-25. Group Life Administration ───────────────────────────────
    console.log("[24/56] Seeding group_life_schemes...");
    const groupSchemes = [
      { userId: uid(0), schemeName: "Dangote Cement Staff Scheme", employerName: "Dangote Cement Plc", employerId: "RC-12345", schemeType: "contributory", totalMembers: 250, totalSumAssured: "500000000.00", annualPremium: "850000.00", status: "Active", renewalDate: monthsFromNow(11) },
      { userId: uid(0), schemeName: "MTN Nigeria Group Life", employerName: "MTN Nigeria Communications", employerId: "RC-67890", schemeType: "non-contributory", totalMembers: 1200, totalSumAssured: "2400000000.00", annualPremium: "4200000.00", status: "Active", renewalDate: monthsFromNow(8) },
      { userId: uid(1), schemeName: "Zenith Bank Staff Cover", employerName: "Zenith Bank Plc", employerId: "RC-11111", schemeType: "contributory", totalMembers: 800, totalSumAssured: "1600000000.00", annualPremium: "2800000.00", status: "Active", renewalDate: monthsFromNow(5) },
    ];
    const createdSchemes = await db.insert(groupLifeSchemes).values(groupSchemes).onConflictDoNothing().returning();
    console.log(`  Created ${createdSchemes.length} group life schemes`);
    seeded++;

    console.log("[25/56] Seeding group_life_members...");
    const sid = (i) => createdSchemes[i % createdSchemes.length]?.id || 1;
    const groupMembers = [
      { schemeId: sid(0), memberName: "Ahmed Bello", staffId: "DCC-001", dateOfBirth: new Date("1985-03-15"), salary: "450000.00", sumAssured: "1350000.00", status: "Active" },
      { schemeId: sid(0), memberName: "Grace Obi", staffId: "DCC-002", dateOfBirth: new Date("1990-07-22"), salary: "380000.00", sumAssured: "1140000.00", status: "Active" },
      { schemeId: sid(1), memberName: "Musa Danjuma", staffId: "MTN-101", dateOfBirth: new Date("1988-11-10"), salary: "650000.00", sumAssured: "1950000.00", status: "Active" },
      { schemeId: sid(1), memberName: "Lola Adekunle", staffId: "MTN-102", dateOfBirth: new Date("1992-01-28"), salary: "520000.00", sumAssured: "1560000.00", status: "Active" },
      { schemeId: sid(2), memberName: "Chidi Amaechi", staffId: "ZNB-201", dateOfBirth: new Date("1987-09-05"), salary: "780000.00", sumAssured: "2340000.00", status: "Active" },
      { schemeId: sid(0), memberName: "Hauwa Garba", staffId: "DCC-003", dateOfBirth: new Date("1995-04-18"), salary: "320000.00", sumAssured: "960000.00", status: "On Leave" },
    ];
    await db.insert(groupLifeMembers).values(groupMembers).onConflictDoNothing();
    console.log(`  Created ${groupMembers.length} group life members`);
    seeded++;

    // ── 26. NMID Verifications ─────────────────────────────────────────
    console.log("[26/56] Seeding nmid_verifications...");
    const nmidData = [
      { userId: uid(0), vehicleRegistration: "LAG-234-ABC", chassisNumber: "JTDKN3DU5A0123456", engineNumber: "2GR-FE-78901", vehicleMake: "Toyota", vehicleModel: "Camry", vehicleYear: 2022, ownerName: "Oluwaseun Adeyemi", verificationStatus: "verified", nmidRef: "NMID-2026-00123", verifiedAt: daysAgo(30) },
      { userId: uid(0), vehicleRegistration: "ABJ-789-DEF", chassisNumber: "SALGA2BF7LA654321", engineNumber: "508PS-45678", vehicleMake: "Range Rover", vehicleModel: "Sport", vehicleYear: 2024, ownerName: "Oluwaseun Adeyemi", verificationStatus: "verified", nmidRef: "NMID-2026-00456", verifiedAt: daysAgo(60) },
      { userId: uid(2), vehicleRegistration: "KAN-456-GHI", chassisNumber: "WBAPH5C55BA112233", engineNumber: "N55B30A-34567", vehicleMake: "BMW", vehicleModel: "535i", vehicleYear: 2020, ownerName: "Chukwuemeka Nwosu", verificationStatus: "pending", nmidRef: null },
      { userId: uid(5), vehicleRegistration: "LAG-112-JKL", chassisNumber: "MHKA3A12345678901", engineNumber: "1NR-FE-56789", vehicleMake: "Honda", vehicleModel: "Accord", vehicleYear: 2019, ownerName: "Ngozi Okafor", verificationStatus: "failed", nmidRef: null },
    ];
    await db.insert(nmidVerifications).values(nmidData).onConflictDoNothing();
    console.log(`  Created ${nmidData.length} NMID verifications`);
    seeded++;

    // ── 27-28. PFA Integration ─────────────────────────────────────────
    console.log("[27/56] Seeding pfa_partners...");
    const pfaData = [
      { pfaName: "ARM Pension Managers", pfaCode: "PFA001", licenseNumber: "PEN/PFA/01/2005", commissionRate: "0.0250", products: ["Contributory Pension", "Voluntary Contribution", "Micro Pension"], status: "Active", apiEndpoint: "https://api.armpension.com/v2" },
      { pfaName: "Stanbic IBTC Pension", pfaCode: "PFA002", licenseNumber: "PEN/PFA/02/2005", commissionRate: "0.0200", products: ["RSA", "Retiree Fund", "Annuity"], status: "Active", apiEndpoint: "https://api.stanbicibtcpension.com/v1" },
      { pfaName: "Leadway Pensure", pfaCode: "PFA003", licenseNumber: "PEN/PFA/03/2005", commissionRate: "0.0225", products: ["RSA", "Micro Pension"], status: "Active" },
    ];
    const createdPfa = await db.insert(pfaPartners).values(pfaData).onConflictDoNothing().returning();
    console.log(`  Created ${createdPfa.length} PFA partners`);
    seeded++;

    console.log("[28/56] Seeding pfa_annuity_quotes...");
    const pfaid = (i) => createdPfa[i % createdPfa.length]?.id || 1;
    const annuityQuotes = [
      { userId: uid(4), pfaId: pfaid(0), rsaPin: "PEN100234567890", retirementAge: 60, accumulatedFund: "45000000.00", monthlyAnnuity: "250000.00", annuityType: "Life Annuity", quoteRef: "AQ-2026-001", validUntil: daysFromNow(30) },
      { userId: uid(6), pfaId: pfaid(1), rsaPin: "PEN100987654321", retirementAge: 65, accumulatedFund: "85000000.00", monthlyAnnuity: "420000.00", annuityType: "Period Certain", quoteRef: "AQ-2026-002", validUntil: daysFromNow(14) },
      { userId: uid(2), pfaId: pfaid(2), rsaPin: "PEN100555666777", retirementAge: 55, accumulatedFund: "22000000.00", monthlyAnnuity: "135000.00", annuityType: "Life Annuity", quoteRef: "AQ-2026-003", validUntil: daysFromNow(21) },
    ];
    await db.insert(pfaAnnuityQuotes).values(annuityQuotes).onConflictDoNothing();
    console.log(`  Created ${annuityQuotes.length} annuity quotes`);
    seeded++;

    // ── 29-30. Reinsurance Management ──────────────────────────────────
    console.log("[29/56] Seeding reinsurance_treaties...");
    const treaties = [
      { userId: uid(0), treatyName: "Quota Share - Africa Re", treatyType: "Quota Share", reinsurer: "Africa Re", reinsurerShare: "0.3000", retentionLimit: "50000000.00", coverLimit: "500000000.00", commissionRate: "0.3200", effectiveDate: monthsAgo(12), expiryDate: monthsFromNow(0), status: "Active", linesOfBusiness: ["Health", "Life", "Property"] },
      { userId: uid(0), treatyName: "Excess of Loss - Munich Re", treatyType: "Excess of Loss", reinsurer: "Munich Re", reinsurerShare: "0.7000", retentionLimit: "100000000.00", coverLimit: "2000000000.00", commissionRate: "0.2500", effectiveDate: monthsAgo(6), expiryDate: monthsFromNow(6), status: "Active", linesOfBusiness: ["Property", "Agricultural"] },
      { userId: uid(0), treatyName: "Catastrophe XL - Swiss Re", treatyType: "Cat XL", reinsurer: "Swiss Re", reinsurerShare: "0.9000", retentionLimit: "500000000.00", coverLimit: "10000000000.00", commissionRate: "0.1500", effectiveDate: monthsAgo(3), expiryDate: monthsFromNow(9), status: "Active", linesOfBusiness: ["Agricultural", "Parametric"] },
    ];
    const createdTreaties = await db.insert(reinsuranceTreaties).values(treaties).onConflictDoNothing().returning();
    console.log(`  Created ${createdTreaties.length} reinsurance treaties`);
    seeded++;

    console.log("[30/56] Seeding reinsurance_cessions...");
    const tid = (i) => createdTreaties[i % createdTreaties.length]?.id || 1;
    const cessions = [
      { treatyId: tid(0), policyId: pid(0), cedingAmount: "1500000.00", retainedAmount: "3500000.00", reinsurerPremium: "13500.00", status: "Active" },
      { treatyId: tid(0), policyId: pid(3), cedingAmount: "30000000.00", retainedAmount: "70000000.00", reinsurerPremium: "36000.00", status: "Active" },
      { treatyId: tid(1), policyId: pid(2), cedingAmount: "35000000.00", retainedAmount: "15000000.00", reinsurerPremium: "52500.00", status: "Active" },
      { treatyId: tid(2), policyId: pid(5), cedingAmount: "7200000.00", retainedAmount: "800000.00", reinsurerPremium: "31500.00", status: "Active" },
    ];
    await db.insert(reinsuranceCessions).values(cessions).onConflictDoNothing();
    console.log(`  Created ${cessions.length} reinsurance cessions`);
    seeded++;

    // ── 31-32. Agent Management ────────────────────────────────────────
    console.log("[31/56] Seeding agents...");
    const agentsData = [
      { userId: uid(0), agentCode: "AGT-LAG-001", licenseNumber: "NAICOM/AG/2024/001", agencyName: "Adeyemi Insurance Brokers", region: "Lagos", tier: "premium", commissionRate: "0.1200", totalPoliciesSold: 342, totalPremiumCollected: "85000000.00", status: "Active" },
      { userId: uid(1), agentCode: "AGT-ABJ-001", licenseNumber: "NAICOM/AG/2024/002", agencyName: "Eze & Partners Assurance", region: "Abuja", tier: "gold", commissionRate: "0.1000", totalPoliciesSold: 189, totalPremiumCollected: "42000000.00", status: "Active" },
      { userId: uid(4), agentCode: "AGT-KAN-001", licenseNumber: "NAICOM/AG/2024/003", agencyName: "Bakare Insurance Services", region: "Kano", tier: "standard", commissionRate: "0.0800", totalPoliciesSold: 78, totalPremiumCollected: "12500000.00", status: "Active" },
      { userId: uid(6), agentCode: "AGT-PH-001", licenseNumber: "NAICOM/AG/2024/004", agencyName: "Suleiman Assurance", region: "Port Harcourt", tier: "standard", commissionRate: "0.0800", totalPoliciesSold: 45, totalPremiumCollected: "8200000.00", status: "Suspended" },
    ];
    const createdAgents = await db.insert(agents).values(agentsData).onConflictDoNothing().returning();
    console.log(`  Created ${createdAgents.length} agents`);
    seeded++;

    console.log("[32/56] Seeding agent_commissions...");
    const agid = (i) => createdAgents[i % createdAgents.length]?.id || 1;
    const commissions = [
      { agentId: agid(0), policyId: pid(0), commissionAmount: "5400.00", commissionRate: "0.1200", status: "Paid", paidAt: monthsAgo(5) },
      { agentId: agid(0), policyId: pid(1), commissionAmount: "2220.00", commissionRate: "0.1200", status: "Paid", paidAt: monthsAgo(2) },
      { agentId: agid(0), policyId: pid(8), commissionAmount: "30000.00", commissionRate: "0.1200", status: "Paid", paidAt: monthsAgo(7) },
      { agentId: agid(1), policyId: pid(2), commissionAmount: "7500.00", commissionRate: "0.1000", status: "Pending" },
      { agentId: agid(1), policyId: pid(3), commissionAmount: "12000.00", commissionRate: "0.1000", status: "Paid", paidAt: monthsAgo(11) },
      { agentId: agid(2), policyId: pid(5), commissionAmount: "2800.00", commissionRate: "0.0800", status: "Pending" },
      { agentId: agid(2), policyId: pid(14), commissionAmount: "2240.00", commissionRate: "0.0800", status: "Paid", paidAt: monthsAgo(2) },
    ];
    await db.insert(agentCommissions).values(commissions).onConflictDoNothing();
    console.log(`  Created ${commissions.length} agent commissions`);
    seeded++;

    // ── 33. KYC Verifications ──────────────────────────────────────────
    console.log("[33/56] Seeding kyc_verifications...");
    const kycData = [
      { userId: uid(0), verificationType: "KYC", documentType: "NIN", documentNumber: "12345678901", status: "Verified", verifiedAt: monthsAgo(6), expiresAt: monthsFromNow(18), riskScore: "0.0500" },
      { userId: uid(0), verificationType: "KYC", documentType: "BVN", documentNumber: "22345678901", status: "Verified", verifiedAt: monthsAgo(6), expiresAt: monthsFromNow(18), riskScore: "0.0300" },
      { userId: uid(2), verificationType: "KYC", documentType: "International Passport", documentNumber: "A12345678", status: "Verified", verifiedAt: monthsAgo(3), expiresAt: monthsFromNow(21), riskScore: "0.0800" },
      { userId: uid(3), verificationType: "KYB", documentType: "CAC Certificate", documentNumber: "RC-12345", status: "Verified", verifiedAt: monthsAgo(1), expiresAt: monthsFromNow(23), riskScore: "0.1200" },
      { userId: uid(5), verificationType: "KYC", documentType: "Voters Card", documentNumber: "VING-12345", status: "Pending", riskScore: "0.2500" },
      { userId: uid(7), verificationType: "KYC", documentType: "NIN", documentNumber: "98765432100", status: "Rejected", riskScore: "0.6500" },
      { userId: uid(4), verificationType: "KYC", documentType: "Drivers License", documentNumber: "DL-LAG-2022-12345", status: "Verified", verifiedAt: monthsAgo(4), expiresAt: monthsFromNow(8), riskScore: "0.0400" },
      { userId: uid(6), verificationType: "Liveness", documentType: "Selfie", documentNumber: null, status: "Verified", verifiedAt: daysAgo(10), riskScore: "0.0200" },
    ];
    await db.insert(kycVerifications).values(kycData).onConflictDoNothing();
    console.log(`  Created ${kycData.length} KYC verifications`);
    seeded++;

    // ── 34. NAICOM Filings ─────────────────────────────────────────────
    console.log("[34/56] Seeding naicom_filings...");
    const naicomData = [
      { userId: uid(0), filingType: "Quarterly Returns", period: "2026-Q1", status: "Submitted", submittedAt: daysAgo(45), dueDate: daysAgo(30), filingRef: "NAICOM-2026-Q1-001" },
      { userId: uid(0), filingType: "Annual Financial Statement", period: "2025-FY", status: "Accepted", submittedAt: monthsAgo(4), dueDate: monthsAgo(3), filingRef: "NAICOM-2025-FY-001" },
      { userId: uid(0), filingType: "Quarterly Returns", period: "2026-Q2", status: "Draft", dueDate: daysFromNow(15), filingRef: "NAICOM-2026-Q2-001" },
      { userId: uid(0), filingType: "Solvency Report", period: "2026-H1", status: "In Progress", dueDate: daysFromNow(30), filingRef: "NAICOM-2026-H1-SOL" },
      { userId: uid(1), filingType: "Risk-Based Capital", period: "2026-Q1", status: "Submitted", submittedAt: daysAgo(40), dueDate: daysAgo(30), filingRef: "NAICOM-2026-Q1-RBC" },
    ];
    await db.insert(naicomFilings).values(naicomData).onConflictDoNothing();
    console.log(`  Created ${naicomData.length} NAICOM filings`);
    seeded++;

    // ── 35. Notifications ──────────────────────────────────────────────
    console.log("[35/56] Seeding notifications...");
    const notifs = [
      { userId: uid(0), title: "Claim Approved", message: "Your health insurance claim CLM-2026-001 for ₦350,000 has been approved. Settlement of ₦320,000 will be credited within 48 hours.", type: "claim", channel: "in_app", isRead: true, readAt: daysAgo(40) },
      { userId: uid(0), title: "Payment Due", message: "Your Health Insurance premium of ₦45,000 is due in 30 days. Set up auto-debit to never miss a payment.", type: "payment", channel: "in_app", isRead: false },
      { userId: uid(0), title: "Policy Renewal Reminder", message: "Your Range Rover Comprehensive Auto Insurance expires in 4 months. Renew early and save 5%.", type: "policy", channel: "in_app", isRead: false },
      { userId: uid(2), title: "KYC Verified", message: "Your international passport has been verified. You now have full access to all insurance products.", type: "kyc", channel: "in_app", isRead: true, readAt: monthsAgo(3) },
      { userId: uid(5), title: "Parametric Payout Triggered", message: "Rainfall below threshold detected. Your parametric insurance payout of ₦3,000,000 has been auto-approved.", type: "claim", channel: "push", isRead: true, readAt: daysAgo(28) },
      { userId: uid(3), title: "New Bancassurance Offer", message: "First Bank has a special health insurance offer for you: ₦35,000/year for ₦3M coverage. View offer now.", type: "offer", channel: "in_app", isRead: false },
      { userId: uid(7), title: "Welcome to InsurePortal", message: "Welcome aboard! Complete your KYC verification to unlock all features. Start with your NIN.", type: "onboarding", channel: "in_app", isRead: false },
      { userId: uid(4), title: "Commission Paid", message: "Your commission of ₦2,800 for crop insurance policy has been credited to your account.", type: "commission", channel: "email", isRead: true, readAt: daysAgo(5) },
    ];
    await db.insert(notifications).values(notifs).onConflictDoNothing();
    console.log(`  Created ${notifs.length} notifications`);
    seeded++;

    // ── 36. Analytics Events ───────────────────────────────────────────
    console.log("[36/56] Seeding analytics_events...");
    const events = Array.from({ length: 30 }, (_, i) => ({
      userId: uid(i % 8),
      eventType: pick(["page_view", "policy_viewed", "claim_submitted", "payment_made", "quote_generated", "search", "login", "logout"]),
      entityType: pick(["policy", "claim", "payment", "page", "user", null]),
      entityId: pick(["POL-2026-001", "CLM-2026-001", "dashboard", "marketplace", null]),
      properties: JSON.stringify({ browser: pick(["Chrome", "Safari", "Firefox"]), device: pick(["mobile", "desktop", "tablet"]), duration_ms: randomBetween(500, 30000) }),
      sessionId: `sess_${Date.now()}_${i}`,
      ipAddress: `10.0.${randomBetween(1, 255)}.${randomBetween(1, 255)}`,
      createdAt: daysAgo(randomBetween(0, 90)),
    }));
    await db.insert(analyticsEvents).values(events).onConflictDoNothing();
    console.log(`  Created ${events.length} analytics events`);
    seeded++;

    // ── 37. Audit Trail ────────────────────────────────────────────────
    console.log("[37/56] Seeding audit_trail...");
    const auditEntries = [
      { userId: uid(0), action: "CREATE", entityType: "policy", entityId: "POL-2026-001", newValues: JSON.stringify({ type: "Health", premium: 45000 }), ipAddress: "10.0.1.50", userAgent: "Mozilla/5.0 Chrome/120" },
      { userId: uid(0), action: "UPDATE", entityType: "claim", entityId: "CLM-2026-001", oldValues: JSON.stringify({ status: "Submitted" }), newValues: JSON.stringify({ status: "Approved" }), ipAddress: "10.0.1.50" },
      { userId: uid(1), action: "CREATE", entityType: "user", entityId: "seed-user-008", newValues: JSON.stringify({ name: "Blessing Ekwueme", role: "user" }), ipAddress: "10.0.1.51" },
      { userId: uid(0), action: "UPDATE", entityType: "premium_rate", entityId: "1", oldValues: JSON.stringify({ baseRate: 0.042 }), newValues: JSON.stringify({ baseRate: 0.045 }), ipAddress: "10.0.1.50" },
      { userId: uid(0), action: "DELETE", entityType: "notification", entityId: "old-notif-001", ipAddress: "10.0.1.50" },
      { userId: uid(1), action: "EXPORT", entityType: "report", entityId: "quarterly-2026-q1", ipAddress: "10.0.1.51", userAgent: "Mozilla/5.0 Firefox/119" },
      { userId: uid(0), action: "LOGIN", entityType: "session", entityId: "sess_admin_001", ipAddress: "105.112.34.56", userAgent: "Mozilla/5.0 Chrome/120" },
      { userId: uid(0), action: "APPROVE", entityType: "kyc", entityId: "kyc-user-001", newValues: JSON.stringify({ status: "Verified" }), ipAddress: "10.0.1.50" },
    ];
    await db.insert(auditTrail).values(auditEntries).onConflictDoNothing();
    console.log(`  Created ${auditEntries.length} audit trail entries`);
    seeded++;

    // ── 38-39. Loyalty / Gamification ──────────────────────────────────
    console.log("[38/56] Seeding loyalty_points...");
    const loyaltyData = [
      { userId: uid(0), points: 4500, tier: "Gold", totalEarned: 6200, totalRedeemed: 1700 },
      { userId: uid(2), points: 1200, tier: "Silver", totalEarned: 1800, totalRedeemed: 600 },
      { userId: uid(3), points: 800, tier: "Bronze", totalEarned: 800, totalRedeemed: 0 },
      { userId: uid(5), points: 8500, tier: "Platinum", totalEarned: 12000, totalRedeemed: 3500 },
      { userId: uid(7), points: 150, tier: "Bronze", totalEarned: 150, totalRedeemed: 0 },
    ];
    await db.insert(loyaltyPoints).values(loyaltyData).onConflictDoNothing();
    console.log(`  Created ${loyaltyData.length} loyalty points records`);
    seeded++;

    console.log("[39/56] Seeding loyalty_transactions...");
    const loyaltyTxns = [
      { userId: uid(0), points: 500, transactionType: "earn", description: "Policy purchase bonus - Health Insurance", referenceId: "POL-2026-001" },
      { userId: uid(0), points: 200, transactionType: "earn", description: "Referral reward - Chukwuemeka Nwosu", referenceId: "REF-SEUN-001" },
      { userId: uid(0), points: -500, transactionType: "redeem", description: "Redeemed for ₦2,500 premium discount", referenceId: "RDM-001" },
      { userId: uid(0), points: 1000, transactionType: "earn", description: "Claims-free year bonus", referenceId: "BONUS-2026-001" },
      { userId: uid(5), points: 3000, transactionType: "earn", description: "Large policy purchase bonus - Parametric + Agricultural", referenceId: "POL-2026-006" },
      { userId: uid(5), points: -1500, transactionType: "redeem", description: "Redeemed for premium waiver on microinsurance", referenceId: "RDM-002" },
      { userId: uid(2), points: 300, transactionType: "earn", description: "App review bonus", referenceId: "REV-001" },
      { userId: uid(7), points: 150, transactionType: "earn", description: "Welcome bonus - Account creation", referenceId: "WELCOME-008" },
    ];
    await db.insert(loyaltyTransactions).values(loyaltyTxns).onConflictDoNothing();
    console.log(`  Created ${loyaltyTxns.length} loyalty transactions`);
    seeded++;

    // ── 40. USSD Sessions ──────────────────────────────────────────────
    console.log("[40/56] Seeding ussd_sessions...");
    const ussdData = [
      { sessionId: "USSD-2026-001", phoneNumber: "+2348031234567", currentMenu: "policy_purchase", sessionData: JSON.stringify({ step: 3, product: "Health", amount: 15000 }), status: "completed" },
      { sessionId: "USSD-2026-002", phoneNumber: "+2348051234568", currentMenu: "check_balance", sessionData: JSON.stringify({ step: 2 }), status: "completed" },
      { sessionId: "USSD-2026-003", phoneNumber: "+2348091234569", currentMenu: "file_claim", sessionData: JSON.stringify({ step: 1, policyNumber: "POL-2026-006" }), status: "timeout" },
      { sessionId: "USSD-2026-004", phoneNumber: "+2348071234570", currentMenu: "main_menu", sessionData: JSON.stringify({ step: 0 }), status: "active" },
      { sessionId: "USSD-2026-005", phoneNumber: "+2348012345678", currentMenu: "premium_payment", sessionData: JSON.stringify({ step: 4, amount: 8500, method: "airtime" }), status: "completed" },
    ];
    await db.insert(ussdSessions).values(ussdData).onConflictDoNothing();
    console.log(`  Created ${ussdData.length} USSD sessions`);
    seeded++;

    // ── 41. Documents ──────────────────────────────────────────────────
    console.log("[41/56] Seeding documents...");
    const docsData = [
      { userId: uid(0), entityType: "policy", entityId: 1, documentType: "Policy Document", fileName: "POL-2026-001-health-policy.pdf", fileUrl: "/documents/pol-2026-001.pdf", fileSize: 245000, mimeType: "application/pdf" },
      { userId: uid(0), entityType: "claim", entityId: 1, documentType: "Medical Report", fileName: "CLM-2026-001-medical-report.pdf", fileUrl: "/documents/clm-2026-001-med.pdf", fileSize: 180000, mimeType: "application/pdf" },
      { userId: uid(0), entityType: "claim", entityId: 1, documentType: "Hospital Receipt", fileName: "CLM-2026-001-receipt.jpg", fileUrl: "/documents/clm-2026-001-receipt.jpg", fileSize: 95000, mimeType: "image/jpeg" },
      { userId: uid(0), entityType: "kyc", entityId: 1, documentType: "NIN Slip", fileName: "kyc-nin-oluwaseun.pdf", fileUrl: "/documents/kyc-nin-001.pdf", fileSize: 120000, mimeType: "application/pdf" },
      { userId: uid(2), entityType: "kyc", entityId: 3, documentType: "International Passport", fileName: "kyc-passport-emeka.pdf", fileUrl: "/documents/kyc-passport-003.pdf", fileSize: 350000, mimeType: "application/pdf" },
      { userId: uid(3), entityType: "policy", entityId: 5, documentType: "Group Life Certificate", fileName: "group-life-dangote.pdf", fileUrl: "/documents/group-life-cert.pdf", fileSize: 520000, mimeType: "application/pdf" },
      { userId: uid(4), entityType: "claim", entityId: 5, documentType: "Crop Loss Assessment", fileName: "crop-loss-kebbi-2026.pdf", fileUrl: "/documents/crop-loss-assessment.pdf", fileSize: 890000, mimeType: "application/pdf" },
    ];
    await db.insert(documents).values(docsData).onConflictDoNothing();
    console.log(`  Created ${docsData.length} documents`);
    seeded++;

    // ── 42. Emergency Incidents ─────────────────────────────────────────
    console.log("[42/56] Seeding emergency_incidents...");
    const emergencies = [
      { userId: uid(0), incidentType: "Vehicle Accident", latitude: "6.4541461", longitude: "3.4023573", description: "Rear-end collision on Third Mainland Bridge near toll plaza", status: "Resolved", emergencyServices: ["Police", "Ambulance", "Tow Service"], resolvedAt: daysAgo(10) },
      { userId: uid(1), incidentType: "Flood", latitude: "6.4528610", longitude: "3.3927640", description: "Flooding at Lekki Phase 1 residential area. Water level 1.5m", status: "Dispatched", emergencyServices: ["Fire Service", "NEMA"] },
      { userId: uid(3), incidentType: "Fire", latitude: "6.4625030", longitude: "3.3508650", description: "Fire outbreak at Apapa warehouse. Partial stock damage", status: "In Progress", emergencyServices: ["Fire Service", "Police", "Ambulance"] },
      { userId: uid(6), incidentType: "Theft", latitude: "4.7742200", longitude: "7.0134560", description: "Cattle theft reported at Kaduna ranch. 5 head missing", status: "Reported", emergencyServices: ["Police"] },
    ];
    await db.insert(emergencyIncidents).values(emergencies).onConflictDoNothing();
    console.log(`  Created ${emergencies.length} emergency incidents`);
    seeded++;

    // ── 43-44. P2P Insurance Pools ─────────────────────────────────────
    console.log("[43/56] Seeding p2p_pools...");
    const pools = [
      { poolName: "Lagos Tech Workers Health Pool", totalFund: "2850000.00", coveragePerMember: "500000.00", monthlyContribution: "5000.00", memberCount: 48, status: "Active" },
      { poolName: "Farmers Cooperative Crop Shield", totalFund: "12500000.00", coveragePerMember: "1000000.00", monthlyContribution: "8000.00", memberCount: 120, status: "Active" },
      { poolName: "Market Women Business Protection", totalFund: "850000.00", coveragePerMember: "200000.00", monthlyContribution: "2000.00", memberCount: 35, status: "Active" },
    ];
    const createdPools = await db.insert(p2pPools).values(pools).onConflictDoNothing().returning();
    console.log(`  Created ${createdPools.length} P2P pools`);
    seeded++;

    console.log("[44/56] Seeding p2p_memberships...");
    const plid = (i) => createdPools[i % createdPools.length]?.id || 1;
    const memberships = [
      { userId: uid(0), poolId: plid(0), contribution: "5000.00", status: "Active" },
      { userId: uid(2), poolId: plid(0), contribution: "5000.00", status: "Active" },
      { userId: uid(4), poolId: plid(1), contribution: "8000.00", status: "Active" },
      { userId: uid(6), poolId: plid(1), contribution: "8000.00", status: "Active" },
      { userId: uid(3), poolId: plid(2), contribution: "2000.00", status: "Active" },
      { userId: uid(5), poolId: plid(2), contribution: "2000.00", status: "Inactive" },
    ];
    await db.insert(p2pMemberships).values(memberships).onConflictDoNothing();
    console.log(`  Created ${memberships.length} P2P memberships`);
    seeded++;

    // ── 45. Microinsurance ─────────────────────────────────────────────
    console.log("[45/56] Seeding microinsurance_policies...");
    const microPolicies = [
      { userId: uid(6), productId: "MICRO-SCREEN-001", productName: "Mobile Screen Protection", premium: "1500.00", coverage: "150000.00", duration: 365, status: "Active", expiresAt: monthsFromNow(11) },
      { userId: uid(7), productId: "MICRO-HEALTH-001", productName: "Daily Hospital Cash", premium: "500.00", coverage: "50000.00", duration: 30, status: "Active", expiresAt: daysFromNow(25) },
      { userId: uid(3), productId: "MICRO-CROP-001", productName: "Smallholder Crop Cover", premium: "2000.00", coverage: "500000.00", duration: 180, status: "Active", expiresAt: monthsFromNow(4) },
      { userId: uid(5), productId: "MICRO-TRAVEL-001", productName: "Interstate Travel Cover", premium: "300.00", coverage: "100000.00", duration: 1, status: "Expired" },
    ];
    await db.insert(microinsurancePolicies).values(microPolicies).onConflictDoNothing();
    console.log(`  Created ${microPolicies.length} microinsurance policies`);
    seeded++;

    // ── 46. Gig Economy Coverage ───────────────────────────────────────
    console.log("[46/56] Seeding gig_coverage_policies...");
    const gigPolicies = [
      { userId: uid(4), planId: "GIG-BOLT-001", planName: "Bolt Driver Protection", platform: "Bolt", premium: "3500.00", coverage: "2000000.00", status: "Active", expiresAt: monthsFromNow(6) },
      { userId: uid(7), planId: "GIG-UBER-001", planName: "Uber Eats Delivery Cover", platform: "Uber Eats", premium: "2000.00", coverage: "1000000.00", status: "Active", expiresAt: monthsFromNow(3) },
      { userId: uid(2), planId: "GIG-JUMIA-001", planName: "Jumia Vendor Product Liability", platform: "Jumia", premium: "5000.00", coverage: "5000000.00", status: "Active", expiresAt: monthsFromNow(9) },
    ];
    await db.insert(gigCoveragePolicies).values(gigPolicies).onConflictDoNothing();
    console.log(`  Created ${gigPolicies.length} gig economy policies`);
    seeded++;

    // ── 47. SME Policies ───────────────────────────────────────────────
    console.log("[47/56] Seeding sme_policies...");
    const smeData = [
      { userId: uid(3), productId: "SME-FIRE-001", businessName: "Okafor & Sons Trading", businessType: "Retail", annualPremium: "45000.00", coverageAmount: "25000000.00", status: "Active" },
      { userId: uid(4), productId: "SME-LIABILITY-001", businessName: "Bakare Construction Ltd", businessType: "Construction", annualPremium: "120000.00", coverageAmount: "100000000.00", status: "Active" },
      { userId: uid(0), productId: "SME-BOP-001", businessName: "Adeyemi Digital Services", businessType: "Technology", annualPremium: "35000.00", coverageAmount: "15000000.00", status: "Active" },
      { userId: uid(5), productId: "SME-GOODS-001", businessName: "Ngozi Fashion House", businessType: "Fashion/Textile", annualPremium: "22000.00", coverageAmount: "8000000.00", status: "Expired" },
    ];
    await db.insert(smePolicies).values(smeData).onConflictDoNothing();
    console.log(`  Created ${smeData.length} SME policies`);
    seeded++;

    // ── 48. Dynamic Pricing History ────────────────────────────────────
    console.log("[48/56] Seeding dynamic_pricing_history...");
    const pricingHistory = [
      { userId: uid(0), productType: "Health", basePremium: "45000.00", adjustedPremium: "42750.00", riskScore: 25, quoteId: "DPQ-2026-001" },
      { userId: uid(0), productType: "Auto", basePremium: "18500.00", adjustedPremium: "20350.00", riskScore: 45, quoteId: "DPQ-2026-002" },
      { userId: uid(2), productType: "Life", basePremium: "120000.00", adjustedPremium: "108000.00", riskScore: 15, quoteId: "DPQ-2026-003" },
      { userId: uid(3), productType: "Property", basePremium: "180000.00", adjustedPremium: "198000.00", riskScore: 55, quoteId: "DPQ-2026-004" },
      { userId: uid(5), productType: "Agricultural", basePremium: "35000.00", adjustedPremium: "38500.00", riskScore: 60, quoteId: "DPQ-2026-005" },
      { userId: uid(7), productType: "Health", basePremium: "8500.00", adjustedPremium: "8500.00", riskScore: 30, quoteId: "DPQ-2026-006" },
    ];
    await db.insert(dynamicPricingHistory).values(pricingHistory).onConflictDoNothing();
    console.log(`  Created ${pricingHistory.length} dynamic pricing records`);
    seeded++;

    // ── 49. Savings Accounts ───────────────────────────────────────────
    console.log("[49/56] Seeding savings_accounts...");
    const savingsData = [
      { userId: uid(0), planId: "SAV-FLEX-001", planName: "FlexSave Insurance Fund", balance: "250000.00", targetAmount: "1000000.00", interestRate: "0.0850", status: "Active", maturityDate: monthsFromNow(12) },
      { userId: uid(2), planId: "SAV-PREM-001", planName: "Premium Payment Saver", balance: "85000.00", targetAmount: "120000.00", interestRate: "0.0650", status: "Active", maturityDate: monthsFromNow(3) },
      { userId: uid(5), planId: "SAV-RETIR-001", planName: "Retirement TopUp Fund", balance: "1500000.00", targetAmount: "5000000.00", interestRate: "0.1000", status: "Active", maturityDate: monthsFromNow(60) },
      { userId: uid(7), planId: "SAV-MICRO-001", planName: "MicroSave Daily", balance: "12500.00", targetAmount: "50000.00", interestRate: "0.0500", status: "Active", maturityDate: monthsFromNow(6) },
    ];
    await db.insert(savingsAccounts).values(savingsData).onConflictDoNothing();
    console.log(`  Created ${savingsData.length} savings accounts`);
    seeded++;

    // ── 50. MCMC Simulation Results ────────────────────────────────────
    console.log("[50/56] Seeding mcmc_results...");
    const mcmcData = [
      { userId: uid(0), simulationId: "MCMC-2026-001", iterations: 100000, meanLoss: "2450000000.00", stdDev: "850000000.00", var95: "3800000000.00", var99: "5200000000.00", processingTime: "45.20", status: "Completed" },
      { userId: uid(0), simulationId: "MCMC-2026-002", iterations: 50000, meanLoss: "120000000.00", stdDev: "45000000.00", var95: "195000000.00", var99: "280000000.00", processingTime: "22.80", status: "Completed" },
      { userId: uid(1), simulationId: "MCMC-2026-003", iterations: 200000, meanLoss: "8500000000.00", stdDev: "3200000000.00", var95: "13500000000.00", var99: "18000000000.00", processingTime: "98.50", status: "Completed" },
      { userId: uid(0), simulationId: "MCMC-2026-004", iterations: 10000, meanLoss: "500000000.00", stdDev: "180000000.00", var95: "820000000.00", var99: "1100000000.00", processingTime: "5.30", status: "Completed" },
    ];
    await db.insert(mcmcResults).values(mcmcData).onConflictDoNothing();
    console.log(`  Created ${mcmcData.length} MCMC simulation results`);
    seeded++;

    // ── 51. Family Members ─────────────────────────────────────────────
    console.log("[51/56] Seeding family_members...");
    const familyData = [
      { userId: uid(0), memberName: "Bukola Adeyemi", relationship: "Spouse", dateOfBirth: new Date("1990-08-15"), gender: "Female", coveredPolicyId: pid(0), status: "Active" },
      { userId: uid(0), memberName: "Damilola Adeyemi", relationship: "Child", dateOfBirth: new Date("2015-03-22"), gender: "Male", coveredPolicyId: pid(0), status: "Active" },
      { userId: uid(0), memberName: "Teniola Adeyemi", relationship: "Child", dateOfBirth: new Date("2018-11-10"), gender: "Female", coveredPolicyId: pid(0), status: "Active" },
      { userId: uid(2), memberName: "Amara Nwosu", relationship: "Spouse", dateOfBirth: new Date("1992-06-28"), gender: "Female", coveredPolicyId: pid(9), status: "Active" },
      { userId: uid(2), memberName: "Obi Nwosu", relationship: "Child", dateOfBirth: new Date("2020-01-05"), gender: "Male", coveredPolicyId: pid(9), status: "Active" },
    ];
    await db.insert(familyMembers).values(familyData).onConflictDoNothing();
    console.log(`  Created ${familyData.length} family members`);
    seeded++;

    // ── 52. Claim Evidence ─────────────────────────────────────────────
    console.log("[52/56] Seeding claim_evidence...");
    const evidenceData = [
      { userId: uid(0), claimId: claimIds[0] || 1, evidenceType: "Medical Report", fileName: "appendectomy-report.pdf", fileUrl: "/evidence/clm-001-med.pdf", description: "Surgical report from LUTH", status: "Verified" },
      { userId: uid(0), claimId: claimIds[0] || 1, evidenceType: "Receipt", fileName: "hospital-receipt.jpg", fileUrl: "/evidence/clm-001-receipt.jpg", description: "Hospital bill receipt ₦350,000", status: "Verified" },
      { userId: uid(0), claimId: claimIds[1] || 2, evidenceType: "Photo", fileName: "car-damage-front.jpg", fileUrl: "/evidence/clm-002-photo1.jpg", description: "Front bumper damage photo", status: "Uploaded" },
      { userId: uid(0), claimId: claimIds[1] || 2, evidenceType: "Photo", fileName: "car-damage-rear.jpg", fileUrl: "/evidence/clm-002-photo2.jpg", description: "Rear taillight damage photo", status: "Uploaded" },
      { userId: uid(0), claimId: claimIds[1] || 2, evidenceType: "Police Report", fileName: "police-report-tmb.pdf", fileUrl: "/evidence/clm-002-police.pdf", description: "Police accident report from Third Mainland Bridge", status: "Uploaded" },
      { userId: uid(1), claimId: claimIds[2] || 3, evidenceType: "Photo", fileName: "flood-damage-01.jpg", fileUrl: "/evidence/clm-003-flood1.jpg", description: "Ground floor flooding showing 1.5m water level", status: "Uploaded" },
      { userId: uid(4), claimId: claimIds[4] || 5, evidenceType: "Assessment Report", fileName: "crop-loss-assessment.pdf", fileUrl: "/evidence/clm-005-crop.pdf", description: "Agricultural assessor report confirming total crop loss", status: "Verified" },
    ];
    await db.insert(claimEvidence).values(evidenceData).onConflictDoNothing();
    console.log(`  Created ${evidenceData.length} claim evidence records`);
    seeded++;

    // ── 53. WhatsApp Messages ──────────────────────────────────────────
    console.log("[53/56] Seeding whatsapp_messages...");
    const whatsappData = [
      { userId: uid(0), phoneNumber: "+2348031234567", direction: "inbound", messageType: "text", content: "Hi, I want to check my policy status", status: "delivered" },
      { userId: uid(0), phoneNumber: "+2348031234567", direction: "outbound", messageType: "text", content: "Hello Oluwaseun! You have 3 active policies. POL-2026-001 (Health), POL-2026-002 (Auto), POL-2026-009 (Auto). Reply with policy number for details.", status: "read" },
      { userId: uid(0), phoneNumber: "+2348031234567", direction: "inbound", messageType: "text", content: "POL-2026-001", status: "delivered" },
      { userId: uid(0), phoneNumber: "+2348031234567", direction: "outbound", messageType: "template", content: "Policy Details:\nNumber: POL-2026-001\nType: Health Insurance\nPremium: ₦45,000/yr\nSum Assured: ₦5,000,000\nExpiry: 6 months\nStatus: Active", status: "read" },
      { userId: uid(4), phoneNumber: "+2348071234570", direction: "inbound", messageType: "text", content: "I want to file a claim for my crop insurance", status: "delivered" },
      { userId: uid(4), phoneNumber: "+2348071234570", direction: "outbound", messageType: "text", content: "Sure! Please describe the incident and attach photos of the crop damage. Our agricultural assessor will be assigned within 24 hours.", status: "sent" },
      { userId: uid(7), phoneNumber: "+2348061234571", direction: "inbound", messageType: "text", content: "How do I register for insurance?", status: "delivered" },
      { userId: uid(7), phoneNumber: "+2348061234571", direction: "outbound", messageType: "text", content: "Welcome to InsurePortal! Visit insureportal.ng/register or dial *347*88# to get started. You'll need your NIN or BVN for verification.", status: "delivered" },
    ];
    await db.insert(whatsappMessages).values(whatsappData).onConflictDoNothing();
    console.log(`  Created ${whatsappData.length} WhatsApp messages`);
    seeded++;

    // ── 54. Voice Sessions ─────────────────────────────────────────────
    console.log("[54/56] Seeding voice_sessions...");
    const voiceData = [
      { userId: uid(0), language: "en", transcription: "I want to check my claim status for the hospital visit last month", confidence: "0.9200", intent: "claim_status_check", status: "Completed" },
      { userId: uid(4), language: "ha", transcription: "Ina so in duba lamuni na noma", confidence: "0.8500", intent: "policy_inquiry", status: "Completed" },
      { userId: uid(3), language: "yo", transcription: "Mo fe sanwo premium mi fun osu yi", confidence: "0.8800", intent: "premium_payment", status: "Completed" },
      { userId: uid(7), language: "en", transcription: "How much is health insurance for a student?", confidence: "0.9500", intent: "quote_request", status: "Completed" },
      { userId: uid(6), language: "ig", transcription: "A choro m ikwu maka nchekwa ehi m", confidence: "0.7800", intent: "claim_filing", status: "Completed" },
    ];
    await db.insert(voiceSessions).values(voiceData).onConflictDoNothing();
    console.log(`  Created ${voiceData.length} voice sessions`);
    seeded++;

    // ── 55. Insurance Applications ─────────────────────────────────────
    console.log("[55/56] Seeding insurance_applications...");
    const appData = [
      { userId: uid(0), applicationId: "APP-2026-001", productType: "Health", status: "Approved", currentStep: "complete", totalSteps: 5, submittedAt: monthsAgo(6) },
      { userId: uid(2), applicationId: "APP-2026-002", productType: "Life", status: "Approved", currentStep: "complete", totalSteps: 5, submittedAt: monthsAgo(12) },
      { userId: uid(7), applicationId: "APP-2026-003", productType: "Health", status: "In Review", currentStep: "medical_questionnaire", totalSteps: 5, submittedAt: daysAgo(3) },
      { userId: uid(3), applicationId: "APP-2026-004", productType: "Property", status: "Draft", currentStep: "personal_info", totalSteps: 5 },
      { userId: uid(5), applicationId: "APP-2026-005", productType: "Microinsurance", status: "Approved", currentStep: "complete", totalSteps: 3, submittedAt: monthsAgo(1) },
      { userId: uid(4), applicationId: "APP-2026-006", productType: "Agricultural", status: "Rejected", currentStep: "complete", totalSteps: 5, submittedAt: monthsAgo(2) },
    ];
    await db.insert(insuranceApplications).values(appData).onConflictDoNothing();
    console.log(`  Created ${appData.length} insurance applications`);
    seeded++;

    // ── 56. Customer Feedback ──────────────────────────────────────────
    console.log("[56/56] Seeding customer_feedback...");
    const feedbackData = [
      { userId: uid(0), feedbackType: "Suggestion", subject: "Mobile App Dark Mode", message: "The mobile app needs a dark mode option. I use the app at night and the white screen is too bright.", rating: 4, status: "In Progress", ticketId: "FB-2026-001" },
      { userId: uid(2), feedbackType: "Complaint", subject: "Slow Claims Processing", message: "My claim CLM-2026-004 has been under review for 90 days. This is unacceptable for a death benefit claim.", rating: 1, status: "Escalated", ticketId: "FB-2026-002" },
      { userId: uid(5), feedbackType: "Praise", subject: "Amazing Parametric Insurance", message: "The automatic payout when rainfall dropped below threshold was incredible. No paperwork, no waiting. This is the future!", rating: 5, status: "Closed", ticketId: "FB-2026-003" },
      { userId: uid(7), feedbackType: "Bug Report", subject: "USSD Timeout Issue", message: "The USSD service *347*88# keeps timing out after the second menu. I tried 3 times and couldn't complete my purchase.", rating: 2, status: "Open", ticketId: "FB-2026-004" },
      { userId: uid(3), feedbackType: "Suggestion", subject: "Yoruba Language Support", message: "Please add Yoruba and Igbo language options to the WhatsApp bot and voice assistant.", rating: 3, status: "Open", ticketId: "FB-2026-005" },
      { userId: uid(4), feedbackType: "Praise", subject: "Great Agent Service", message: "Tunde Bakare from the Kano office went above and beyond to help set up our group life scheme.", rating: 5, status: "Closed", ticketId: "FB-2026-006" },
    ];
    await db.insert(customerFeedback).values(feedbackData).onConflictDoNothing();
    console.log(`  Created ${feedbackData.length} customer feedback records`);
    seeded++;

    // ── Summary ────────────────────────────────────────────────────────
    console.log("\n=== Seeding Complete ===");
    console.log(`Successfully seeded ${seeded}/56 tables`);
    console.log(`Users: ${usersData.length} | Policies: ${policiesData.length} | Claims: ${claimsData.length} | Payments: ${paymentsData.length}`);
    console.log(`Total records: ~${
      usersData.length + policiesData.length + claimsData.length + paymentsData.length +
      referralsData.length + reviewsData.length + fraudScoresData.length + fraudRingsData.length +
      fraudAlertsData.length + erpTxns.length + erpRecon.length + rateTables.length +
      riskFactors.length + rateChanges.length + rateAuditLogs.length + brokerKeys.length +
      apiUsage.length + kgNodes.length + kgEdges.length + telcoScores.length + actuarialCalcs.length +
      bancPartners.length + bancOffers.length + groupSchemes.length + groupMembers.length +
      nmidData.length + pfaData.length + annuityQuotes.length + treaties.length + cessions.length +
      agentsData.length + commissions.length + kycData.length + naicomData.length + notifs.length +
      events.length + auditEntries.length + loyaltyData.length + loyaltyTxns.length + ussdData.length +
      docsData.length + emergencies.length + pools.length + memberships.length + microPolicies.length +
      gigPolicies.length + smeData.length + pricingHistory.length + savingsData.length + mcmcData.length +
      familyData.length + evidenceData.length + whatsappData.length + voiceData.length + appData.length +
      feedbackData.length
    } records across all tables`);

  } catch (error) {
    console.error("\nSeeding failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
