import { pgTable, varchar, numeric, integer, timestamp, json, pgEnum, text } from 'drizzle-orm/pg-core';

export const creditGradeEnum = pgEnum('credit_grade', ['poor', 'fair', 'good', 'very_good', 'excellent']);
export const factorImpactEnum = pgEnum('factor_impact', ['positive', 'negative', 'neutral']);

export const creditScores = pgTable('credit_scores', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull().unique(),
  score: integer('score').notNull(), // 300-850 range
  grade: creditGradeEnum('grade').notNull(),
  lastCalculated: timestamp('last_calculated').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const creditScoreHistory = pgTable('credit_score_history', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  score: integer('score').notNull(),
  grade: creditGradeEnum('grade').notNull(),
  calculatedAt: timestamp('calculated_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const creditScoreFactors = pgTable('credit_score_factors', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  factorType: varchar('factor_type', { length: 100 }).notNull(), // payment_history, credit_utilization, etc.
  impact: factorImpactEnum('impact').notNull(),
  weight: numeric('weight', { precision: 5, scale: 2 }).notNull(), // 0.00-1.00
  value: numeric('value', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
