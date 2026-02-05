import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { bankTransactions, budgets } from '../../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

interface BudgetRecommendation {
  category: string;
  currentSpending: number;
  recommendedBudget: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  potentialSavings: number;
}

interface IncomeAnalysis {
  averageMonthlyIncome: number;
  incomeStability: 'stable' | 'variable' | 'unstable';
  confidence: number;
}

/**
 * Analyze income patterns from transaction history
 */
async function analyzeIncome(userId: string): Promise<IncomeAnalysis> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Get all credit transactions (income) from last 6 months
  const incomeTransactions = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.userId, userId),
        eq(bankTransactions.type, 'credit'),
        gte(bankTransactions.transactionDate, sixMonthsAgo)
      )
    );

  if (incomeTransactions.length === 0) {
    return {
      averageMonthlyIncome: 0,
      incomeStability: 'unstable',
      confidence: 0,
    };
  }

  // Calculate monthly income totals
  const monthlyTotals: Record<string, number> = {};
  
  for (const transaction of incomeTransactions) {
    const month = new Date(transaction.transactionDate).toISOString().slice(0, 7); // YYYY-MM
    monthlyTotals[month] = (monthlyTotals[month] || 0) + parseFloat(transaction.amount);
  }

  const months = Object.keys(monthlyTotals);
  const totals = Object.values(monthlyTotals);
  const averageMonthlyIncome = totals.reduce((a, b) => a + b, 0) / totals.length;

  // Calculate standard deviation to determine stability
  const variance = totals.reduce((sum, val) => sum + Math.pow(val - averageMonthlyIncome, 2), 0) / totals.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / averageMonthlyIncome;

  let incomeStability: 'stable' | 'variable' | 'unstable';
  if (coefficientOfVariation < 0.15) {
    incomeStability = 'stable';
  } else if (coefficientOfVariation < 0.3) {
    incomeStability = 'variable';
  } else {
    incomeStability = 'unstable';
  }

  const confidence = Math.min(months.length / 6, 1); // More months = higher confidence

  return {
    averageMonthlyIncome,
    incomeStability,
    confidence,
  };
}

/**
 * Analyze spending patterns by category
 */
async function analyzeSpending(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Get all debit transactions (spending) from last 3 months
  const spendingTransactions = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.userId, userId),
        eq(bankTransactions.type, 'debit'),
        gte(bankTransactions.transactionDate, threeMonthsAgo)
      )
    );

  // Group by category and calculate average monthly spending
  const categoryTotals: Record<string, number> = {};
  
  for (const transaction of spendingTransactions) {
    const category = transaction.category || 'other';
    categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(transaction.amount);
  }

  // Convert to monthly averages (divide by 3 months)
  const monthlyAverages: Record<string, number> = {};
  for (const [category, total] of Object.entries(categoryTotals)) {
    monthlyAverages[category] = total / 3;
  }

  return monthlyAverages;
}

/**
 * Generate budget recommendations using the 50/30/20 rule with adjustments
 */
