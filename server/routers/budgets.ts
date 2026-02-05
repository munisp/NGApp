import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { budgets, budgetAlerts, bankTransactions } from '../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

export const budgetsRouter = router({
  // Get all budgets for the current user
  getBudgets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const userBudgets = await db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, ctx.user.openId));
    
    return userBudgets;
  }),

  // Create a new budget
  createBudget: protectedProcedure
    .input(
      z.object({
        category: z.enum(['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'other']),
        monthlyLimit: z.number().positive(),
        alertThreshold: z.number().min(0).max(1).default(0.8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error('Database not available');
      
      const budgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const [newBudget] = await db
        .insert(budgets)
        .values({
          id: budgetId,
          userId: ctx.user.openId,
          category: input.category,
          monthlyLimit: input.monthlyLimit.toFixed(2),
          alertThreshold: input.alertThreshold.toFixed(2),
          isActive: true,
        })
        .returning();
      
      return newBudget;
    }),

  // Update an existing budget
  updateBudget: protectedProcedure
    .input(
      z.object({
        budgetId: z.string(),
        monthlyLimit: z.number().positive().optional(),
        alertThreshold: z.number().min(0).max(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error('Database not available');
      
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (input.monthlyLimit !== undefined) {
        updateData.monthlyLimit = input.monthlyLimit.toFixed(2);
      }
      if (input.alertThreshold !== undefined) {
        updateData.alertThreshold = input.alertThreshold.toFixed(2);
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }
      
      const [updatedBudget] = await db
        .update(budgets)
        .set(updateData)
        .where(
          and(
            eq(budgets.id, input.budgetId),
            eq(budgets.userId, ctx.user.openId)
          )
        )
        .returning();
      
      if (!updatedBudget) {
        throw new Error('Budget not found');
      }
      
      return updatedBudget;
    }),

  // Delete a budget
  deleteBudget: protectedProcedure
    .input(z.object({ budgetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error('Database not available');
      
      await db
        .delete(budgets)
        .where(
          and(
            eq(budgets.id, input.budgetId),
            eq(budgets.userId, ctx.user.openId)
          )
        );
      
      return { success: true };
    }),

  // Get budget status for current month
  getBudgetStatus: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error('Database not available');
      
      // Get all active budgets for the user
      const userBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, ctx.user.openId),
            eq(budgets.isActive, true),
            input.category ? eq(budgets.category, input.category) : sql`true`
          )
        );
      
      // Calculate spending for each budget category from transactions
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      
      const budgetStatus = await Promise.all(
        userBudgets.map(async (budget) => {
          const monthlyLimit = parseFloat(budget.monthlyLimit);
          const alertThreshold = parseFloat(budget.alertThreshold);
          
          // Calculate actual spending from transactions for this month
          const monthlyTransactions = await db
            .select()
            .from(bankTransactions)
            .where(
              and(
                eq(bankTransactions.userId, ctx.user.openId),
                eq(bankTransactions.category, budget.category),
                eq(bankTransactions.type, 'debit'),
                sql`strftime('%Y-%m', ${bankTransactions.transactionDate}) = ${currentMonth}`
              )
            );
          
          const amountSpent = monthlyTransactions.reduce(
            (sum, txn) => sum + parseFloat(txn.amount),
            0
          );
          
          const percentageUsed = (amountSpent / monthlyLimit) * 100;
          const isOverBudget = amountSpent > monthlyLimit;
          const isNearLimit = percentageUsed >= alertThreshold * 100;
          
          return {
            budgetId: budget.id,
            category: budget.category,
            monthlyLimit,
            amountSpent,
            remaining: Math.max(0, monthlyLimit - amountSpent),
            percentageUsed,
            alertThreshold: alertThreshold * 100,
            isOverBudget,
            isNearLimit,
          };
        })
      );
      
      return budgetStatus;
    }),

  // Check budgets and send alerts if needed
  checkBudgetsAndAlert: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Get all active budgets
    const userBudgets = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, ctx.user.openId),
          eq(budgets.isActive, true)
        )
      );
    
    const alerts = [];
    
    for (const budget of userBudgets as any[]) {
      const monthlyLimit = parseFloat(budget.monthlyLimit);
      const alertThreshold = parseFloat(budget.alertThreshold);
      
      // TODO: Calculate actual spending from transactions
      const amountSpent = 0;
      const percentageUsed = amountSpent / monthlyLimit;
      
      // Check if we've already sent an alert this month
      const existingAlert = await db
        .select()
        .from(budgetAlerts)
        .where(
          and(
            eq(budgetAlerts.budgetId, budget.id),
            eq(budgetAlerts.month, currentMonth)
          )
        )
        .limit(1);
      
      if (existingAlert.length > 0) {
        continue; // Already sent alert this month
      }
      
      let alertType: 'threshold' | 'exceeded' | null = null;
      
      if (amountSpent > monthlyLimit) {
        alertType = 'exceeded';
      } else if (percentageUsed >= alertThreshold) {
        alertType = 'threshold';
      }
      
      if (alertType) {
        // Create alert record
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await db.insert(budgetAlerts).values({
          id: alertId,
          budgetId: budget.id,
          userId: ctx.user.openId,
          month: currentMonth,
          alertType,
          amountSpent: amountSpent.toFixed(2),
          budgetLimit: monthlyLimit.toFixed(2),
        });
        
        alerts.push({
          category: budget.category,
          alertType,
          amountSpent,
          monthlyLimit,
          percentageUsed: percentageUsed * 100,
        });
      }
    }
    
    return { alerts };
  }),
});
