import { pgTable, text, timestamp, decimal, boolean } from 'drizzle-orm/pg-core';

/**
 * Spending alerts table
 * Stores alerts for unusual spending patterns
 */
export const spendingAlerts = pgTable('spending_alerts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  alertType: text('alert_type').notNull(), // 'duplicate_charge' | 'large_transaction' | 'merchant_change' | 'unusual_category' | 'spending_spike'
  transactionId: text('transaction_id'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  merchant: text('merchant'),
  category: text('category'),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // 'low' | 'medium' | 'high'
  isRead: boolean('is_read').notNull().default(false),
  isDismissed: boolean('is_dismissed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  readAt: timestamp('read_at'),
  dismissedAt: timestamp('dismissed_at'),
});

/**
 * Alert settings table
 * User preferences for spending alerts
 */
export const alertSettings = pgTable('alert_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  duplicateChargeEnabled: boolean('duplicate_charge_enabled').notNull().default(true),
  largeTransactionEnabled: boolean('large_transaction_enabled').notNull().default(true),
  largeTransactionThreshold: decimal('large_transaction_threshold', { precision: 10, scale: 2 }).notNull().default('500'),
  merchantChangeEnabled: boolean('merchant_change_enabled').notNull().default(true),
  unusualCategoryEnabled: boolean('unusual_category_enabled').notNull().default(true),
  spendingSpikeEnabled: boolean('spending_spike_enabled').notNull().default(true),
  pushNotificationsEnabled: boolean('push_notifications_enabled').notNull().default(true),
  emailNotificationsEnabled: boolean('email_notifications_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
