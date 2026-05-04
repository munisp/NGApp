import {
  serial,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Crypto Remittance Database Schema
 * 
 * Tables for managing crypto-to-fiat remittances from USA to Nigeria
 * with support for multiple delivery options.
 */

// PostgreSQL enum definitions for remittance schema
export const deliveryOptionEnum = pgEnum("delivery_option", [
  "NEW_ACCOUNT",
  "EXISTING_ACCOUNT",
  "AGENT_CASH",
  "PAY_BILLS",
]);

export const remittanceStatusEnum = pgEnum("remittance_status", [
  "pending_recipient_info",
  "pending_kyc",
  "kyc_approved",
  "kyc_failed",
  "crypto_converting",
  "crypto_converted",
  "processing",
  "account_opened",
  "funds_deposited",
  "collection_code_generated",
  "cash_collected",
  "bill_paid",
  "completed",
  "failed",
  "expired",
]);

export const conversionStatusEnum = pgEnum("conversion_status", [
  "pending",
  "confirming",
  "converting",
  "completed",
  "failed",
]);

export const kycVerificationStatusEnum = pgEnum("kyc_verification_status", [
  "pending",
  "in_progress",
  "approved",
  "rejected",
  "failed",
]);

export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const bankAccountStatusEnum = pgEnum("bank_account_status", [
  "pending",
  "opening",
  "active",
  "verified",
  "failed",
  "closed",
]);

export const remittanceWebhookStatusEnum = pgEnum("remittance_webhook_status", [
  "pending",
  "delivered",
  "failed",
  "retrying",
]);

export const bankTransferStatusEnum = pgEnum("bank_transfer_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "reversed",
]);

// ============================================================================
// Core Remittance Tables
// ============================================================================

/**
 * Main remittances table - tracks all remittance transactions
 */
export const remittances = pgTable("remittances", {
  id: serial("id").primaryKey(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull().unique(),
  
  // Sender information
  senderUserId: integer("sender_user_id"),
  senderCurrency: varchar("sender_currency", { length: 10 }).notNull(),
  senderAmount: decimal("sender_amount", { precision: 20, scale: 8 }).notNull(),
  
  // Recipient information
  recipientPhone: varchar("recipient_phone", { length: 20 }).notNull(),
  recipientCountry: varchar("recipient_country", { length: 3 }).notNull(),
  recipientCurrency: varchar("recipient_currency", { length: 10 }).notNull(),
  estimatedRecipientAmount: decimal("estimated_recipient_amount", { precision: 20, scale: 2 }).notNull(),
  actualRecipientAmount: decimal("actual_recipient_amount", { precision: 20, scale: 2 }),
  
  // Exchange rate and fees
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }).notNull(),
  cryptoExchangeFee: decimal("crypto_exchange_fee", { precision: 20, scale: 8 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 20, scale: 8 }).notNull(),
  totalFees: decimal("total_fees", { precision: 20, scale: 8 }).notNull(),
  
  // Delivery options
  deliveryOption: deliveryOptionEnum("delivery_option").notNull(),
  
  // Status tracking
  status: remittanceStatusEnum("status").notNull().default("pending_recipient_info"),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  failureReason: text("failure_reason"),
  failureCode: varchar("failure_code", { length: 50 }),
}, (table) => ({
  statusIdx: index("remittances_status_idx").on(table.status),
  senderUserIdx: index("remittances_sender_user_idx").on(table.senderUserId),
  recipientPhoneIdx: index("remittances_recipient_phone_idx").on(table.recipientPhone),
  createdAtIdx: index("remittances_created_at_idx").on(table.createdAt),
}));

export type Remittance = typeof remittances.$inferSelect;
export type InsertRemittance = typeof remittances.$inferInsert;

/**
 * Crypto conversion tracking - records crypto-to-fiat conversions
 */