function generateRecommendations(
  income: IncomeAnalysis,
  spending: Record<string, number>
): BudgetRecommendation[] {
  const { averageMonthlyIncome, incomeStability } = income;

  // Apply safety buffer based on income stability
  const safetyMultiplier = incomeStability === 'stable' ? 1.0 : incomeStability === 'variable' ? 0.9 : 0.8;
  const availableIncome = averageMonthlyIncome * safetyMultiplier;

  // 50/30/20 rule: 50% needs, 30% wants, 20% savings
  const needsBudget = availableIncome * 0.5;
  const wantsBudget = availableIncome * 0.3;
  const savingsBudget = availableIncome * 0.2;

  // Category classifications
  const needsCategories = ['food', 'bills', 'transport', 'health'];
  const wantsCategories = ['shopping', 'entertainment'];
  const savingsCategories = ['other'];

  const recommendations: BudgetRecommendation[] = [];

  // Calculate total current spending by type
  const currentNeeds = Object.entries(spending)
    .filter(([cat]) => needsCategories.includes(cat))
    .reduce((sum, [, amount]) => sum + amount, 0);

  const currentWants = Object.entries(spending)
    .filter(([cat]) => wantsCategories.includes(cat))
    .reduce((sum, [, amount]) => sum + amount, 0);

  // Generate recommendations for needs categories
  const needsRatio = currentNeeds > 0 ? needsBudget / currentNeeds : 1;
  for (const category of needsCategories) {
    const currentSpending = spending[category] || 0;
    const recommendedBudget = Math.round(currentSpending * needsRatio);
    const potentialSavings = Math.max(0, currentSpending - recommendedBudget);

    let reasoning = '';
    let priority: 'high' | 'medium' | 'low' = 'medium';

    if (currentSpending > recommendedBudget * 1.2) {
      reasoning = `Your ${category} spending is ${Math.round(((currentSpending / recommendedBudget) - 1) * 100)}% above the recommended amount based on the 50/30/20 rule. Consider reducing expenses in this category.`;
      priority = 'high';
    } else if (currentSpending > recommendedBudget) {
      reasoning = `Your ${category} spending is slightly above the recommended amount. Small adjustments could free up funds for savings.`;
      priority = 'medium';
    } else {
      reasoning = `Your ${category} spending is within healthy limits. Maintain this level to stay on track.`;
      priority = 'low';
    }

    recommendations.push({
      category,
      currentSpending,
      recommendedBudget,
      reasoning,
      priority,
      potentialSavings,
    });
  }

  // Generate recommendations for wants categories
  const wantsRatio = currentWants > 0 ? wantsBudget / currentWants : 1;
  for (const category of wantsCategories) {
    const currentSpending = spending[category] || 0;
    const recommendedBudget = Math.round(currentSpending * wantsRatio);
    const potentialSavings = Math.max(0, currentSpending - recommendedBudget);

    let reasoning = '';
    let priority: 'high' | 'medium' | 'low' = 'medium';

    if (currentSpending > recommendedBudget * 1.5) {
      reasoning = `Your ${category} spending is significantly high. This is a discretionary category where you can make substantial cuts to boost savings.`;
      priority = 'high';
    } else if (currentSpending > recommendedBudget) {
      reasoning = `Consider reducing ${category} expenses to align with the 30% wants allocation. This will help you save more.`;
      priority = 'medium';
    } else {
      reasoning = `Your ${category} spending is reasonable. You're balancing wants well with your income.`;
      priority = 'low';
    }

    recommendations.push({
      category,
      currentSpending,
      recommendedBudget,
      reasoning,
      priority,
      potentialSavings,
    });
  }

  // Add savings recommendation
  const totalCurrentSpending = Object.values(spending).reduce((a, b) => a + b, 0);
  const currentSavings = Math.max(0, averageMonthlyIncome - totalCurrentSpending);
  const recommendedSavings = Math.round(savingsBudget);

  recommendations.push({
    category: 'savings',
    currentSpending: currentSavings,
    recommendedBudget: recommendedSavings,
    reasoning:
      currentSavings < recommendedSavings
        ? `You should aim to save at least 20% of your income (₦${recommendedSavings.toLocaleString()}). Currently saving ₦${currentSavings.toLocaleString()}.`
        : `Great job! You're meeting or exceeding the 20% savings goal. Keep it up!`,
    priority: currentSavings < recommendedSavings * 0.5 ? 'high' : 'medium',
    potentialSavings: Math.max(0, recommendedSavings - currentSavings),
  });

  // Sort by priority (high first)
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export const budgetRecommendationsRouter = router({
  // Get AI-powered budget recommendations
  getRecommendations: protectedProcedure.query(async ({ ctx }) => {
    const income = await analyzeIncome(ctx.user.openId);
    const spending = await analyzeSpending(ctx.user.openId);
    const recommendations = generateRecommendations(income, spending);

    return {
      income,
      spending,
      recommendations,
      summary: {
        totalCurrentSpending: Object.values(spending).reduce((a, b) => a + b, 0),
        totalRecommendedBudget: recommendations
          .filter((r) => r.category !== 'savings')
          .reduce((sum, r) => sum + r.recommendedBudget, 0),
        totalPotentialSavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0),
        highPriorityCount: recommendations.filter((r) => r.priority === 'high').length,
      },
    };
  }),

  // Apply recommendations by creating budgets
  applyRecommendations: protectedProcedure
    .input(z.object({ categories: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const income = await analyzeIncome(ctx.user.openId);
      const spending = await analyzeSpending(ctx.user.openId);
      const recommendations = generateRecommendations(income, spending);

      const applied = [];

      for (const category of input.categories) {
        const recommendation = recommendations.find((r) => r.category === category);
        if (!recommendation || recommendation.category === 'savings') continue;

        // Check if budget already exists
        const [existingBudget] = await db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.userId, ctx.user.openId),
              eq(budgets.category, category as any)
            )
          );

        const now = new Date();
        const budgetId = existingBudget?.id || `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (existingBudget) {
          // Update existing budget
          await db
            .update(budgets)
            .set({
              monthlyLimit: recommendation.recommendedBudget.toFixed(2),
              updatedAt: now,
            })
            .where(eq(budgets.id, budgetId));
        } else {
          // Create new budget
          await db.insert(budgets).values({
            id: budgetId,
            userId: ctx.user.openId,
            category: category as any,
            monthlyLimit: recommendation.recommendedBudget.toFixed(2),
            alertThreshold: '0.80',
          });
        }

        applied.push({
          category,
          amount: recommendation.recommendedBudget,
          action: existingBudget ? 'updated' : 'created',
        });
      }

      return {
        applied,
        message: `Successfully applied ${applied.length} budget recommendations`,
      };
    }),

  // Get spending insights
  getInsights: protectedProcedure.query(async ({ ctx }) => {
    const income = await analyzeIncome(ctx.user.openId);
    const spending = await analyzeSpending(ctx.user.openId);

    const totalSpending = Object.values(spending).reduce((a, b) => a + b, 0);
    const spendingRate = income.averageMonthlyIncome > 0 ? totalSpending / income.averageMonthlyIncome : 0;

    // Find highest spending category
    const sortedSpending = Object.entries(spending).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedSpending[0];

    const insights = [];

    // Income stability insight
    if (income.incomeStability === 'unstable') {
      insights.push({
        type: 'warning',
        title: 'Income Volatility Detected',
        message: 'Your income varies significantly month-to-month. Consider building a larger emergency fund (6 months of expenses).',
      });
    } else if (income.incomeStability === 'stable') {
      insights.push({
        type: 'success',
        title: 'Stable Income',
        message: 'Your income is consistent, which makes budgeting easier. Great foundation for financial planning!',
      });
    }

    // Spending rate insight
    if (spendingRate > 0.9) {
      insights.push({
        type: 'danger',
        title: 'High Spending Rate',
        message: `You're spending ${Math.round(spendingRate * 100)}% of your income. This leaves little room for savings or emergencies.`,
      });
    } else if (spendingRate > 0.8) {
      insights.push({
        type: 'warning',
        title: 'Moderate Spending Rate',
        message: `You're spending ${Math.round(spendingRate * 100)}% of your income. Try to reduce this to 70-80% for better savings.`,
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Healthy Spending Rate',
        message: `You're spending ${Math.round(spendingRate * 100)}% of your income. This leaves good room for savings!`,
      });
    }

    // Top spending category insight
    if (topCategory) {
      const [category, amount] = topCategory;
      const percentage = (amount / totalSpending) * 100;
      
      if (percentage > 40) {
        insights.push({
          type: 'info',
          title: `${category.charAt(0).toUpperCase() + category.slice(1)} Dominates Spending`,
          message: `${Math.round(percentage)}% of your spending goes to ${category}. Consider if this aligns with your priorities.`,
        });
      }
    }

    return {
      income,
      spending,
      totalSpending,
      spendingRate: Math.round(spendingRate * 100),
      insights,
    };
  }),
});
