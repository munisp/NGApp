import { pgTable, text, timestamp, decimal, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * Savings challenges table
 * Stores available challenge types and user participation
 */
export const savingsChallenges = pgTable('savings_challenges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  challengeType: text('challenge_type').notNull(), // '52-week' | 'no-spend-month' | 'round-up'
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'failed' | 'paused'
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  targetAmount: decimal('target_amount', { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal('current_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  weekNumber: integer('week_number').default(1), // For 52-week challenge
  consecutiveDays: integer('consecutive_days').default(0), // For no-spend month
  roundUpCount: integer('round_up_count').default(0), // For round-up challenge
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

/**
 * Challenge progress table
 * Tracks weekly/daily progress for challenges
 */
export const challengeProgress = pgTable('challenge_progress', {
  id: text('id').primaryKey(),
  challengeId: text('challenge_id').notNull().references(() => savingsChallenges.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  progressDate: timestamp('progress_date').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Challenge leaderboard table
 * Stores user rankings and scores
 */
export const challengeLeaderboard = pgTable('challenge_leaderboard', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  challengeType: text('challenge_type').notNull(),
  totalSaved: decimal('total_saved', { precision: 10, scale: 2 }).notNull().default('0'),
  challengesCompleted: integer('challenges_completed').notNull().default(0),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  rank: integer('rank'),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});

/**
 * Achievements table
 * Stores user achievements and badges
 */
export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  achievementType: text('achievement_type').notNull(), // 'first_challenge' | 'streak_7' | 'streak_30' | 'saver_100' | 'saver_1000' | 'challenge_master'
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  earnedAt: timestamp('earned_at').notNull().defaultNow(),
});
