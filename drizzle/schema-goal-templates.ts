import { pgTable, serial, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * Savings Goal Templates Schema
 * 
 * Pre-built goal templates with recommended amounts and timelines
 */

export const goalTemplates = pgTable('goal_templates', {
  id: serial('id').primaryKey(),
  
  // Template details
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull(),
  icon: varchar('icon', { length: 50 }).notNull(), // emoji or icon name
  category: varchar('category', { length: 100 }).notNull(), // emergency, lifestyle, major_purchase, investment
  
  // Recommended amounts (in kobo)
  minAmount: integer('min_amount').notNull(),
  maxAmount: integer('max_amount').notNull(),
  recommendedAmount: integer('recommended_amount').notNull(),
  
  // Timeline recommendations
  minMonths: integer('min_months').notNull(),
  maxMonths: integer('max_months').notNull(),
  recommendedMonths: integer('recommended_months').notNull(),
  
  // Difficulty and success metrics
  difficulty: varchar('difficulty', { length: 50 }).notNull(), // easy, medium, hard
  successRate: integer('success_rate').notNull(), // 0-100 percentage
  popularityRank: integer('popularity_rank').notNull(), // 1-N ranking
  
  // Template configuration
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(true),
  
  // Tips and guidance
  tips: text('tips'), // JSON array of tips
  milestones: text('milestones'), // JSON array of milestone descriptions
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const goalTemplateUsage = pgTable('goal_template_usage', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  templateId: integer('template_id').notNull(),
  goalId: integer('goal_id').notNull(), // Reference to created savings goal
  
  // Customization tracking
  usedRecommendedAmount: boolean('used_recommended_amount').notNull(),
  usedRecommendedTimeline: boolean('used_recommended_timeline').notNull(),
  customAmount: integer('custom_amount'), // In kobo, if customized
  customMonths: integer('custom_months'), // If customized
  
  // Success tracking
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  daysToComplete: integer('days_to_complete'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
