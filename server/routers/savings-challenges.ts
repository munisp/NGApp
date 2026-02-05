import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { savingsChallenges, challengeProgress, challengeLeaderboard, achievements } from '../../drizzle/schema-challenges';
import { bankTransactions } from '../db/schema/open-banking';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export const savingsChallengesRouter = router({
  /**
   * Get all challenges for the current user
   */
  getChallenges: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const userChallenges = await db
      .select()
      .from(savingsChallenges)
      .where(eq(savingsChallenges.userId, ctx.user.openId))
      .orderBy(desc(savingsChallenges.createdAt));

    return userChallenges;
  }),

  /**
   * Start a new challenge
   */
  startChallenge: protectedProcedure
    .input(
      z.object({
        challengeType: z.enum(['52-week', 'no-spend-month', 'round-up']),
        targetAmount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const now = new Date();
      const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let endDate: Date;
      let targetAmount: number;

      // Calculate end date and target amount based on challenge type
      switch (input.challengeType) {
        case '52-week':
          // 52-week challenge: Save incrementally for 52 weeks
          // Week 1: $1, Week 2: $2, ..., Week 52: $52
          // Total: $1,378
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() + 364); // 52 weeks
          targetAmount = input.targetAmount || 1378;
          break;

        case 'no-spend-month':
          // No-spend month: No discretionary spending for 30 days
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() + 30);
          targetAmount = input.targetAmount || 0; // Goal is to not spend, not to save a specific amount
          break;

        case 'round-up':
          // Round-up challenge: Round up every transaction and save the difference
          // Target based on average transaction count
          endDate = new Date(now);
          endDate.setMonth(endDate.getMonth() + 3); // 3 months
          targetAmount = input.targetAmount || 100; // Estimated savings
          break;

        default:
          throw new Error('Invalid challenge type');
      }

      await db.insert(savingsChallenges).values({
        id: challengeId,
        userId: ctx.user.openId,
        challengeType: input.challengeType,
        status: 'active',
        startDate: now,
        endDate,
        targetAmount: targetAmount.toFixed(2),
        currentAmount: '0',
        weekNumber: input.challengeType === '52-week' ? 1 : undefined,
        consecutiveDays: input.challengeType === 'no-spend-month' ? 0 : undefined,
        roundUpCount: input.challengeType === 'round-up' ? 0 : undefined,
      });

      // Check for first challenge achievement
      const existingChallenges = await db
        .select()
        .from(savingsChallenges)
        .where(eq(savingsChallenges.userId, ctx.user.openId));

      if (existingChallenges.length === 1) {
        // First challenge achievement
        await db.insert(achievements).values({
          id: `achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: ctx.user.openId,
          achievementType: 'first_challenge',
          title: 'First Steps',
          description: 'Started your first savings challenge',
          icon: '🎯',
        });
      }

      return { challengeId, message: 'Challenge started successfully!' };
    }),

  /**
   * Record progress for a challenge
   */
  recordProgress: protectedProcedure
    .input(
      z.object({
        challengeId: z.string(),
        amount: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const challenge = await db
        .select()
        .from(savingsChallenges)
        .where(
          and(
            eq(savingsChallenges.id, input.challengeId),
            eq(savingsChallenges.userId, ctx.user.openId)
          )
        )
        .limit(1);

      if (!challenge || challenge.length === 0) {
        throw new Error('Challenge not found');
      }

      const currentChallenge = challenge[0];

      if (currentChallenge.status !== 'active') {
        throw new Error('Challenge is not active');
      }

      const now = new Date();
      const progressId = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Record progress
      await db.insert(challengeProgress).values({
        id: progressId,
        challengeId: input.challengeId,
        userId: ctx.user.openId,
        progressDate: now,
        amount: input.amount.toFixed(2),
        notes: input.notes,
      });

      // Update challenge current amount
      const newAmount = parseFloat(currentChallenge.currentAmount) + input.amount;

      const updateData: Record<string, any> = {
        currentAmount: newAmount.toFixed(2),
        updatedAt: now,
      };

      // Update week number for 52-week challenge
      if (currentChallenge.challengeType === '52-week') {
        const weekNumber = (currentChallenge.weekNumber || 1) + 1;
        updateData.weekNumber = weekNumber;

        // Check if challenge is completed
        if (weekNumber > 52) {
          updateData.status = 'completed';
          updateData.completedAt = now;
        }
      }

      // Update consecutive days for no-spend month
      if (currentChallenge.challengeType === 'no-spend-month') {
        const consecutiveDays = (currentChallenge.consecutiveDays || 0) + 1;
        updateData.consecutiveDays = consecutiveDays;

        // Check if challenge is completed
        if (consecutiveDays >= 30) {
          updateData.status = 'completed';
          updateData.completedAt = now;
        }
      }

      // Update round-up count
      if (currentChallenge.challengeType === 'round-up') {
        const roundUpCount = (currentChallenge.roundUpCount || 0) + 1;
        updateData.roundUpCount = roundUpCount;

        // Check if target amount is reached
        if (newAmount >= parseFloat(currentChallenge.targetAmount)) {
          updateData.status = 'completed';
          updateData.completedAt = now;
        }
      }

      await db
        .update(savingsChallenges)
        .set(updateData)
        .where(eq(savingsChallenges.id, input.challengeId));

      // Update leaderboard
      await updateLeaderboard(db, ctx.user.openId, currentChallenge.challengeType, input.amount);

      // Check for achievements
      if (updateData.status === 'completed') {
        await checkAchievements(db, ctx.user.openId);
      }

      return { message: 'Progress recorded successfully!', newAmount };
    }),

  /**
   * Pause a challenge
   */
  pauseChallenge: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(savingsChallenges)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(
          and(
            eq(savingsChallenges.id, input.challengeId),
            eq(savingsChallenges.userId, ctx.user.openId)
          )
        );

      return { message: 'Challenge paused' };
    }),

  /**
   * Resume a paused challenge
   */
  resumeChallenge: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(savingsChallenges)
        .set({ status: 'active', updatedAt: new Date() })
        .where(
          and(
            eq(savingsChallenges.id, input.challengeId),
            eq(savingsChallenges.userId, ctx.user.openId)
          )
        );

      return { message: 'Challenge resumed' };
    }),

  /**
   * Get challenge progress history
   */
  getChallengeProgress: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const progress = await db
        .select()
        .from(challengeProgress)
        .where(
          and(
            eq(challengeProgress.challengeId, input.challengeId),
            eq(challengeProgress.userId, ctx.user.openId)
          )
        )
        .orderBy(desc(challengeProgress.progressDate));

      return progress;
    }),

  /**
   * Get leaderboard
   */
  getLeaderboard: protectedProcedure
    .input(
      z.object({
        challengeType: z.enum(['52-week', 'no-spend-month', 'round-up']).optional(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      let query = db.select().from(challengeLeaderboard);

      if (input.challengeType) {
        query = query.where(eq(challengeLeaderboard.challengeType, input.challengeType)) as any;
      }

      const leaderboard = await query
        .orderBy(desc(challengeLeaderboard.totalSaved))
        .limit(input.limit);

      return leaderboard;
    }),

  /**
   * Get user achievements
   */
  getAchievements: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const userAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, ctx.user.openId))
      .orderBy(desc(achievements.earnedAt));

    return userAchievements;
  }),

  /**
   * Process round-up savings automatically
   */
  processRoundUps: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Find active round-up challenges
    const activeChallenges = await db
      .select()
      .from(savingsChallenges)
      .where(
        and(
          eq(savingsChallenges.userId, ctx.user.openId),
          eq(savingsChallenges.challengeType, 'round-up'),
          eq(savingsChallenges.status, 'active')
        )
      );

    if (activeChallenges.length === 0) {
      return { message: 'No active round-up challenges found', roundUps: [] };
    }

    const challenge = activeChallenges[0];

    // Get recent transactions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const transactions = await db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.userId, ctx.user.openId),
          eq(bankTransactions.type, 'debit'),
          gte(bankTransactions.transactionDate, sevenDaysAgo)
        )
      );

    const roundUps: Array<{ transactionId: string; amount: number; roundUp: number }> = [];

    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount);
      const roundedUp = Math.ceil(amount);
      const roundUpAmount = roundedUp - amount;

      if (roundUpAmount > 0) {
        roundUps.push({
          transactionId: transaction.id,
          amount,
          roundUp: roundUpAmount,
        });

        // Record progress
        await db.insert(challengeProgress).values({
          id: `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          challengeId: challenge.id,
          userId: ctx.user.openId,
          progressDate: new Date(),
          amount: roundUpAmount.toFixed(2),
          notes: `Round-up from transaction: ${transaction.description}`,
        });
      }
    }

    // Update challenge
    const totalRoundUp = roundUps.reduce((sum, r) => sum + r.roundUp, 0);
    const newAmount = parseFloat(challenge.currentAmount) + totalRoundUp;
    const newRoundUpCount = (challenge.roundUpCount || 0) + roundUps.length;

    await db
      .update(savingsChallenges)
      .set({
        currentAmount: newAmount.toFixed(2),
        roundUpCount: newRoundUpCount,
        updatedAt: new Date(),
      })
      .where(eq(savingsChallenges.id, challenge.id));

    // Update leaderboard
    if (totalRoundUp > 0) {
      await updateLeaderboard(db, ctx.user.openId, 'round-up', totalRoundUp);
    }

    return {
      message: `Processed ${roundUps.length} round-ups totaling $${totalRoundUp.toFixed(2)}`,
      roundUps,
    };
  }),
});

