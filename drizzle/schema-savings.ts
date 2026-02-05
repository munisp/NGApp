import { pgTable, text, timestamp, boolean, decimal } from 'drizzle-orm/pg-core';

export const savingsGoals = pgTable('savings_goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  targetAmount: decimal('target_amount', { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal('current_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  targetDate: timestamp('target_date').notNull(),
  category: text('category').notNull(), // e.g., 'emergency', 'vacation', 'home', 'education', 'other'
  icon: text('icon').notNull().default('💰'),
  isActive: boolean('is_active').notNull().default(true),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const savingsContributions = pgTable('savings_contributions', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  userId: text('user_id').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const savingsMilestones = pgTable('savings_milestones', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  userId: text('user_id').notNull(),
  percentage: decimal('percentage', { precision: 5, scale: 2 }).notNull(), // e.g., 25.00, 50.00, 75.00, 100.00
  achievedAt: timestamp('achieved_at').notNull().defaultNow(),
  notified: boolean('notified').notNull().default(false),
});
