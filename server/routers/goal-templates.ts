import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { goalTemplates, goalTemplateUsage } from '../../drizzle/schema-goal-templates';
import { savingsGoals } from '../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Goal Templates Router
 * 
 * Pre-built savings goal templates with recommendations
 */

// Default templates data
const DEFAULT_TEMPLATES = [
  {
    name: 'Emergency Fund',
    description: 'Build a safety net for unexpected expenses. Experts recommend 3-6 months of living expenses.',
    icon: '🛡️',
    category: 'emergency',
    minAmount: 50000000, // ₦500,000
    maxAmount: 300000000, // ₦3,000,000
    recommendedAmount: 150000000, // ₦1,500,000
    minMonths: 3,
    maxMonths: 12,
    recommendedMonths: 6,
    difficulty: 'medium',
    successRate: 75,
    popularityRank: 1,
    tips: JSON.stringify([
      'Start with ₦50,000 and build from there',
      'Automate monthly contributions',
      'Keep funds in a high-yield savings account',
      'Only use for true emergencies'
    ]),
    milestones: JSON.stringify([
      '₦100,000 - First milestone reached!',
      '₦500,000 - Halfway to security',
      '₦1,000,000 - Major progress!',
      '₦1,500,000 - Fully protected!'
    ]),
  },
  {
    name: 'Vacation Fund',
    description: 'Save for your dream vacation without going into debt. Plan ahead and travel stress-free.',
    icon: '✈️',
    category: 'lifestyle',
    minAmount: 20000000, // ₦200,000
    maxAmount: 100000000, // ₦1,000,000
    recommendedAmount: 50000000, // ₦500,000
    minMonths: 3,
    maxMonths: 18,
    recommendedMonths: 12,
    difficulty: 'easy',
    successRate: 85,
    popularityRank: 2,
    tips: JSON.stringify([
      'Research destination costs early',
      'Book flights and hotels in advance',
      'Set aside extra for activities',
      'Consider travel insurance'
    ]),
    milestones: JSON.stringify([
      '₦125,000 - Flight money secured',
      '₦250,000 - Accommodation covered',
      '₦375,000 - Activities funded',
      '₦500,000 - Ready to travel!'
    ]),
  },
  {
    name: 'New Car',
    description: 'Save for a down payment or buy your car outright. Avoid high-interest auto loans.',
    icon: '🚗',
    category: 'major_purchase',
    minAmount: 100000000, // ₦1,000,000
    maxAmount: 500000000, // ₦5,000,000
    recommendedAmount: 250000000, // ₦2,500,000
    minMonths: 12,
    maxMonths: 36,
    recommendedMonths: 24,
    difficulty: 'hard',
    successRate: 60,
    popularityRank: 3,
    tips: JSON.stringify([
      'Research car prices and models',
      'Factor in insurance and maintenance',
      'Consider certified pre-owned options',
      'Negotiate when you have cash ready'
    ]),
    milestones: JSON.stringify([
      '₦625,000 - 25% down payment ready',
      '₦1,250,000 - Halfway there!',
      '₦1,875,000 - 75% complete',
      '₦2,500,000 - Car purchase ready!'
    ]),
  },
  {
    name: 'House Down Payment',
    description: 'Save for your first home. A 20% down payment helps you avoid PMI and get better rates.',
    icon: '🏠',
    category: 'major_purchase',
    minAmount: 500000000, // ₦5,000,000
    maxAmount: 2000000000, // ₦20,000,000
    recommendedAmount: 1000000000, // ₦10,000,000
    minMonths: 24,
    maxMonths: 60,
    recommendedMonths: 36,
    difficulty: 'hard',
    successRate: 50,
    popularityRank: 4,
    tips: JSON.stringify([
      'Aim for 20% down payment',
      'Factor in closing costs (2-5%)',
      'Get pre-approved for mortgage',
      'Research first-time buyer programs'
    ]),
    milestones: JSON.stringify([
      '₦2,500,000 - Strong start!',
      '₦5,000,000 - Halfway to homeownership',
      '₦7,500,000 - Almost there!',
      '₦10,000,000 - Ready to buy!'
    ]),
  },
  {
    name: 'Wedding Fund',
    description: 'Plan your special day without financial stress. Save for the wedding of your dreams.',
    icon: '💍',
    category: 'lifestyle',
    minAmount: 50000000, // ₦500,000
    maxAmount: 300000000, // ₦3,000,000
    recommendedAmount: 150000000, // ₦1,500,000
    minMonths: 6,
    maxMonths: 24,
    recommendedMonths: 12,
    difficulty: 'medium',
    successRate: 70,
    popularityRank: 5,
    tips: JSON.stringify([
      'Create detailed budget by category',
      'Book venue and vendors early',
      'Consider off-peak dates for savings',
      'Track RSVPs to manage costs'
    ]),
    milestones: JSON.stringify([
      '₦375,000 - Venue deposit secured',
      '₦750,000 - Major vendors booked',
      '₦1,125,000 - Almost ready!',
      '₦1,500,000 - Dream wedding funded!'
    ]),
  },
  {
    name: 'Education Fund',
    description: 'Invest in yourself or your children\'s future. Education is the best investment.',
    icon: '🎓',
    category: 'investment',
    minAmount: 100000000, // ₦1,000,000
    maxAmount: 1000000000, // ₦10,000,000
    recommendedAmount: 300000000, // ₦3,000,000
    minMonths: 12,
    maxMonths: 48,
    recommendedMonths: 24,
    difficulty: 'medium',
    successRate: 65,
    popularityRank: 6,
    tips: JSON.stringify([
      'Research program costs early',
      'Look for scholarships and grants',
      'Consider online programs for savings',
      'Factor in living expenses'
    ]),
    milestones: JSON.stringify([
      '₦750,000 - First semester covered',
      '₦1,500,000 - One year funded',
      '₦2,250,000 - Nearing completion',
      '₦3,000,000 - Education secured!'
    ]),
  },
];