export const cryptoConversions = pgTable("crypto_conversions", {
  id: serial("id").primaryKey(),
  conversionId: varchar("conversion_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Crypto details
  cryptoCurrency: varchar("crypto_currency", { length: 10 }).notNull(),
  cryptoAmount: decimal("crypto_amount", { precision: 20, scale: 8 }).notNull(),
  cryptoWalletAddress: varchar("crypto_wallet_address", { length: 255 }),
  cryptoTransactionHash: varchar("crypto_transaction_hash", { length: 255 }),
  cryptoConfirmations: integer("crypto_confirmations").default(0),
  
  // Conversion details
  fiatCurrency: varchar("fiat_currency", { length: 10 }).notNull(),
  fiatAmount: decimal("fiat_amount", { precision: 20, scale: 2 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }).notNull(),
  exchangeFee: decimal("exchange_fee", { precision: 20, scale: 8 }).notNull(),
  
  // Provider details
  provider: varchar("provider", { length: 50 }).notNull(),
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }),
  
  // Status
  status: conversionStatusEnum("status").notNull().default("pending"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
}, (table) => ({
  remittanceIdx: index("conversions_remittance_idx").on(table.remittanceId),
  statusIdx: index("conversions_status_idx").on(table.status),
  txHashIdx: index("conversions_tx_hash_idx").on(table.cryptoTransactionHash),
}));

export type CryptoConversion = typeof cryptoConversions.$inferSelect;
export type InsertCryptoConversion = typeof cryptoConversions.$inferInsert;

/**
 * KYC verifications - stores identity verification results
 */
