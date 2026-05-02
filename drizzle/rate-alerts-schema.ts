import { int, mysqlEnum, mysqlTable, decimal, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
import { users } from "./schema";

/**
 * Rate Alerts Schema
 * Allows users to set target exchange rates and receive notifications when rates are reached
 */

export const rateAlerts = mysqlTable("rate_alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id),
  
  // Alert configuration
  fromCurrency: varchar("from_currency", { length: 10 }).notNull(), // BTC, ETH, USDC, USDT
  toCurrency: varchar("to_currency", { length: 10 }).notNull(), // NGN
  targetRate: decimal("target_rate", { precision: 20, scale: 8 }).notNull(), // Target exchange rate
  condition: mysqlEnum("condition", ["above", "below", "exact"]).notNull(), // Trigger condition
  
  // Alert status
  status: mysqlEnum("status", ["active", "triggered", "expired", "cancelled"]).default("active").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  
  // Notification preferences
  notifyEmail: boolean("notify_email").default(true).notNull(),
  notifySms: boolean("notify_sms").default(false).notNull(),
  notifyPush: boolean("notify_push").default(true).notNull(),
  
  // Alert metadata
  expiresAt: timestamp("expires_at"), // Optional expiration
  triggeredAt: timestamp("triggered_at"), // When alert was triggered
  triggeredRate: decimal("triggered_rate", { precision: 20, scale: 8 }), // Rate when triggered
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const rateAlertHistory = mysqlTable("rate_alert_history", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alert_id").notNull().references(() => rateAlerts.id),
  userId: int("user_id").notNull().references(() => users.id),
  
  // Historical data
  fromCurrency: varchar("from_currency", { length: 10 }).notNull(),
  toCurrency: varchar("to_currency", { length: 10 }).notNull(),
  targetRate: decimal("target_rate", { precision: 20, scale: 8 }).notNull(),
  triggeredRate: decimal("triggered_rate", { precision: 20, scale: 8 }).notNull(),
  condition: varchar("condition", { length: 20 }).notNull(),
  
  // Notification details
  notificationsSent: text("notifications_sent"), // JSON array of notification types sent
  notificationStatus: mysqlEnum("notification_status", ["sent", "failed", "pending"]).notNull(),
  
  // Timestamps
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
});

export type RateAlert = typeof rateAlerts.$inferSelect;
export type InsertRateAlert = typeof rateAlerts.$inferInsert;
export type RateAlertHistory = typeof rateAlertHistory.$inferSelect;
export type InsertRateAlertHistory = typeof rateAlertHistory.$inferInsert;