export const goalTemplatesRouter = router({
  // Get all active templates
  getTemplates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    let templates = await db
      .select()
      .from(goalTemplates)
      .where(eq(goalTemplates.isActive, true))
      .orderBy(sql`${goalTemplates.popularityRank} ASC`);

    // If no templates exist, initialize with defaults
    if (templates.length === 0) {
      await db.insert(goalTemplates).values(DEFAULT_TEMPLATES);
      templates = await db
        .select()
        .from(goalTemplates)
        .where(eq(goalTemplates.isActive, true))
        .orderBy(sql`${goalTemplates.popularityRank} ASC`);
    }

    // Parse JSON fields
    const templatesWithParsed = templates.map(t => ({
      ...t,
      tips: t.tips ? JSON.parse(t.tips) : [],
      milestones: t.milestones ? JSON.parse(t.milestones) : [],
    }));

    return {
      templates: templatesWithParsed,
      categories: ['emergency', 'lifestyle', 'major_purchase', 'investment'],
    };
  }),

  // Get template by ID
  getTemplateById: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const [template] = await db
        .select()
        .from(goalTemplates)
        .where(eq(goalTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new Error('Template not found');
      }

      return {
        ...template,
        tips: template.tips ? JSON.parse(template.tips) : [],
        milestones: template.milestones ? JSON.parse(template.milestones) : [],
      };
    }),

  // Create goal from template
  createGoalFromTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.number(),
        customName: z.string().optional(),
        useRecommendedAmount: z.boolean().default(true),
        customAmount: z.number().positive().optional(),
        useRecommendedTimeline: z.boolean().default(true),
        customMonths: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Get template
      const [template] = await db
        .select()
        .from(goalTemplates)
        .where(eq(goalTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new Error('Template not found');
      }

      // Determine final amount and timeline
      const finalAmount = input.useRecommendedAmount
        ? template.recommendedAmount
        : input.customAmount
        ? Math.round(input.customAmount * 100)
        : template.recommendedAmount;

      const finalMonths = input.useRecommendedTimeline
        ? template.recommendedMonths
        : input.customMonths || template.recommendedMonths;

      // Calculate target date
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + finalMonths);

      // Create savings goal
      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const [newGoal] = await db
        .insert(savingsGoals)
        .values({
          id: goalId,
          userId: ctx.user.openId,
          name: input.customName || template.name,
          targetAmount: (finalAmount / 100).toString(), // Convert kobo to naira as decimal string
          currentAmount: '0',
          targetDate,
          category: template.category,
          icon: template.icon,
          isActive: true,
        })
        .returning();

      // Track template usage
      await db.insert(goalTemplateUsage).values({
        userId: ctx.user.openId,
        templateId: input.templateId,
        goalId: Number(newGoal.id),
        usedRecommendedAmount: input.useRecommendedAmount,
        usedRecommendedTimeline: input.useRecommendedTimeline,
        customAmount: input.customAmount ? Math.round(input.customAmount * 100) : null,
        customMonths: input.customMonths || null,
      });

      return {
        goal: newGoal,
        message: 'Goal created successfully from template',
      };
    }),

  // Get personalized recommendations based on income
  getRecommendations: protectedProcedure
    .input(z.object({ monthlyIncome: z.number().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const templates = await db
        .select()
        .from(goalTemplates)
        .where(eq(goalTemplates.isActive, true))
        .orderBy(sql`${goalTemplates.popularityRank} ASC`);

      if (templates.length === 0) {
        return { recommendations: [] };
      }

      // If income provided, adjust recommendations
      const monthlyIncome = input.monthlyIncome || 20000000; // Default ₦200,000

      const recommendations = templates.map(template => {
        // Calculate affordable monthly contribution (10-20% of income)
        const affordableContribution = Math.round(monthlyIncome * 0.15);
        
        // Calculate realistic timeline based on income
        const monthsNeeded = Math.ceil(template.recommendedAmount / affordableContribution);
        const adjustedMonths = Math.max(template.minMonths, Math.min(monthsNeeded, template.maxMonths * 2));
        
        // Calculate adjusted amount if timeline is too long
        const adjustedAmount = adjustedMonths > template.maxMonths * 1.5
          ? Math.round(affordableContribution * template.recommendedMonths)
          : template.recommendedAmount;

        // Determine priority based on category and income
        let priority = 'medium';
        if (template.category === 'emergency' && adjustedAmount < monthlyIncome * 3) {
          priority = 'high';
        } else if (template.difficulty === 'hard' && adjustedAmount > monthlyIncome * 12) {
          priority = 'low';
        }

        return {
          template: {
            ...template,
            tips: template.tips ? JSON.parse(template.tips) : [],
            milestones: template.milestones ? JSON.parse(template.milestones) : [],
          },
          recommendation: {
            suggestedAmount: adjustedAmount,
            suggestedMonths: adjustedMonths,
            monthlyContribution: affordableContribution,
            priority,
            reasoning: priority === 'high'
              ? 'Essential for financial security'
              : priority === 'low'
              ? 'Consider after building emergency fund'
              : 'Good goal for long-term planning',
          },
        };
      });

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => 
        priorityOrder[a.recommendation.priority as keyof typeof priorityOrder] - 
        priorityOrder[b.recommendation.priority as keyof typeof priorityOrder]
      );

      return { recommendations };
    }),

  // Get template usage statistics
  getTemplateStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const usage = await db
      .select()
      .from(goalTemplateUsage)
      .where(eq(goalTemplateUsage.userId, ctx.user.openId));

    const stats = {
      totalGoalsFromTemplates: usage.length,
      completedGoals: usage.filter(u => u.isCompleted).length,
      averageDaysToComplete: usage.filter(u => u.daysToComplete).length > 0
        ? Math.round(
            usage.filter(u => u.daysToComplete).reduce((sum, u) => sum + (u.daysToComplete || 0), 0) /
            usage.filter(u => u.daysToComplete).length
          )
        : null,
      mostUsedTemplate: null as any,
    };

    // Find most used template
    if (usage.length > 0) {
      const templateCounts = usage.reduce((acc, u) => {
        acc[u.templateId] = (acc[u.templateId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const mostUsedId = Object.entries(templateCounts).sort((a, b) => b[1] - a[1])[0][0];
      const [mostUsed] = await db
        .select()
        .from(goalTemplates)
        .where(eq(goalTemplates.id, parseInt(mostUsedId)))
        .limit(1);

      stats.mostUsedTemplate = mostUsed;
    }

    return stats;
  }),
});
