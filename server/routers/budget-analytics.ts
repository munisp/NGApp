import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { budgets, bankTransactions } from '../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

export const budgetAnalyticsRouter = router({
  // Get monthly spending trends for the past 12 months
  getMonthlyTrends: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get last 12 months
      const months = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: date.toISOString().slice(0, 7), // YYYY-MM
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        });
      }
      
      // Get spending for each month
      const monthlyData = await Promise.all(
        months.map(async ({ month, label }) => {
          const monthTransactions = await db
            .select()
            .from(bankTransactions)
            .where(
              and(
                eq(bankTransactions.userId, ctx.user.openId),
                eq(bankTransactions.type, 'debit'),
                input.category ? eq(bankTransactions.category, input.category) : sql`true`,
                sql`strftime('%Y-%m', ${bankTransactions.transactionDate}) = ${month}`
              )
            );
          
          const totalSpent = monthTransactions.reduce(
            (sum, txn) => sum + parseFloat(txn.amount),
            0
          );
          
          return {
            month,
            label,
            totalSpent,
            transactionCount: monthTransactions.length,
          };
        })
      );
      
      return monthlyData;
    }),

  // Get spending by category for current month
  getCategoryBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Get all transactions for current month
    const monthTransactions = await db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.userId, ctx.user.openId),
          eq(bankTransactions.type, 'debit'),
          sql`strftime('%Y-%m', ${bankTransactions.transactionDate}) = ${currentMonth}`
        )
      );
    
    // Group by category
    const categoryMap: Record<string, { amount: number; count: number }> = {};
    
    monthTransactions.forEach((txn) => {
      const category = txn.category || 'other';
      if (!categoryMap[category]) {
        categoryMap[category] = { amount: 0, count: 0 };
      }
      categoryMap[category].amount += parseFloat(txn.amount);
      categoryMap[category].count += 1;
    });
    
    // Convert to array and calculate percentages
    const totalSpent = Object.values(categoryMap).reduce((sum, cat) => sum + cat.amount, 0);
    
    const breakdown = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: totalSpent > 0 ? (data.amount / totalSpent) * 100 : 0,
    }));
    
    // Sort by amount descending
    breakdown.sort((a, b) => b.amount - a.amount);
    
    return {
      breakdown,
      totalSpent,
      totalTransactions: monthTransactions.length,
    };
  }),

  // Get budget vs actual comparison
  getBudgetComparison: protectedProcedure.query(async ({ ctx }) => {
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
    
    // Calculate spending for each budget
    const comparison = await Promise.all(
      userBudgets.map(async (budget) => {
        const monthTransactions = await db
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
        
        const actualSpent = monthTransactions.reduce(
          (sum, txn) => sum + parseFloat(txn.amount),
          0
        );
        
        const budgetAmount = parseFloat(budget.monthlyLimit);
        const difference = budgetAmount - actualSpent;
        const percentageUsed = (actualSpent / budgetAmount) * 100;
        
        return {
          category: budget.category,
          budgetAmount,
          actualSpent,
          difference,
          percentageUsed,
          isOverBudget: actualSpent > budgetAmount,
        };
      })
    );
    
    return comparison;
  }),

  // Get overspending patterns
  getOverspendingPatterns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Get last 6 months
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date.toISOString().slice(0, 7)); // YYYY-MM
    }
    
    // Get active budgets
    const userBudgets = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, ctx.user.openId),
          eq(budgets.isActive, true)
        )
      );
    
    // Check overspending for each category across months
    const patterns = await Promise.all(
      userBudgets.map(async (budget) => {
        let overspendCount = 0;
        const monthlyData = [];
        
        for (const month of months) {
          const monthTransactions = await db
            .select()
            .from(bankTransactions)
            .where(
              and(
                eq(bankTransactions.userId, ctx.user.openId),
                eq(bankTransactions.category, budget.category),
                eq(bankTransactions.type, 'debit'),
                sql`strftime('%Y-%m', ${bankTransactions.transactionDate}) = ${month}`
              )
            );
          
          const spent = monthTransactions.reduce(
            (sum, txn) => sum + parseFloat(txn.amount),
            0
          );
          
          const budgetAmount = parseFloat(budget.monthlyLimit);
          const isOver = spent > budgetAmount;
          
          if (isOver) overspendCount++;
          
          monthlyData.push({
            month,
            spent,
            budget: budgetAmount,
            isOver,
          });
        }
        
        return {
          category: budget.category,
          overspendCount,
          totalMonths: months.length,
          overspendRate: (overspendCount / months.length) * 100,
          monthlyData,
        };
      })
    );
    
    // Sort by overspend rate descending
    patterns.sort((a, b) => b.overspendRate - a.overspendRate);
    
    return patterns;
  }),
});
