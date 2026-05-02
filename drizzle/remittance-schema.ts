import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Crypto Remittance Database Schema
 * 
 * Tables for managing crypto-to-fiat remittances from USA to Nigeria
 * with support for multiple delivery options.
 */

// ============================================================================
// Core Remittance Tables
// ============================================================================

/**
 * Main remittances table - tracks all remittance transactions
 */
export const remittances = mysqlTable("remittances", {
  id: int("id").autoincrement().primaryKey(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull().unique(),
  
  // Sender information
  senderUserId: int("sender_user_id"), // Link to users table if sender is registered
  senderCurrency: varchar("sender_currency", { length: 10 }).notNull(), // BTC, ETH, USDC, USDT
  senderAmount: decimal("sender_amount", { precision: 20, scale: 8 }).notNull(),
  
  // Recipient information
  recipientPhone: varchar("recipient_phone", { length: 20 }).notNull(),
  recipientCountry: varchar("recipient_country", { length: 3 }).notNull(), // ISO 3166-1 alpha-3
  recipientCurrency: varchar("recipient_currency", { length: 10 }).notNull(), // NGN
  estimatedRecipientAmount: decimal("estimated_recipient_amount", { precision: 20, scale: 2 }).notNull(),
  actualRecipientAmount: decimal("actual_recipient_amount", { precision: 20, scale: 2 }),
  
  // Exchange rate and fees
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }).notNull(),
  cryptoExchangeFee: decimal("crypto_exchange_fee", { precision: 20, scale: 8 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 20, scale: 8 }).notNull(),
  totalFees: decimal("total_fees", { precision: 20, scale: 8 }).notNull(),
  
  // Delivery options
  deliveryOption: mysqlEnum("delivery_option", [
    "NEW_ACCOUNT",
    "EXISTING_ACCOUNT",
    "AGENT_CASH",
    "PAY_BILLS",
  ]).notNull(),
  
  // Status tracking
  status: mysqlEnum("status", [
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
  ]).notNull().default("pending_recipient_info"),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  failureReason: text("failure_reason"),
  failureCode: varchar("failure_code", { length: 50 }),
}, (table) => ({
  statusIdx: index("status_idx").on(table.status),
  senderUserIdx: index("sender_user_idx").on(table.senderUserId),
  recipientPhoneIdx: index("recipient_phone_idx").on(table.recipientPhone),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type Remittance = typeof remittances.$inferSelect;
export type InsertRemittance = typeof remittances.$inferInsert;

/**
 * Crypto conversion tracking - records crypto-to-fiat conversions
 */
export const cryptoConversions = mysqlTable("crypto_conversions", {
  id: int("id").autoincrement().primaryKey(),
  conversionId: varchar("conversion_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Crypto details
  cryptoCurrency: varchar("crypto_currency", { length: 10 }).notNull(),
  cryptoAmount: decimal("crypto_amount", { precision: 20, scale: 8 }).notNull(),
  cryptoWalletAddress: varchar("crypto_wallet_address", { length: 255 }),
  cryptoTransactionHash: varchar("crypto_transaction_hash", { length: 255 }),
  cryptoConfirmations: int("crypto_confirmations").default(0),
  
  // Conversion details
  fiatCurrency: varchar("fiat_currency", { length: 10 }).notNull(),
  fiatAmount: decimal("fiat_amount", { precision: 20, scale: 2 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }).notNull(),
  exchangeFee: decimal("exchange_fee", { precision: 20, scale: 8 }).notNull(),
  
  // Provider details
  provider: varchar("provider", { length: 50 }).notNull(), // coinbase, circle
  providerTransactionId: varchar("provider_transaction_id", { length: 255 }),
  
  // Status
  status: mysqlEnum("status", [
    "pending",
    "confirming",
    "converting",
    "completed",
    "failed",
  ]).notNull().default("pending"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
}, (table) => ({
  remittanceIdx: index("remittance_idx").on(table.remittanceId),
  statusIdx: index("status_idx").on(table.status),
  txHashIdx: index("tx_hash_idx").on(table.cryptoTransactionHash),
}));

export type CryptoConversion = typeof cryptoConversions.$inferSelect;
export type InsertCryptoConversion = typeof cryptoConversions.$inferInsert;

/**
 * KYC verifications - stores identity verification results
 */
export const kycVerifications = mysqlTable("kyc_verifications", {
  id: int("id").autoincrement().primaryKey(),
  verificationId: varchar("verification_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Personal information
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: varchar("date_of_birth", { length: 10 }).notNull(), // YYYY-MM-DD
  address: text("address").notNull(),
  
  // ID documents
  bvn: varchar("bvn", { length: 11 }), // Bank Verification Number
  idType: varchar("id_type", { length: 50 }).notNull(), // NIN, passport, drivers_license
  idNumber: varchar("id_number", { length: 100 }).notNull(),
  photoUrl: varchar("photo_url", { length: 500 }),
  idDocumentUrl: varchar("id_document_url", { length: 500 }),
  
  // Verification provider
  provider: varchar("provider", { length: 50 }).notNull(), // smile_identity
  providerVerificationId: varchar("provider_verification_id", { length: 255 }),
  
  // Verification results
  status: mysqlEnum("status", [
    "pending",
    "in_progress",
    "approved",
    "rejected",
    "failed",
  ]).notNull().default("pending"),
  
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  livenessCheck: boolean("liveness_check").default(false),
  documentMatch: boolean("document_match").default(false),
  amlScreening: boolean("aml_screening").default(false),
  sanctionsCheck: boolean("sanctions_check").default(false),
  
  // Risk assessment
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  riskLevel: mysqlEnum("risk_level", ["low", "medium", "high"]),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  rejectionReason: text("rejection_reason"),
  errorMessage: text("error_message"),
}, (table) => ({
  remittanceIdx: index("remittance_idx").on(table.remittanceId),
  statusIdx: index("status_idx").on(table.status),
  bvnIdx: index("bvn_idx").on(table.bvn),
}));

export type KYCVerification = typeof kycVerifications.$inferSelect;
export type InsertKYCVerification = typeof kycVerifications.$inferInsert;

/**
 * Bank accounts for remittance - tracks opened/verified accounts
 */
export const bankAccountsRemittance = mysqlTable("bank_accounts_remittance", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("account_id", { length: 64 }).notNull().unique(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Account details
  accountNumber: varchar("account_number", { length: 20 }).notNull(),
  bankName: varchar("bank_name", { length: 100 }).notNull(),
  bankCode: varchar("bank_code", { length: 10 }).notNull(), // NIBSS bank code
  accountName: varchar("account_name", { length: 200 }).notNull(),
  accountType: varchar("account_type", { length: 50 }).notNull(), // savings, current
  
  // Account status
  status: mysqlEnum("status", [
    "pending",
    "opening",
    "active",
    "verified",
    "failed",
    "closed",
  ]).notNull().default("pending"),
  
  // Account opening details
  isNewAccount: boolean("is_new_account").default(false),
  openingProvider: varchar("opening_provider", { length: 50 }), // bankone, providus
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
}, (table) => ({
  remittanceIdx: index("remittance_idx").on(table.remittanceId),
  accountNumberIdx: uniqueIndex("account_number_idx").on(table.accountNumber, table.bankCode),
  statusIdx: index("status_idx").on(table.status),
}));

export type BankAccountRemittance = typeof bankAccountsRemittance.$inferSelect;
export type InsertBankAccountRemittance = typeof bankAccountsRemittance.$inferInsert;

/**
 * Exchange rates - historical rate tracking
 */
export const exchangeRates = mysqlTable("exchange_rates", {
  id: int("id").autoincrement().primaryKey(),
  
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
  currencyPairIdx: index("currency_pair_idx").on(table.fromCurrency, table.toCurrency),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = typeof exchangeRates.$inferInsert;

/**
 * Remittance timeline - tracks status changes and events
 */
export const remittanceTimeline = mysqlTable("remittance_timeline", {
  id: int("id").autoincrement().primaryKey(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Event details
  status: varchar("status", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // status_change, note, error
  message: text("message"),
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Actor
  actorType: varchar("actor_type", { length: 50 }), // system, admin, user
  actorId: varchar("actor_id", { length: 64 }),
  
  // Timestamp
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  remittanceIdx: index("remittance_idx").on(table.remittanceId),
  timestampIdx: index("timestamp_idx").on(table.timestamp),
}));

export type RemittanceTimelineEvent = typeof remittanceTimeline.$inferSelect;
export type InsertRemittanceTimelineEvent = typeof remittanceTimeline.$inferInsert;

/**
 * Remittance webhooks - tracks webhook delivery for remittance events
 */
export const remittanceWebhooks = mysqlTable("remittance_webhooks", {
  id: int("id").autoincrement().primaryKey(),
  remittanceId: varchar("remittance_id", { length: 64 }).notNull(),
  
  // Webhook details
  event: varchar("event", { length: 100 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  payload: json("payload").$type<Record<string, any>>().notNull(),
  signature: varchar("signature", { length: 255 }).notNull(),
  
  // Delivery status
  status: mysqlEnum("status", [
    "pending",
    "delivered",
    "failed",
    "retrying",
  ]).notNull().default("pending"),
  
  attempts: int("attempts").default(0),
  maxAttempts: int("max_attempts").default(5),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Response details
  responseStatusCode: int("response_status_code"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
}, (table) => ({
  remittanceIdx: index("remittance_idx").on(table.remittanceId),
  statusIdx: index("status_idx").on(table.status),
  nextRetryIdx: index("next_retry_idx").on(table.nextRetryAt),
}));

export type RemittanceWebhook = typeof remittanceWebhooks.$inferSelect;
export type InsertRemittanceWebhook = typeof remittanceWebhooks.$inferInsert;

// ============================================================================
// Bank Transfer Tracking
// ============================================================================

/**
 * Bank transfers - tracks NIBSS transfers for remittances
 */
export const bankTransfers = mysqlTable("bank_transfers", {
  id: int("id").autoincrement().primaryKey(),
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
  status: mysqlEnum("status", [
    "pending",
    "processing",
    "completed",
    "failed",
    "reversed",
  ]).notNull().default("pending"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 50 }),
}, (table) => ({
  remittanceIdx: index("remittance_idx").on(table.remittanceId),
  statusIdx: index("status_idx").on(table.status),
  nibssRefIdx: index("nibss_ref_idx").on(table.nibssReference),
}));

export type BankTransfer = typeof bankTransfers.$inferSelect;
export type InsertBankTransfer = typeof bankTransfers.$inferInsert;
