import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Batch upload tracking table
 */
export const batches = mysqlTable("batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }),
  totalFiles: int("totalFiles").notNull().default(0),
  completedFiles: int("completedFiles").notNull().default(0),
  failedFiles: int("failedFiles").notNull().default(0),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

/**
 * Document metadata table
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  batchId: int("batchId"), // Optional: links to batch if uploaded as part of batch
  category: mysqlEnum("category", [
    "citizenship_identity",
    "immigration_status",
    "income_employment",
    "tribal_aian",
    "employer_health_coverage",
    "household_relationship",
    "other_supporting",
  ]).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * OCR results table
 */
export const ocrResults = mysqlTable("ocrResults", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  extractedText: text("extractedText"),
  confidence: int("confidence").notNull(), // 0-100
  selectedEngine: varchar("selectedEngine", { length: 50 }),
  strategy: varchar("strategy", { length: 50 }),
  processingTimeMs: int("processingTimeMs"),
  extractedData: text("extractedData"), // JSON string
  metadata: text("metadata"), // JSON string
  templateId: int("templateId"), // Template used for extraction
  validationStatus: mysqlEnum("validationStatus", ["valid", "invalid", "partial", "not_validated"]).default("not_validated"),
  validationErrors: text("validationErrors"), // JSON array of validation errors
  validatedAt: timestamp("validatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OcrResult = typeof ocrResults.$inferSelect;
export type InsertOcrResult = typeof ocrResults.$inferInsert;

/**
 * System notifications table
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Null for system-wide notifications
  type: mysqlEnum("type", ["info", "success", "warning", "error", "critical"]).notNull(),
  category: mysqlEnum("category", [
    "system",
    "ocr_processing",
    "batch_processing",
    "lakehouse",
    "ingestion",
    "security",
    "admin"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON string for additional data
  isRead: int("isRead").notNull().default(0), // 0 = unread, 1 = read
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }), // Optional link to related resource
  expiresAt: timestamp("expiresAt"), // Optional expiration for temporary notifications
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Scheduled export jobs table
 */
export const scheduledExports = mysqlTable("scheduledExports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Export configuration
  exportFormat: mysqlEnum("exportFormat", ["csv", "json"]).notNull().default("csv"),
  category: varchar("category", { length: 100 }), // Optional category filter
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]), // Optional status filter
  includeOcrResults: int("includeOcrResults").notNull().default(1), // 0 = false, 1 = true
  selectedFields: text("selectedFields"), // JSON array of field names
  
  // Schedule configuration
  scheduleType: mysqlEnum("scheduleType", ["once", "daily", "weekly", "monthly", "custom"]).notNull(),
  cronExpression: varchar("cronExpression", { length: 100 }), // For custom schedules
  nextRunAt: timestamp("nextRunAt"), // Next scheduled execution time
  lastRunAt: timestamp("lastRunAt"), // Last execution time
  
  // Email delivery
  emailRecipients: text("emailRecipients"), // JSON array of email addresses
  emailSubject: varchar("emailSubject", { length: 255 }),
  emailBody: text("emailBody"),
  
  // Status and metadata
  isActive: int("isActive").notNull().default(1), // 0 = paused, 1 = active
  runCount: int("runCount").notNull().default(0),
  lastStatus: mysqlEnum("lastStatus", ["success", "failed", "skipped"]),
  lastError: text("lastError"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledExport = typeof scheduledExports.$inferSelect;
export type InsertScheduledExport = typeof scheduledExports.$inferInsert;

/**
 * Export execution history table
 */
export const exportExecutions = mysqlTable("exportExecutions", {
  id: int("id").autoincrement().primaryKey(),
  scheduledExportId: int("scheduledExportId").notNull(),
  
  status: mysqlEnum("status", ["running", "success", "failed"]).notNull(),
  recordsExported: int("recordsExported").default(0),
  fileUrl: text("fileUrl"), // S3 URL of generated export file
  fileSize: bigint("fileSize", { mode: "number" }), // File size in bytes
  
  error: text("error"), // Error message if failed
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"), // Execution duration in milliseconds
});

export type ExportExecution = typeof exportExecutions.$inferSelect;
export type InsertExportExecution = typeof exportExecutions.$inferInsert;

/**
 * Custom document templates table (user-defined templates)
 */
export const customTemplates = mysqlTable("customTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 10 }).default("📄"),
  
  // Template configuration
  category: varchar("category", { length: 100 }).notNull(),
  fields: text("fields").notNull(), // JSON array of field definitions
  ocrSettings: text("ocrSettings").notNull(), // JSON object with strategy and threshold
  
  // Sharing and visibility
  isPublic: int("isPublic").notNull().default(0), // 0 = private, 1 = public
  isActive: int("isActive").notNull().default(1), // 0 = archived, 1 = active
  
  // Usage statistics
  useCount: int("useCount").notNull().default(0),
  lastUsedAt: timestamp("lastUsedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomTemplate = typeof customTemplates.$inferSelect;
export type InsertCustomTemplate = typeof customTemplates.$inferInsert;
