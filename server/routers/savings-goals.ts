import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { savingsGoals, savingsContributions, savingsMilestones } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export const savingsGoalsRouter = router({
  // Get all savings goals for the current user
  getGoals: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, ctx.user.openId))
      .orderBy(desc(savingsGoals.createdAt));
    
    // Calculate progress for each goal
    const goalsWithProgress = goals.map((goal) => {
      const current = parseFloat(goal.currentAmount);
      const target = parseFloat(goal.targetAmount);
      const progress = target > 0 ? (current / target) * 100 : 0;
      const remaining = Math.max(0, target - current);
      
      // Calculate days remaining
      const today = new Date();
      const targetDate = new Date(goal.targetDate);
      const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        ...goal,
        progress,
        remaining,
        daysRemaining,
      };
    });
    
    return goalsWithProgress;
  }),

  // Create a new savings goal
  createGoal: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        targetAmount: z.number().positive(),
        targetDate: z.string(), // ISO date string
        category: z.enum(['emergency', 'vacation', 'home', 'education', 'car', 'wedding', 'other']),
        icon: z.string().default('💰'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const [newGoal] = await db
        .insert(savingsGoals)
        .values({
          id: goalId,
          userId: ctx.user.openId,
          name: input.name,
          targetAmount: input.targetAmount.toFixed(2),
          currentAmount: '0',
          targetDate: new Date(input.targetDate),
          category: input.category,
          icon: input.icon,
          isActive: true,
          isCompleted: false,
        })
        .returning();
      
      return newGoal;
    }),

  // Add contribution to a savings goal
  addContribution: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        amount: z.number().positive(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get the goal
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
      
      // Create contribution record
      const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await db.insert(savingsContributions).values({
        id: contributionId,
        goalId: input.goalId,
        userId: ctx.user.openId,
        amount: input.amount.toFixed(2),
        note: input.note,
      });
      
      // Update goal current amount
      const newCurrentAmount = parseFloat(goal.currentAmount) + input.amount;
      const targetAmount = parseFloat(goal.targetAmount);
      const isCompleted = newCurrentAmount >= targetAmount;
      
      await db
        .update(savingsGoals)
        .set({
          currentAmount: newCurrentAmount.toFixed(2),
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(savingsGoals.id, input.goalId));
      
      // Check for milestone achievements
      const progress = (newCurrentAmount / targetAmount) * 100;
      const milestones = [25, 50, 75, 100];
      
      for (const milestone of milestones) {
        if (progress >= milestone) {
          // Check if milestone already exists
          const [existing] = await db
            .select()
            .from(savingsMilestones)
            .where(
              and(
                eq(savingsMilestones.goalId, input.goalId),
                eq(savingsMilestones.percentage, milestone.toString())
              )
            );
          
          if (!existing) {
            const milestoneId = `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.insert(savingsMilestones).values({
              id: milestoneId,
              goalId: input.goalId,
              userId: ctx.user.openId,
              percentage: milestone.toString(),
              achievedAt: new Date(),
              notified: false,
            });
          }
        }
      }
      
      return { success: true, newCurrentAmount, isCompleted };
    }),

  // Get contributions for a goal
  getContributions: protectedProcedure
    .input(z.object({ goalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const contributions = await db
        .select()
        .from(savingsContributions)
        .where(
          and(
            eq(savingsContributions.goalId, input.goalId),
            eq(savingsContributions.userId, ctx.user.openId)
          )
        )
        .orderBy(desc(savingsContributions.createdAt));
      
      return contributions;
    }),

  // Get milestones for a goal
  getMilestones: protectedProcedure
    .input(z.object({ goalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const milestones = await db
        .select()
        .from(savingsMilestones)
        .where(
          and(
            eq(savingsMilestones.goalId, input.goalId),
            eq(savingsMilestones.userId, ctx.user.openId)
          )
        )
        .orderBy(desc(savingsMilestones.achievedAt));
      
      return milestones;
    }),

  // Update a savings goal
  updateGoal: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        name: z.string().min(1).max(100).optional(),
        targetAmount: z.number().positive().optional(),
        targetDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.targetAmount !== undefined) updateData.targetAmount = input.targetAmount.toFixed(2);
      if (input.targetDate !== undefined) updateData.targetDate = new Date(input.targetDate);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      
      const [updatedGoal] = await db
        .update(savingsGoals)
        .set(updateData)
        .where(
          and(
            eq(savingsGoals.id, input.goalId),
            eq(savingsGoals.userId, ctx.user.openId)
          )
        )
        .returning();
      
      return updatedGoal;
    }),

  // Delete a savings goal
  deleteGoal: protectedProcedure
    .input(z.object({ goalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Delete contributions and milestones first
      await db
        .delete(savingsContributions)
        .where(eq(savingsContributions.goalId, input.goalId));
      
      await db
        .delete(savingsMilestones)
        .where(eq(savingsMilestones.goalId, input.goalId));
      
      // Delete the goal
      await db
        .delete(savingsGoals)
        .where(
          and(
            eq(savingsGoals.id, input.goalId),
            eq(savingsGoals.userId, ctx.user.openId)
          )
        );
      
      return { success: true };
    }),

  // Get unnotified milestones (for push notifications)
  getUnnotifiedMilestones: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const unnotifiedMilestones = await db
      .select()
      .from(savingsMilestones)
      .where(
        and(
          eq(savingsMilestones.userId, ctx.user.openId),
          eq(savingsMilestones.notified, false)
        )
      )
      .orderBy(desc(savingsMilestones.achievedAt));
    
    return unnotifiedMilestones;
  }),

  // Mark milestone as notified
  markMilestoneNotified: protectedProcedure
    .input(z.object({ milestoneId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db
        .update(savingsMilestones)
        .set({ notified: true })
        .where(
          and(
            eq(savingsMilestones.id, input.milestoneId),
            eq(savingsMilestones.userId, ctx.user.openId)
          )
        );
      
      return { success: true };
    }),
});
