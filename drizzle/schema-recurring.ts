import { pgTable, text, timestamp, boolean, decimal, integer } from 'drizzle-orm/pg-core';

export const recurringContributions = pgTable('recurring_contributions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  goalId: text('goal_id').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  frequency: text('frequency').notNull(), // 'weekly', 'biweekly', 'monthly'
  dayOfMonth: integer('day_of_month'), // 1-31 for monthly, null for weekly/biweekly
  dayOfWeek: integer('day_of_week'), // 0-6 for weekly (0=Sunday), null for monthly
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'), // null = no end date
  isActive: boolean('is_active').notNull().default(true),
  lastProcessedAt: timestamp('last_processed_at'),
  nextProcessDate: timestamp('next_process_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const recurringContributionHistory = pgTable('recurring_contribution_history', {
  id: text('id').primaryKey(),
  recurringContributionId: text('recurring_contribution_id').notNull(),
  userId: text('user_id').notNull(),
  goalId: text('goal_id').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  status: text('status').notNull(), // 'success', 'failed', 'skipped'
  errorMessage: text('error_message'),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
});
