import { pgTable, text, timestamp, decimal, boolean } from 'drizzle-orm/pg-core';

/**
 * Budget tracking table
 * Stores user-defined spending limits per category
 */
export const budgets = pgTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  category: text('category').notNull(), // food, transport, shopping, bills, entertainment, health, other
  monthlyLimit: decimal('monthly_limit', { precision: 10, scale: 2 }).notNull(),
  alertThreshold: decimal('alert_threshold', { precision: 5, scale: 2 }).notNull().default('0.80'), // Alert when 80% spent
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Budget alerts table
 * Tracks when budget alerts have been sent to avoid duplicates
 */
export const budgetAlerts = pgTable('budget_alerts', {
  id: text('id').primaryKey(),
  budgetId: text('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  month: text('month').notNull(), // Format: YYYY-MM
  alertType: text('alert_type').notNull(), // 'threshold' | 'exceeded'
  amountSpent: decimal('amount_spent', { precision: 10, scale: 2 }).notNull(),
  budgetLimit: decimal('budget_limit', { precision: 10, scale: 2 }).notNull(),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
});