export const kycVerifications = pgTable("kyc_verifications", {
  id: serial("id").primaryKey(),
  verificationId: varchar("verification_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Personal information
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: varchar("date_of_birth", { length: 10 }).notNull(),
  address: text("address").notNull(),
  
  // ID documents
  bvn: varchar("bvn", { length: 11 }),
  idType: varchar("id_type", { length: 50 }).notNull(),
  idNumber: varchar("id_number", { length: 100 }).notNull(),
  photoUrl: varchar("photo_url", { length: 500 }),
  idDocumentUrl: varchar("id_document_url", { length: 500 }),
  
  // Verification provider
  provider: varchar("provider", { length: 50 }).notNull(),
  providerVerificationId: varchar("provider_verification_id", { length: 255 }),
  
  // Verification results
  status: kycVerificationStatusEnum("status").notNull().default("pending"),
  
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  livenessCheck: boolean("liveness_check").default(false),
  documentMatch: boolean("document_match").default(false),
  amlScreening: boolean("aml_screening").default(false),
  sanctionsCheck: boolean("sanctions_check").default(false),
  
  // Risk assessment
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  riskLevel: riskLevelEnum("risk_level"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  rejectionReason: text("rejection_reason"),
  errorMessage: text("error_message"),
}, (table) => ({
  remittanceIdx: index("kyc_remittance_idx").on(table.remittanceId),
  statusIdx: index("kyc_status_idx").on(table.status),
  bvnIdx: index("kyc_bvn_idx").on(table.bvn),
}));

export type KYCVerification = typeof kycVerifications.$inferSelect;
export type InsertKYCVerification = typeof kycVerifications.$inferInsert;

/**
 * Bank accounts for remittance - tracks opened/verified accounts
 */
export const bankAccountsRemittance = pgTable("bank_accounts_remittance", {
  id: serial("id").primaryKey(),
  accountId: varchar("account_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Account details
  accountNumber: varchar("account_number", { length: 20 }).notNull(),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }).notNull(),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  accountType: varchar("account_type", { length: 50 }).notNull(),
  
  // Account status
  status: bankAccountStatusEnum("status").notNull().default("pending"),
  
  // Account opening details
  isNewAccount: boolean("is_new_account").default(false),
  openingProvider: varchar("opening_provider", { length: 50 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
}, (table) => ({
  remittanceIdx: index("bank_acct_remittance_idx").on(table.remittanceId),
  accountNumberIdx: uniqueIndex("bank_acct_number_idx").on(table.accountNumber, table.bankCode),
  statusIdx: index("bank_acct_status_idx").on(table.status),
}));

export type BankAccountRemittance = typeof bankAccountsRemittance.$inferSelect;
export type InsertBankAccountRemittance = typeof bankAccountsRemittance.$inferInsert;

/**
 * Exchange rates - historical rate tracking
 */
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  
  // Currency pair
  fromCurrency: varchar("from_currency", { length: 10 }).notNull(),
  toCurrency: varchar("to_currency", { length: 10 }).notNull(),
  
  // Rate details
  rate: decimal("rate", { precision: 20, scale: 8 }).notNull(),
  bidRate: decimal("bid_rate", { precision: 20, scale: 8 }),
  askRate: decimal("ask_rate", { precision: 20, scale: 8 }),
  
  // Provider
  provider: varchar("provider", { length: 50 }).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
}, (table) => ({
  currencyPairIdx: index("exchange_currency_pair_idx").on(table.fromCurrency, table.toCurrency),
  createdAtIdx: index("exchange_created_at_idx").on(table.createdAt),
}));

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

/**
 * Remittance timeline - tracks status changes and events
 */
export const remittanceTimeline = pgTable("remittance_timeline", {
  id: serial("id").primaryKey(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Event details
  status: varchar("status", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  message: text("message"),
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Actor
  actorType: varchar("actor_type", { length: 50 }),
  actorId: varchar("actor_id", { length: 64 }),
  
  // Timestamp
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  remittanceIdx: index("timeline_remittance_idx").on(table.remittanceId),
  timestampIdx: index("timeline_timestamp_idx").on(table.timestamp),
}));

export type RemittanceTimelineEvent = typeof remittanceTimeline.$inferSelect;
export type InsertRemittanceTimelineEvent = typeof remittanceTimeline.$inferInsert;

/**
 * Remittance webhooks - tracks webhook delivery for remittance events
 */
export const remittanceWebhooks = pgTable("remittance_webhooks", {
  id: serial("id").primaryKey(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Webhook details
  event: varchar("event", { length: 100 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  payload: json("payload").$type<Record<string, any>>().notNull(),
  signature: varchar("signature", { length: 255 }).notNull(),
  
  // Delivery status
  status: remittanceWebhookStatusEnum("status").notNull().default("pending"),
  
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(5),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Response details
  responseStatusCode: integer("response_status_code"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
}, (table) => ({
  remittanceIdx: index("webhook_remittance_idx").on(table.remittanceId),
  statusIdx: index("webhook_status_idx").on(table.status),
  nextRetryIdx: index("webhook_next_retry_idx").on(table.nextRetryAt),
}));

export type RemittanceWebhook = typeof remittanceWebhooks.$inferSelect;
export type InsertRemittanceWebhook = typeof remittanceWebhooks.$inferInsert;

// ============================================================================
// Bank Transfer Tracking
// ============================================================================

/**
 * Bank transfers - tracks NIBSS transfers for remittances
 */
export const bankTransfers = pgTable("bank_transfers", {
  id: serial("id").primaryKey(),
  transferId: varchar("transfer_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Transfer details
  accountNumber: varchar("account_number", { length: 20 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }).notNull(),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  narration: varchar("narration", { length: 255 }),
  
  // NIBSS details
  nibssReference: varchar("nibss_reference", { length: 100 }),
  sessionId: varchar("session_id", { length: 100 }),
  
  // Status
  status: bankTransferStatusEnum("status").notNull().default("pending"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 50 }),
}, (table) => ({
  remittanceIdx: index("transfer_remittance_idx").on(table.remittanceId),
  statusIdx: index("transfer_status_idx").on(table.status),
  nibssRefIdx: index("transfer_nibss_ref_idx").on(table.nibssReference),
}));

export type BankTransfer = typeof bankTransfers.$inferSelect;
export type InsertBankTransfer = typeof bankTransfers.$inferInsert;
