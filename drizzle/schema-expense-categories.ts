import { pgTable, serial, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

/**
 * Expense Categories Schema
 * 
 * Supports custom category creation, editing, merging, and splitting
 */

export const expenseCategories = pgTable('expense_categories', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(), // Icon name from IconSymbol
  color: varchar('color', { length: 7 }).notNull(), // Hex color code
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  parentCategoryId: integer('parent_category_id'), // For subcategories
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const categoryMergeHistory = pgTable('category_merge_history', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sourceCategoryIds: text('source_category_ids').notNull(), // JSON array of merged category IDs
  targetCategoryId: integer('target_category_id').notNull(),
  transactionsAffected: integer('transactions_affected').notNull(),
  mergedAt: timestamp('merged_at').notNull().defaultNow(),
});

export const categoryUsageStats = pgTable('category_usage_stats', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  categoryId: integer('category_id').notNull(),
  transactionCount: integer('transaction_count').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0), // In kobo
  lastUsedAt: timestamp('last_used_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
