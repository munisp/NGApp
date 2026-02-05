import { pgTable, serial, integer, decimal, timestamp, text, json, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './schema';

/**
 * Financial Health Scores Table
 * Stores monthly financial health score calculations
 * Score ranges from 0-100 based on 4 factors:
 * - Credit Score (30%)
 * - Savings Rate (25%)
 * - Debt-to-Income Ratio (25%)
 * - Budget Adherence (20%)
 */
export const financialHealthScores = pgTable('financial_health_scores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  
  // Overall score (0-100)
  overallScore: integer('overall_score').notNull(),
  
  // Component scores (0-100 each)
  creditScoreComponent: integer('credit_score_component').notNull(),
  savingsRateComponent: integer('savings_rate_component').notNull(),
  debtToIncomeComponent: integer('debt_to_income_component').notNull(),
  budgetAdherenceComponent: integer('budget_adherence_component').notNull(),
  
  // Raw values used for calculation
  creditScore: integer('credit_score'), // Actual credit score (300-850)
  savingsRate: decimal('savings_rate', { precision: 5, scale: 2 }), // Percentage (0-100)
  debtToIncomeRatio: decimal('debt_to_income_ratio', { precision: 5, scale: 2 }), // Percentage (0-100+)
  budgetAdherence: decimal('budget_adherence', { precision: 5, scale: 2 }), // Percentage (0-100)
  
  // Monthly income/expense data
  monthlyIncome: decimal('monthly_income', { precision: 12, scale: 2 }),
  monthlyExpenses: decimal('monthly_expenses', { precision: 12, scale: 2 }),
  monthlyDebtPayments: decimal('monthly_debt_payments', { precision: 12, scale: 2 }),
  monthlySavings: decimal('monthly_savings', { precision: 12, scale: 2 }),
  
  // Score period
  scoreMonth: integer('score_month').notNull(), // 1-12
  scoreYear: integer('score_year').notNull(), // e.g., 2026
  
  // Metadata
  calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('financial_health_user_id_idx').on(table.userId),
  scoreMonthIdx: index('financial_health_score_month_idx').on(table.scoreMonth, table.scoreYear),
  userMonthIdx: index('financial_health_user_month_idx').on(table.userId, table.scoreMonth, table.scoreYear),
}));

export type FinancialHealthScore = typeof financialHealthScores.$inferSelect;
export type InsertFinancialHealthScore = typeof financialHealthScores.$inferInsert;

/**
 * Financial Health Recommendations Table
 * Stores personalized improvement tips based on weak scoring areas
 */
export const financialHealthRecommendations = pgTable('financial_health_recommendations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  scoreId: integer('score_id').notNull().references(() => financialHealthScores.id),
  
  // Recommendation details
  category: text('category').notNull(), // 'credit_score', 'savings_rate', 'debt_to_income', 'budget_adherence'
  priority: integer('priority').notNull(), // 1 (high) to 3 (low)
  title: text('title').notNull(),
  description: text('description').notNull(),
  actionItems: json('action_items').$type<string[]>(), // Array of actionable steps
  
  // Impact estimation
  potentialScoreIncrease: integer('potential_score_increase'), // Estimated points if followed
  
  // Status tracking
  isRead: boolean('is_read').notNull().default(false),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('financial_health_rec_user_id_idx').on(table.userId),
  scoreIdIdx: index('financial_health_rec_score_id_idx').on(table.scoreId),
  categoryIdx: index('financial_health_rec_category_idx').on(table.category),
}));

export type FinancialHealthRecommendation = typeof financialHealthRecommendations.$inferSelect;
export type InsertFinancialHealthRecommendation = typeof financialHealthRecommendations.$inferInsert;
