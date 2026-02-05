import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { recurringContributions, recurringContributionHistory, savingsGoals, savingsContributions } from '../../drizzle/schema';
import { eq, and, lte, desc } from 'drizzle-orm';

export const recurringContributionsRouter = router({
  // Get all recurring contributions for the current user
  getRecurringContributions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const recurring = await db
      .select()
      .from(recurringContributions)
      .where(eq(recurringContributions.userId, ctx.user.openId))
      .orderBy(desc(recurringContributions.createdAt));
    
    return recurring;
  }),

  // Create a new recurring contribution
  createRecurringContribution: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        amount: z.number().positive(),
        frequency: z.enum(['weekly', 'biweekly', 'monthly']),
        dayOfMonth: z.number().min(1).max(31).optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startDate: z.string(), // ISO date string
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Verify goal exists and belongs to user
      const [goal] = await db
        .select()
        .from(savingsGoals)
        .where(
          and(
            eq(savingsGoals.id, input.goalId),
            eq(savingsGoals.userId, ctx.user.openId)
          )
        );
      
      if (!goal) throw new Error('Goal not found');
      
      // Calculate next process date
      const startDate = new Date(input.startDate);
      let nextProcessDate = new Date(startDate);
      
      if (input.frequency === 'monthly' && input.dayOfMonth) {
        nextProcessDate.setDate(input.dayOfMonth);
        if (nextProcessDate < startDate) {
          nextProcessDate.setMonth(nextProcessDate.getMonth() + 1);
        }
      } else if (input.frequency === 'weekly' && input.dayOfWeek !== undefined) {
        const currentDay = nextProcessDate.getDay();
        const daysUntilTarget = (input.dayOfWeek - currentDay + 7) % 7;
        nextProcessDate.setDate(nextProcessDate.getDate() + daysUntilTarget);
      } else if (input.frequency === 'biweekly' && input.dayOfWeek !== undefined) {
        const currentDay = nextProcessDate.getDay();
        const daysUntilTarget = (input.dayOfWeek - currentDay + 7) % 7;
        nextProcessDate.setDate(nextProcessDate.getDate() + daysUntilTarget);
      }
      
      const recurringId = `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const [newRecurring] = await db
        .insert(recurringContributions)
        .values({
          id: recurringId,
          userId: ctx.user.openId,
          goalId: input.goalId,
          amount: input.amount.toFixed(2),
          frequency: input.frequency,
          dayOfMonth: input.dayOfMonth || null,
          dayOfWeek: input.dayOfWeek !== undefined ? input.dayOfWeek : null,
          startDate,
          endDate: input.endDate ? new Date(input.endDate) : null,
          isActive: true,
          lastProcessedAt: null,
          nextProcessDate,
        })
        .returning();
      
      return newRecurring;
    }),

  // Update a recurring contribution
  updateRecurringContribution: protectedProcedure
    .input(
      z.object({
        recurringId: z.string(),
        amount: z.number().positive().optional(),
        frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
        dayOfMonth: z.number().min(1).max(31).optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        isActive: z.boolean().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (input.amount !== undefined) updateData.amount = input.amount.toFixed(2);
      if (input.frequency !== undefined) updateData.frequency = input.frequency;
      if (input.dayOfMonth !== undefined) updateData.dayOfMonth = input.dayOfMonth;
      if (input.dayOfWeek !== undefined) updateData.dayOfWeek = input.dayOfWeek;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.endDate !== undefined) updateData.endDate = new Date(input.endDate);
      
      const [updated] = await db
        .update(recurringContributions)
        .set(updateData)
        .where(
          and(
            eq(recurringContributions.id, input.recurringId),
            eq(recurringContributions.userId, ctx.user.openId)
          )
        )
        .returning();
      
      return updated;
    }),

  // Delete a recurring contribution
  deleteRecurringContribution: protectedProcedure
    .input(z.object({ recurringId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db
        .delete(recurringContributions)
        .where(
          and(
            eq(recurringContributions.id, input.recurringId),
            eq(recurringContributions.userId, ctx.user.openId)
          )
        );
      
      return { success: true };
    }),

  // Get history for a recurring contribution
  getRecurringHistory: protectedProcedure
    .input(z.object({ recurringId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const history = await db
        .select()
        .from(recurringContributionHistory)
        .where(
          and(
            eq(recurringContributionHistory.recurringContributionId, input.recurringId),
            eq(recurringContributionHistory.userId, ctx.user.openId)
          )
        )
        .orderBy(desc(recurringContributionHistory.processedAt));
      
      return history;
    }),

  // Process due recurring contributions (called by cron job)
  processDueContributions: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const now = new Date();
    
    // Get all due recurring contributions
    const dueContributions = await db
      .select()
      .from(recurringContributions)
      .where(
        and(
          eq(recurringContributions.userId, ctx.user.openId),
          eq(recurringContributions.isActive, true),
          lte(recurringContributions.nextProcessDate, now)
        )
      );
    
    const results = [];
    
    for (const recurring of dueContributions) {
      try {
        // Check if end date has passed
        if (recurring.endDate && new Date(recurring.endDate) < now) {
          await db
            .update(recurringContributions)
            .set({ isActive: false, updatedAt: now })
            .where(eq(recurringContributions.id, recurring.id));
          
          results.push({
            recurringId: recurring.id,
            status: 'skipped',
            reason: 'End date reached',
          });
          continue;
        }
        
        // Create contribution
        const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await db.insert(savingsContributions).values({
          id: contributionId,
          goalId: recurring.goalId,
          userId: recurring.userId,
          amount: recurring.amount,
          note: `Recurring contribution (${recurring.frequency})`,
        });
        
        // Update goal current amount
        const [goal] = await db
          .select()
          .from(savingsGoals)
          .where(eq(savingsGoals.id, recurring.goalId));
        
        if (goal) {
          const newCurrentAmount = parseFloat(goal.currentAmount) + parseFloat(recurring.amount);
          const targetAmount = parseFloat(goal.targetAmount);
          const isCompleted = newCurrentAmount >= targetAmount;
          
          await db
            .update(savingsGoals)
            .set({
              currentAmount: newCurrentAmount.toFixed(2),
              isCompleted,
              completedAt: isCompleted ? now : null,
              updatedAt: now,
            })
            .where(eq(savingsGoals.id, recurring.goalId));
        }
        
        // Calculate next process date
        let nextProcessDate = new Date(recurring.nextProcessDate);
        
        if (recurring.frequency === 'monthly') {
          nextProcessDate.setMonth(nextProcessDate.getMonth() + 1);
        } else if (recurring.frequency === 'weekly') {
          nextProcessDate.setDate(nextProcessDate.getDate() + 7);
        } else if (recurring.frequency === 'biweekly') {
          nextProcessDate.setDate(nextProcessDate.getDate() + 14);
        }
        
        // Update recurring contribution
        await db
          .update(recurringContributions)
          .set({
            lastProcessedAt: now,
            nextProcessDate,
            updatedAt: now,
          })
          .where(eq(recurringContributions.id, recurring.id));
        
        // Record history
        const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(recurringContributionHistory).values({
          id: historyId,
          recurringContributionId: recurring.id,
          userId: recurring.userId,
          goalId: recurring.goalId,
          amount: recurring.amount,
          status: 'success',
          errorMessage: null,
        });
        
        results.push({
          recurringId: recurring.id,
          status: 'success',
          amount: recurring.amount,
        });
      } catch (error) {
        // Record failure
        const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.insert(recurringContributionHistory).values({
          id: historyId,
          recurringContributionId: recurring.id,
          userId: recurring.userId,
          goalId: recurring.goalId,
          amount: recurring.amount,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        
        results.push({
          recurringId: recurring.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return {
      processed: results.length,
      results,
    };
  }),
});
