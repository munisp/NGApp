import { pgTable, serial, varchar, text, timestamp, index, json } from 'drizzle-orm/pg-core';

/**
 * Categorization Corrections Table
 * Stores user corrections for ML model training
 */
export const categorizationCorrections = pgTable('categorization_corrections', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  transactionId: varchar('transaction_id', { length: 255 }).notNull(),
  description: text('description').notNull(),
  merchant: varchar('merchant', { length: 255 }),
  originalCategory: varchar('original_category', { length: 100 }),
  correctCategory: varchar('correct_category', { length: 100 }).notNull(),
  features: json('features'), // Extracted features for ML training
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('cat_corrections_user_id_idx').on(table.userId),
  categoryIdx: index('cat_corrections_category_idx').on(table.correctCategory),
  createdAtIdx: index('cat_corrections_created_at_idx').on(table.createdAt),
}));

export type CategorizationCorrection = typeof categorizationCorrections.$inferSelect;
export type InsertCategorizationCorrection = typeof categorizationCorrections.$inferInsert;

/**
 * Category Keywords Table
 * Stores learned keywords from user corrections
 */
export const categoryKeywords = pgTable('category_keywords', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 100 }).notNull(),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  weight: varchar('weight', { length: 10 }).notNull().default('1.0'), // Weight for ML scoring
  source: varchar('source', { length: 50 }).notNull().default('user_correction'), // 'default' or 'user_correction'
  userId: varchar('user_id', { length: 64 }), // null for global keywords
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index('cat_keywords_category_idx').on(table.category),
  keywordIdx: index('cat_keywords_keyword_idx').on(table.keyword),
}));

export type CategoryKeyword = typeof categoryKeywords.$inferSelect;
export type InsertCategoryKeyword = typeof categoryKeywords.$inferInsert;