/**
 * Helper function to update leaderboard
 */
async function updateLeaderboard(
  db: any,
  userId: string,
  challengeType: string,
  amount: number
) {
  const existing = await db
    .select()
    .from(challengeLeaderboard)
    .where(
      and(
        eq(challengeLeaderboard.userId, userId),
        eq(challengeLeaderboard.challengeType, challengeType)
      )
    )
    .limit(1);

  const now = new Date();

  if (existing && existing.length > 0) {
    // Update existing entry
    const current = existing[0];
    const newTotal = parseFloat(current.totalSaved) + amount;

    await db
      .update(challengeLeaderboard)
      .set({
        totalSaved: newTotal.toFixed(2),
        lastUpdated: now,
      })
      .where(eq(challengeLeaderboard.id, current.id));
  } else {
    // Create new entry
    await db.insert(challengeLeaderboard).values({
      id: `leaderboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username: userId.substring(0, 8), // Use first 8 chars of userId as username
      challengeType,
      totalSaved: amount.toFixed(2),
      challengesCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastUpdated: now,
    });
  }
}

/**
 * Helper function to check and award achievements
 */
async function checkAchievements(db: any, userId: string) {
  const completedChallenges = await db
    .select()
    .from(savingsChallenges)
    .where(
      and(
        eq(savingsChallenges.userId, userId),
        eq(savingsChallenges.status, 'completed')
      )
    );

  const totalSaved = completedChallenges.reduce(
    (sum: number, c: any) => sum + parseFloat(c.currentAmount),
    0
  );

  const existingAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, userId));

  const achievementTypes = existingAchievements.map((a: any) => a.achievementType);

  // Check for saver achievements
  if (totalSaved >= 100 && !achievementTypes.includes('saver_100')) {
    await db.insert(achievements).values({
      id: `achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      achievementType: 'saver_100',
      title: 'Saver Starter',
      description: 'Saved $100 through challenges',
      icon: '💰',
    });
  }

  if (totalSaved >= 1000 && !achievementTypes.includes('saver_1000')) {
    await db.insert(achievements).values({
      id: `achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      achievementType: 'saver_1000',
      title: 'Savings Champion',
      description: 'Saved $1,000 through challenges',
      icon: '🏆',
    });
  }

  // Check for challenge master achievement
  if (completedChallenges.length >= 5 && !achievementTypes.includes('challenge_master')) {
    await db.insert(achievements).values({
      id: `achievement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      achievementType: 'challenge_master',
      title: 'Challenge Master',
      description: 'Completed 5 savings challenges',
      icon: '🎖️',
    });
  }
}
