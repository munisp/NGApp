import { integer, pgEnum, pgTable, text, timestamp, varchar, bigint, serial } from "drizzle-orm/pg-core";

/**
 * PostgreSQL Enum Types
 * Note: PostgreSQL enums are global types, so each must have a unique name
 */
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const batchStatusEnum = pgEnum("batch_status", ["pending", "processing", "completed", "failed", "cancelled"]);

export const documentCategoryEnum = pgEnum("document_category", [
  "citizenship_identity",
  "immigration_status",
  "income_employment",
  "tribal_aian",
  "employer_health_coverage",
  "household_relationship",
  "other_supporting",
]);

export const documentStatusEnum = pgEnum("document_status", ["pending", "processing", "completed", "failed"]);

export const validationStatusEnum = pgEnum("validation_status", ["valid", "invalid", "partial", "not_validated"]);

export const notificationTypeEnum = pgEnum("notification_type", ["info", "success", "warning", "error", "critical"]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "system",
  "ocr_processing",
  "batch_processing",
  "lakehouse",
  "ingestion",
  "security",
  "admin"
]);

export const notificationPriorityEnum = pgEnum("notification_priority", ["low", "medium", "high", "urgent"]);

export const exportFormatEnum = pgEnum("export_format", ["csv", "json"]);

export const scheduleTypeEnum = pgEnum("schedule_type", ["once", "daily", "weekly", "monthly", "custom"]);

export const exportStatusEnum = pgEnum("export_status", ["pending", "processing", "completed", "failed"]);

export const lastStatusEnum = pgEnum("last_status", ["success", "failed", "skipped"]);

export const executionStatusEnum = pgEnum("execution_status", ["running", "success", "failed"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Batch upload tracking table
 */
export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }),
  totalFiles: integer("total_files").notNull().default(0),
  completedFiles: integer("completed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  status: batchStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

/**
 * Document metadata table
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  batchId: integer("batch_id"), // Optional: links to batch if uploaded as part of batch
  category: documentCategoryEnum("category").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  status: documentStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * OCR results table
 */
export const ocrResults = pgTable("ocr_results", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  extractedText: text("extracted_text"),
  confidence: integer("confidence").notNull(), // 0-100
  selectedEngine: varchar("selected_engine", { length: 50 }),
  strategy: varchar("strategy", { length: 50 }),
  processingTimeMs: integer("processing_time_ms"),
  extractedData: text("extracted_data"), // JSON string
  metadata: text("metadata"), // JSON string
  templateId: integer("template_id"), // Template used for extraction
  validationStatus: validationStatusEnum("validation_status").default("not_validated"),
  validationErrors: text("validation_errors"), // JSON array of validation errors
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OcrResult = typeof ocrResults.$inferSelect;
export type InsertOcrResult = typeof ocrResults.$inferInsert;

/**
 * System notifications table
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // Null for system-wide notifications
  type: notificationTypeEnum("type").notNull(),
  category: notificationCategoryEnum("category").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON string for additional data
  isRead: integer("is_read").notNull().default(0), // 0 = unread, 1 = read
  priority: notificationPriorityEnum("priority").default("medium").notNull(),
  actionUrl: varchar("action_url", { length: 512 }), // Optional link to related resource
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary notifications
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Scheduled export jobs table
 */
export const scheduledExports = pgTable("scheduled_exports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Export configuration
  exportFormat: exportFormatEnum("export_format").notNull().default("csv"),
  category: varchar("category", { length: 100 }), // Optional category filter
  status: exportStatusEnum("status"), // Optional status filter
  includeOcrResults: integer("include_ocr_results").notNull().default(1), // 0 = false, 1 = true
  selectedFields: text("selected_fields"), // JSON array of field names
  
  // Schedule configuration
  scheduleType: scheduleTypeEnum("schedule_type").notNull(),
  cronExpression: varchar("cron_expression", { length: 100 }), // For custom schedules
  nextRunAt: timestamp("next_run_at"), // Next scheduled execution time
  lastRunAt: timestamp("last_run_at"), // Last execution time
  
  // Email delivery
  emailRecipients: text("email_recipients"), // JSON array of email addresses
  emailSubject: varchar("email_subject", { length: 255 }),
  emailBody: text("email_body"),
  
  // Status and metadata
  isActive: integer("is_active").notNull().default(1), // 0 = paused, 1 = active
  runCount: integer("run_count").notNull().default(0),
  lastStatus: lastStatusEnum("last_status"),
  lastError: text("last_error"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ScheduledExport = typeof scheduledExports.$inferSelect;
export type InsertScheduledExport = typeof scheduledExports.$inferInsert;

/**
 * Export execution history table
 */
export const exportExecutions = pgTable("export_executions", {
  id: serial("id").primaryKey(),
  scheduledExportId: integer("scheduled_export_id").notNull(),
  
  status: executionStatusEnum("status").notNull(),
  recordsExported: integer("records_exported").default(0),
  fileUrl: text("file_url"), // S3 URL of generated export file
  fileSize: bigint("file_size", { mode: "number" }), // File size in bytes
  
  error: text("error"), // Error message if failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"), // Execution duration in milliseconds
});

export type ExportExecution = typeof exportExecutions.$inferSelect;
export type InsertExportExecution = typeof exportExecutions.$inferInsert;

/**
 * Custom document templates table (user-defined templates)
 */
export const customTemplates = pgTable("custom_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 10 }).default("📄"),
  
  // Template configuration
  category: varchar("category", { length: 100 }).notNull(),
  fields: text("fields").notNull(), // JSON array of field definitions
  ocrSettings: text("ocr_settings").notNull(), // JSON object with strategy and threshold
  
  // Sharing and visibility
  isPublic: integer("is_public").notNull().default(0), // 0 = private, 1 = public
  isActive: integer("is_active").notNull().default(1), // 0 = archived, 1 = active
  
  // Usage statistics
  useCount: integer("use_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CustomTemplate = typeof customTemplates.$inferSelect;
export type InsertCustomTemplate = typeof customTemplates.$inferInsert;
