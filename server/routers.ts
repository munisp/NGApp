import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import advisorRouter from "./routers/advisor.js";
import { predictiveAlertsRouter } from "./routers/predictive-alerts.js";
import { taxExportRouter } from "./routers/tax-export.js";
import { taxOptimizationRouter } from "./routers/tax-optimization.js";
import { expenseForecastRouter } from "./routers/expense-forecast.js";
import { smartNotificationsRouter } from "./routers/smart-notifications.js";
import { africanMarketsRouter } from "./routers/african-markets.js";
import { mfaRouter } from "./routers/mfa.js";
import { bnplRouter } from "./routers/bnpl.js";
import { creditScoreRouter } from "./routers/credit-score.js";
import { developerPortalRouter } from "./routers/developer-portal.js";
import { openBankingRouter } from "./routers/open-banking.js";
import { categorizationRouter } from "./routers/categorization.js";
import { notificationsRouter } from "./routers/notifications.js";
import { ocrRouter } from "./routers/ocr.js";
import { voiceRouter } from './routers/voice.js';
import pushTestRouter from './routers/push-test.js';
import { paymentRemindersRouter } from './routers/payment-reminders.js';
import { budgetsRouter } from './routers/budgets.js';
import { budgetAnalyticsRouter } from './routers/budget-analytics.js';
import { savingsGoalsRouter } from './routers/savings-goals.js';
import { recurringContributionsRouter } from './routers/recurring-contributions.js';
import { budgetRecommendationsRouter } from './routers/budget-recommendations.js';
import { savingsChallengesRouter } from './routers/savings-challenges.js';
import { spendingAlertsRouter } from './routers/spending-alerts.js';
import { financialHealthRouter } from './routers/financial-health.js';
import { expenseCategoriesRouter } from './routers/expense-categories.js';
import { billRemindersRouter } from './routers/bill-reminders.js';
import { goalTemplatesRouter } from './routers/goal-templates.js';

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  predictiveAlerts: predictiveAlertsRouter,
  taxExport: taxExportRouter,
  taxOptimization: taxOptimizationRouter,
  expenseForecast: expenseForecastRouter,
  smartNotifications: smartNotificationsRouter,
  africanMarkets: africanMarketsRouter,
  mfa: mfaRouter,
  bnpl: bnplRouter,
  creditScore: creditScoreRouter,
  developerPortal: developerPortalRouter,
  openBanking: openBankingRouter,
  categorization: categorizationRouter,
  notifications: notificationsRouter,
  ocr: ocrRouter,
  voice: voiceRouter,
  pushTest: pushTestRouter,
  paymentReminders: paymentRemindersRouter,
  budgets: budgetsRouter,
  budgetAnalytics: budgetAnalyticsRouter,
  savingsGoals: savingsGoalsRouter,
  recurringContributions: recurringContributionsRouter,
  budgetRecommendations: budgetRecommendationsRouter,
  savingsChallenges: savingsChallengesRouter,
  spendingAlerts: spendingAlertsRouter,
  financialHealth: financialHealthRouter,
  expenseCategories: expenseCategoriesRouter,
  billReminders: billRemindersRouter,
  goalTemplates: goalTemplatesRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // AI-powered spending insights
  insights: router({
    analyze: protectedProcedure
      .input(
        z.object({
          transactions: z.array(
            z.object({
              id: z.string(),
              type: z.string(),
              amount: z.number(),
              category: z.string(),
              date: z.string(),
              description: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const { transactions } = input;

        // Calculate spending by category
        const categoryMap: { [key: string]: number } = {};
        let totalSpending = 0;

        transactions.forEach((txn) => {
          if (!categoryMap[txn.category]) {
            categoryMap[txn.category] = 0;
          }
          categoryMap[txn.category] += txn.amount;
          totalSpending += txn.amount;
        });

        // Prepare data for AI analysis
        const categoryBreakdown = Object.entries(categoryMap)
          .map(([category, amount]) => ({
            category,
            amount,
            percentage: (amount / totalSpending) * 100,
          }))
          .sort((a, b) => b.amount - a.amount);

        // Call AI to generate personalized insights
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a financial advisor analyzing spending patterns. Provide 4-5 concise, actionable insights about the user's spending. Each insight should be 1-2 sentences. Focus on:
1. Top spending categories and their impact
2. Spending trends and patterns
3. Practical money-saving recommendations
4. Budget allocation suggestions

Be friendly, encouraging, and specific. Use actual numbers from the data.`,
            },
            {
              role: "user",
              content: `Analyze this spending data:
Total Spending: $${totalSpending.toFixed(2)}
Number of Transactions: ${transactions.length}
Time Period: Last 30 days

Category Breakdown:
${categoryBreakdown.map((c) => `- ${c.category}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`).join("\n")}

Provide 4-5 specific insights and recommendations.`,
            },
          ],
        });

        // Parse AI response into individual insights
        const content = response.choices[0]?.message?.content;
        const aiText = typeof content === 'string' ? content : "";
        const insights = aiText
          .split("\n")
          .filter((line: string) => line.trim().length > 0 && /^\d+\./.test(line.trim()))
          .map((line: string) => line.replace(/^\d+\.\s*/, "").trim());

        return {
          insights: insights.length > 0 ? insights : [aiText],
          categoryBreakdown,
          totalSpending,
          avgDailySpending: totalSpending / 30,
        };
      }),

    categorize: protectedProcedure
      .input(
        z.object({
          description: z.string(),
          amount: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const { description, amount } = input;

        // Use AI to categorize transaction
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a transaction categorization system. Categorize transactions into one of these categories:
- food: Food & Dining (restaurants, groceries, cafes)
- transport: Transportation (gas, uber, parking, public transit)
- shopping: Shopping (clothes, electronics, online purchases)
- bills: Bills & Utilities (electricity, water, internet, phone)
- entertainment: Entertainment (movies, games, subscriptions)
- health: Health & Fitness (gym, pharmacy, doctor)
- other: Other

Respond with ONLY the category key (e.g., "food", "transport", etc.). No explanation.`,
            },
            {
              role: "user",
              content: `Categorize this transaction:
Description: ${description}
Amount: $${amount.toFixed(2)}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        const category = (typeof content === 'string' ? content.trim().toLowerCase() : "other");

        // Validate category
        const validCategories = ["food", "transport", "shopping", "bills", "entertainment", "health", "other"];
        const finalCategory = validCategories.includes(category) ? category : "other";

        return { category: finalCategory };
      }),
  }),
});

export type AppRouter = typeof appRouter;
