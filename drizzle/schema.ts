import { integer, pgEnum, pgTable, text, timestamp, varchar, json, index, boolean, serial } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */

// Define enums for PostgreSQL
export const roleEnum = pgEnum('role', ['user', 'admin']);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default('user').notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Notification Preferences Table
 * Stores user notification settings
 */
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  
  // Notification channels
  pushEnabled: boolean('push_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  pushToken: text('push_token'),
  
  // Notification categories
  transactionNotifications: boolean('transaction_notifications').notNull().default(true),
  billNotifications: boolean('bill_notifications').notNull().default(true),
  goalNotifications: boolean('goal_notifications').notNull().default(true),
  balanceNotifications: boolean('balance_notifications').notNull().default(true),
  securityNotifications: boolean('security_notifications').notNull().default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

/**
 * Multi-Factor Authentication (MFA) Table
 * Stores TOTP secrets and backup codes for users
 */
export const userMfa = pgTable('user_mfa', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  
  // TOTP configuration
  totpSecret: varchar('totp_secret', { length: 255 }).notNull(), // Encrypted base32 secret
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  totpVerified: boolean('totp_verified').notNull().default(false),
  
  // Backup codes (encrypted, comma-separated)
  backupCodes: text('backup_codes'),
  backupCodesUsed: integer('backup_codes_used').notNull().default(0),
  
  // Recovery
  recoveryEmail: varchar('recovery_email', { length: 320 }),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => ({
  userIdIdx: index('mfa_user_id_idx').on(table.userId),
}));

export type UserMfa = typeof userMfa.$inferSelect;
export type InsertUserMfa = typeof userMfa.$inferInsert;

/**
 * MFA Audit Log Table
 * Tracks MFA-related events for security monitoring
 */
export const mfaEventEnum = pgEnum('mfa_event', [
  'mfa_enabled',
  'mfa_disabled',
  'mfa_verified',
  'mfa_failed',
  'backup_code_used',
  'backup_codes_regenerated',
  'recovery_email_updated'
]);

export const mfaAuditLog = pgTable('mfa_audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  
  // Event details
  event: mfaEventEnum('event').notNull(),
  
  // Context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  details: json('details'),
  
  // Timestamp
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('mfa_audit_user_id_idx').on(table.userId),
  createdAtIdx: index('mfa_audit_created_at_idx').on(table.createdAt),
}));

export type MfaAuditLog = typeof mfaAuditLog.$inferSelect;
export type InsertMfaAuditLog = typeof mfaAuditLog.$inferInsert;

/**
 * KYC Submissions Table
 * Stores KYC verification data with encrypted PII
 */
export const documentTypeEnum = pgEnum('document_type', ['national_id', 'passport', 'drivers_license', 'voters_card']);
export const kycStatusEnum = pgEnum('kyc_status', ['pending', 'approved', 'rejected', 'requires_review']);

export const kycSubmissions = pgTable('kyc_submissions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  
  // Document information
  documentType: documentTypeEnum('document_type').notNull(),
  documentNumber: text('document_number'), // Encrypted
  
  // Personal information (extracted from document)
  fullName: text('full_name'), // Encrypted
  dateOfBirth: text('date_of_birth'), // Encrypted
  address: text('address'), // Encrypted
  nationality: varchar('nationality', { length: 100 }),
  
  // Image URLs (S3)
  documentImageUrl: text('document_image_url').notNull(),
  selfieImageUrl: text('selfie_image_url').notNull(),
  
  // OCR results
  ocrData: json('ocr_data'), // Raw OCR extraction results
  
  // Facial recognition results
  facialRecognitionData: json('facial_recognition_data'), // Confidence, liveness check, etc.
  
  // Verification status
  status: kycStatusEnum('status').notNull().default('pending'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  
  // Rejection reason (if rejected)
  rejectionReason: text('rejection_reason'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('kyc_user_id_idx').on(table.userId),
  statusIdx: index('kyc_status_idx').on(table.status),
  createdAtIdx: index('kyc_created_at_idx').on(table.createdAt),
}));

export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type InsertKycSubmission = typeof kycSubmissions.$inferInsert;

/**
 * KYC Audit Log Table
 * Tracks all KYC-related actions for compliance
 */
export const kycActionEnum = pgEnum('kyc_action', ['submitted', 'approved', 'rejected', 'updated', 'viewed']);

export const kycAuditLog = pgTable('kyc_audit_log', {
  id: serial('id').primaryKey(),
  kycSubmissionId: integer('kyc_submission_id').notNull().references(() => kycSubmissions.id),
  userId: integer('user_id').notNull(),
  
  // Action details
  action: kycActionEnum('action').notNull(),
  performedBy: integer('performed_by').notNull(), // User ID or 0 for 'system'
  
  // Additional context
  details: json('details'), // Any additional data about the action
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  // Timestamp
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  kycSubmissionIdIdx: index('kyc_audit_submission_id_idx').on(table.kycSubmissionId),
  userIdIdx: index('kyc_audit_user_id_idx').on(table.userId),
  actionIdx: index('kyc_audit_action_idx').on(table.action),
  createdAtIdx: index('kyc_audit_created_at_idx').on(table.createdAt),
}));

export type KycAuditLog = typeof kycAuditLog.$inferSelect;
export type InsertKycAuditLog = typeof kycAuditLog.$inferInsert;

// Import schemas from server/db/schema directory
export * from '../server/db/schema/bnpl';
export * from '../server/db/schema/credit-score';
export * from '../server/db/schema/open-banking';
export * from '../server/db/schema/developer-portal';
export * from './schema-budgets';
export * from './schema-savings';
export * from './schema-recurring';
export * from './schema-challenges';
export * from './schema-spending-alerts';
export * from './schema-financial-health';
export * from './schema-expense-categories';
export * from './schema-bill-reminders';
export * from './schema-goal-templates';
