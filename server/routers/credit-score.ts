import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { creditScores, creditScoreHistory, creditScoreFactors } from '../../drizzle/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { deliverWebhookEvent, WebhookEvents } from '../services/webhook-delivery';

// Credit score calculation factors
const PAYMENT_HISTORY_WEIGHT = 0.35;
const CREDIT_UTILIZATION_WEIGHT = 0.30;
const CREDIT_AGE_WEIGHT = 0.15;
const CREDIT_MIX_WEIGHT = 0.10;
const NEW_CREDIT_WEIGHT = 0.10;

interface CreditScoreFactors {
  paymentHistory: number; // 0-100
  creditUtilization: number; // 0-100
  creditAge: number; // 0-100
  creditMix: number; // 0-100
  newCredit: number; // 0-100
}

function calculateCreditScore(factors: CreditScoreFactors): number {
  const score = 
    factors.paymentHistory * PAYMENT_HISTORY_WEIGHT +
    factors.creditUtilization * CREDIT_UTILIZATION_WEIGHT +
    factors.creditAge * CREDIT_AGE_WEIGHT +
    factors.creditMix * CREDIT_MIX_WEIGHT +
    factors.newCredit * NEW_CREDIT_WEIGHT;

  // Convert to 300-850 range (standard credit score range)
  return Math.round(300 + (score / 100) * 550);
}

function getCreditRating(score: number): 'poor' | 'fair' | 'good' | 'very_good' | 'excellent' {
  if (score >= 800) return 'excellent';
  if (score >= 740) return 'very_good';
  if (score >= 670) return 'good';
  if (score >= 580) return 'fair';
  return 'poor';
}

function getCreditRecommendations(factors: CreditScoreFactors): string[] {
  const recommendations: string[] = [];

  if (factors.paymentHistory < 80) {
    recommendations.push('Pay all bills on time to improve your payment history');
  }
  if (factors.creditUtilization > 30) {
    recommendations.push('Reduce credit utilization below 30% for better score');
  }
  if (factors.creditAge < 50) {
    recommendations.push('Keep older accounts open to increase credit age');
  }
  if (factors.creditMix < 60) {
    recommendations.push('Consider diversifying your credit mix (loans, cards, etc.)');
  }
  if (factors.newCredit < 70) {
    recommendations.push('Avoid opening too many new accounts at once');
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Keep maintaining your excellent credit habits');
  }

  return recommendations;
}

async function getOrCreateCreditScore(db: any, userId: string) {
  // Try to get existing score
  const [existingScore] = await db
    .select()
    .from(creditScores)
    .where(eq(creditScores.userId, userId))
    .limit(1);

  if (existingScore) {
    // Get factors
    const factors = await db
      .select()
      .from(creditScoreFactors)
      .where(eq(creditScoreFactors.userId, userId));

    const factorsMap: CreditScoreFactors = {
      paymentHistory: 75,
      creditUtilization: 60,
      creditAge: 50,
      creditMix: 55,
      newCredit: 70,
    };

    factors.forEach((factor: any) => {
      const key = factor.factorType.replace(/_/g, '') as keyof CreditScoreFactors;
      if (key in factorsMap) {
        factorsMap[key as keyof CreditScoreFactors] = parseFloat(factor.value);
      }
    });

    return {
      score: existingScore.score,
      rating: existingScore.grade,
      factors: factorsMap,
      recommendations: getCreditRecommendations(factorsMap),
      lastUpdated: existingScore.lastCalculated.toISOString(),
    };
  }

  // Initialize with default factors for new users
  const factors: CreditScoreFactors = {
    paymentHistory: 75,
    creditUtilization: 60,
    creditAge: 50,
    creditMix: 55,
    newCredit: 70,
  };

  const score = calculateCreditScore(factors);
  const grade = getCreditRating(score);
  const now = new Date();

  // Create credit score record
  await db.insert(creditScores).values({
    userId,
    score,
    grade,
    lastCalculated: now,
    createdAt: now,
    updatedAt: now,
  });

  // Fire webhook event for credit score update
  await deliverWebhookEvent(
    'credit_score.updated',
    {
      score,
      grade,
      previousScore: null,
      change: null,
      calculatedAt: now.toISOString(),
    },
    userId
  );

  // Create factor records
  const factorRecords = [
    { factorType: 'payment_history', value: factors.paymentHistory, impact: 'positive' as const, weight: PAYMENT_HISTORY_WEIGHT.toString(), description: 'History of on-time payments' },
    { factorType: 'credit_utilization', value: factors.creditUtilization, impact: 'neutral' as const, weight: CREDIT_UTILIZATION_WEIGHT.toString(), description: 'Percentage of credit used' },
    { factorType: 'credit_age', value: factors.creditAge, impact: 'neutral' as const, weight: CREDIT_AGE_WEIGHT.toString(), description: 'Average age of credit accounts' },
    { factorType: 'credit_mix', value: factors.creditMix, impact: 'neutral' as const, weight: CREDIT_MIX_WEIGHT.toString(), description: 'Variety of credit types' },
    { factorType: 'new_credit', value: factors.newCredit, impact: 'neutral' as const, weight: NEW_CREDIT_WEIGHT.toString(), description: 'Recently opened accounts' },
  ];

  for (const factor of factorRecords) {
    await db.insert(creditScoreFactors).values({
      userId,
      factorType: factor.factorType,
      impact: factor.impact,
      weight: factor.weight,
      value: factor.value.toString(),
      description: factor.description,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Add to history
  await db.insert(creditScoreHistory).values({
    userId,
    score,
    grade,
    calculatedAt: now,
    createdAt: now,
  });

  return {
    score,
    rating: grade,
    factors,
    recommendations: getCreditRecommendations(factors),
    lastUpdated: now.toISOString(),
  };
}

export const creditScoreRouter = router({
  // Get current credit score
  getCurrentScore: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      return await getOrCreateCreditScore(db, userId);
    }),

  // Get credit score history
  getScoreHistory: protectedProcedure
    .input(z.object({
      months: z.number().min(1).max(24).default(12),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - input.months);

      const history = await db
        .select()
        .from(creditScoreHistory)
        .where(
          and(
            eq(creditScoreHistory.userId, userId),
            gte(creditScoreHistory.calculatedAt, cutoffDate)
          )
        )
        .orderBy(desc(creditScoreHistory.calculatedAt));

      return history.map((entry) => ({
        score: entry.score,
        date: entry.calculatedAt.toISOString(),
      }));
    }),

  // Update credit score (simulates real-time calculation based on user activity)
  updateScore: protectedProcedure
    .input(z.object({
      activity: z.enum(['payment_made', 'payment_missed', 'credit_used', 'credit_paid', 'account_opened', 'account_closed']),
      amount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      
      // Get current score data
      const scoreData = await getOrCreateCreditScore(db, userId);
      const factors = { ...scoreData.factors };
      const previousScore = scoreData.score;

      // Update factors based on activity
      switch (input.activity) {
        case 'payment_made':
          factors.paymentHistory = Math.min(100, factors.paymentHistory + 2);
          break;
        case 'payment_missed':
          factors.paymentHistory = Math.max(0, factors.paymentHistory - 10);
          break;
        case 'credit_used':
          factors.creditUtilization = Math.max(0, factors.creditUtilization - 5);
          break;
        case 'credit_paid':
          factors.creditUtilization = Math.min(100, factors.creditUtilization + 5);
          break;
        case 'account_opened':
          factors.newCredit = Math.max(0, factors.newCredit - 3);
          factors.creditMix = Math.min(100, factors.creditMix + 2);
          break;
        case 'account_closed':
          factors.creditAge = Math.max(0, factors.creditAge - 2);
          break;
      }

      // Recalculate score
      const newScore = calculateCreditScore(factors);
      const newGrade = getCreditRating(newScore);
      const now = new Date();

      // Update credit score record
      const prevScore = previousScore;
      await db
        .update(creditScores)
        .set({
          score: newScore,
          grade: newGrade,
          lastCalculated: now,
          updatedAt: now,
        })
        .where(eq(creditScores.userId, userId));

      // Fire webhook event for credit score update
      await deliverWebhookEvent(
        'credit_score.updated',
        {
          score: newScore,
          grade: newGrade,
          previousScore: prevScore,
          change: newScore - prevScore,
          calculatedAt: now.toISOString(),
        },
        userId
      );

      // Update factor records
      for (const [key, value] of Object.entries(factors)) {
        const factorType = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        await db
          .update(creditScoreFactors)
          .set({
            value: value.toString(),
            updatedAt: now,
          })
          .where(
            and(
              eq(creditScoreFactors.userId, userId),
              eq(creditScoreFactors.factorType, factorType)
            )
          );
      }

      // Add to history
      await db.insert(creditScoreHistory).values({
        userId,
        score: newScore,
        grade: newGrade,
        calculatedAt: now,
        createdAt: now,
      });

      return {
        success: true,
        previousScore,
        newScore,
        change: newScore - previousScore,
      };
    }),

  // Get credit score factors breakdown
  getFactorsBreakdown: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      const scoreData = await getOrCreateCreditScore(db, userId);

      return {
        factors: scoreData.factors,
        weights: {
          paymentHistory: PAYMENT_HISTORY_WEIGHT * 100,
          creditUtilization: CREDIT_UTILIZATION_WEIGHT * 100,
          creditAge: CREDIT_AGE_WEIGHT * 100,
          creditMix: CREDIT_MIX_WEIGHT * 100,
          newCredit: NEW_CREDIT_WEIGHT * 100,
        },
        impact: {
          paymentHistory: scoreData.factors.paymentHistory * PAYMENT_HISTORY_WEIGHT,
          creditUtilization: scoreData.factors.creditUtilization * CREDIT_UTILIZATION_WEIGHT,
          creditAge: scoreData.factors.creditAge * CREDIT_AGE_WEIGHT,
          creditMix: scoreData.factors.creditMix * CREDIT_MIX_WEIGHT,
          newCredit: scoreData.factors.newCredit * NEW_CREDIT_WEIGHT,
        },
      };
    }),

  // Simulate credit score improvement
  simulateImprovement: protectedProcedure
    .input(z.object({
      scenario: z.enum(['pay_off_debt', 'on_time_payments', 'reduce_utilization', 'keep_accounts_open']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      const scoreData = await getOrCreateCreditScore(db, userId);
      const factors = { ...scoreData.factors };

      // Simulate improvements
      switch (input.scenario) {
        case 'pay_off_debt':
          factors.creditUtilization = Math.min(100, factors.creditUtilization + 20);
          break;
        case 'on_time_payments':
          factors.paymentHistory = Math.min(100, factors.paymentHistory + 15);
          break;
        case 'reduce_utilization':
          factors.creditUtilization = Math.min(100, factors.creditUtilization + 10);
          break;
        case 'keep_accounts_open':
          factors.creditAge = Math.min(100, factors.creditAge + 10);
          break;
      }

      const simulatedScore = calculateCreditScore(factors);
      const improvement = simulatedScore - scoreData.score;

      return {
        currentScore: scoreData.score,
        simulatedScore,
        improvement,
        timeframe: '6-12 months',
        description: getScenarioDescription(input.scenario),
      };
    }),
});

function getScenarioDescription(scenario: string): string {
  switch (scenario) {
    case 'pay_off_debt':
      return 'Paying off existing debt will significantly reduce your credit utilization ratio';
    case 'on_time_payments':
      return 'Making all payments on time for 6-12 months will improve your payment history';
    case 'reduce_utilization':
      return 'Keeping credit utilization below 30% will positively impact your score';
    case 'keep_accounts_open':
      return 'Keeping older accounts open increases your average credit age';
    default:
      return '';
  }
}
