import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { spendingAlerts, alertSettings } from '../../drizzle/schema-spending-alerts';
import { bankTransactions } from '../db/schema/open-banking';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

export const spendingAlertsRouter = router({
  /**
   * Get all alerts for the current user
   */
  getAlerts: protectedProcedure
    .input(
      z.object({
        includeRead: z.boolean().optional().default(false),
        includeDismissed: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const conditions = [eq(spendingAlerts.userId, ctx.user.openId)];
      
      if (!input.includeRead) {
        conditions.push(eq(spendingAlerts.isRead, false));
      }
      
      if (!input.includeDismissed) {
        conditions.push(eq(spendingAlerts.isDismissed, false));
      }

      const alerts = await db
        .select()
        .from(spendingAlerts)
        .where(and(...conditions))
        .orderBy(desc(spendingAlerts.createdAt))
        .limit(50);

      return alerts;
    }),

  /**
   * Get alert settings for the current user
   */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const settings = await db
      .select()
      .from(alertSettings)
      .where(eq(alertSettings.userId, ctx.user.openId))
      .limit(1);

    if (settings.length === 0) {
      // Create default settings
      const defaultSettings = {
        id: `alert_settings_${Date.now()}`,
        userId: ctx.user.openId,
        duplicateChargeEnabled: true,
        largeTransactionEnabled: true,
        largeTransactionThreshold: '500',
        merchantChangeEnabled: true,
        unusualCategoryEnabled: true,
        spendingSpikeEnabled: true,
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(alertSettings).values(defaultSettings);
      return defaultSettings;
    }

    return settings[0];
  }),

  /**
   * Update alert settings
   */
  updateSettings: protectedProcedure
    .input(
      z.object({
        duplicateChargeEnabled: z.boolean().optional(),
        largeTransactionEnabled: z.boolean().optional(),
        largeTransactionThreshold: z.number().optional(),
        merchantChangeEnabled: z.boolean().optional(),
        unusualCategoryEnabled: z.boolean().optional(),
        spendingSpikeEnabled: z.boolean().optional(),
        pushNotificationsEnabled: z.boolean().optional(),
        emailNotificationsEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const updateData: any = { ...input, updatedAt: new Date() };
      if (input.largeTransactionThreshold !== undefined) {
        updateData.largeTransactionThreshold = input.largeTransactionThreshold.toString();
      }

      await db
        .update(alertSettings)
        .set(updateData)
        .where(eq(alertSettings.userId, ctx.user.openId));

      return { success: true };
    }),

  /**
   * Mark alert as read
   */
  markAsRead: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(spendingAlerts)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(spendingAlerts.id, input.alertId),
            eq(spendingAlerts.userId, ctx.user.openId)
          )
        );

      return { success: true };
    }),

  /**
   * Dismiss alert
   */
  dismissAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(spendingAlerts)
        .set({ isDismissed: true, dismissedAt: new Date() })
        .where(
          and(
            eq(spendingAlerts.id, input.alertId),
            eq(spendingAlerts.userId, ctx.user.openId)
          )
        );

      return { success: true };
    }),

  /**
   * Analyze transactions and create alerts
   * This should be called periodically (e.g., after new transactions are synced)
   */
  analyzeTransactions: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get user settings
    const settings = await db
      .select()
      .from(alertSettings)
      .where(eq(alertSettings.userId, ctx.user.openId))
      .limit(1);

    if (settings.length === 0) return { alertsCreated: 0 };

    const userSettings = settings[0];
    const alertsCreated: any[] = [];

    // Get recent transactions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTransactions = await db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.userId, ctx.user.openId),
          gte(bankTransactions.transactionDate, sevenDaysAgo)
        )
      )
      .orderBy(desc(bankTransactions.transactionDate));

    // 1. Check for duplicate charges
    if (userSettings.duplicateChargeEnabled) {
      const transactionMap = new Map<string, typeof recentTransactions>();
      
      for (const transaction of recentTransactions) {
        const key = `${transaction.description}_${transaction.amount}`;
        const existing = transactionMap.get(key) || [];
        existing.push(transaction);
        transactionMap.set(key, existing);
      }

      for (const [key, transactions] of transactionMap) {
        if (transactions.length >= 2) {
          // Check if transactions are within 24 hours
          const sorted = transactions.sort((a, b) => 
            new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
          );
          
          for (let i = 1; i < sorted.length; i++) {
            const timeDiff = new Date(sorted[i].transactionDate).getTime() - 
                           new Date(sorted[i-1].transactionDate).getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff <= 24) {
              const alert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: ctx.user.openId,
                alertType: 'duplicate_charge',
                transactionId: sorted[i].id,
                amount: sorted[i].amount,
                merchant: sorted[i].description,
                category: sorted[i].category,
                description: `Possible duplicate charge: ${sorted[i].description} for $${parseFloat(sorted[i].amount).toFixed(2)}`,
                severity: 'high',
                isRead: false,
                isDismissed: false,
                createdAt: new Date(),
                readAt: null,
                dismissedAt: null,
              };
              
              alertsCreated.push(alert);
            }
          }
        }
      }
    }

    // 2. Check for large transactions
    if (userSettings.largeTransactionEnabled) {
      const threshold = parseFloat(userSettings.largeTransactionThreshold);
      
      for (const transaction of recentTransactions) {
        const amount = Math.abs(parseFloat(transaction.amount));
        
        if (amount >= threshold) {
          const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: ctx.user.openId,
            alertType: 'large_transaction',
            transactionId: transaction.id,
            amount: transaction.amount,
            merchant: transaction.description,
            category: transaction.category,
            description: `Large transaction of $${amount.toFixed(2)}: ${transaction.description}`,
            severity: amount >= threshold * 2 ? 'high' : 'medium',
            isRead: false,
            isDismissed: false,
            createdAt: new Date(),
            readAt: null,
            dismissedAt: null,
          };
          
          alertsCreated.push(alert);
        }
      }
    }

    // 3. Check for merchant changes (same merchant, different category)
    if (userSettings.merchantChangeEnabled) {
      const merchantMap = new Map<string, Set<string>>();
      
      // Get historical transactions (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const historicalTransactions = await db
        .select()
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.userId, ctx.user.openId),
            gte(bankTransactions.transactionDate, ninetyDaysAgo)
          )
        );

      // Build description-category map
      for (const transaction of historicalTransactions) {
        if (!transaction.description || !transaction.category) continue;
        
        const categories = merchantMap.get(transaction.description) || new Set();
        categories.add(transaction.category);
        merchantMap.set(transaction.description, categories);
      }

      // Check recent transactions for category changes
      for (const transaction of recentTransactions) {
        if (!transaction.description || !transaction.category) continue;
        
        const knownCategories = merchantMap.get(transaction.description);
        if (knownCategories && knownCategories.size > 0 && !knownCategories.has(transaction.category)) {
          const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: ctx.user.openId,
            alertType: 'merchant_change',
            transactionId: transaction.id,
            amount: transaction.amount,
            merchant: transaction.description,
            category: transaction.category,
            description: `${transaction.description} categorized as ${transaction.category} (usually ${Array.from(knownCategories)[0]})`,
            severity: 'low',
            isRead: false,
            isDismissed: false,
            createdAt: new Date(),
            readAt: null,
            dismissedAt: null,
          };
          
          alertsCreated.push(alert);
        }
      }
    }

    // 4. Check for spending spikes
    if (userSettings.spendingSpikeEnabled) {
      // Get average daily spending for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const historicalTransactions = await db
        .select()
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.userId, ctx.user.openId),
            gte(bankTransactions.transactionDate, thirtyDaysAgo)
          )
        );

      const totalSpending = historicalTransactions.reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        return amount < 0 ? sum + Math.abs(amount) : sum;
      }, 0);
      
      const avgDailySpending = totalSpending / 30;

      // Check today's spending
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTransactions = recentTransactions.filter(t => {
        const txDate = new Date(t.transactionDate);
        return txDate >= today;
      });

      const todaySpending = todayTransactions.reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        return amount < 0 ? sum + Math.abs(amount) : sum;
      }, 0);

      // Alert if today's spending is 2x average
      if (todaySpending >= avgDailySpending * 2 && avgDailySpending > 0) {
        const alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: ctx.user.openId,
          alertType: 'spending_spike',
          transactionId: null,
          amount: todaySpending.toString(),
          merchant: null,
          category: null,
          description: `Today's spending ($${todaySpending.toFixed(2)}) is ${(todaySpending / avgDailySpending).toFixed(1)}x your daily average`,
          severity: todaySpending >= avgDailySpending * 3 ? 'high' : 'medium',
          isRead: false,
          isDismissed: false,
          createdAt: new Date(),
          readAt: null,
          dismissedAt: null,
        };
        
        alertsCreated.push(alert);
      }
    }

    // Insert all alerts
    if (alertsCreated.length > 0) {
      await db.insert(spendingAlerts).values(alertsCreated);
    }

    return { alertsCreated: alertsCreated.length, alerts: alertsCreated };
  }),
});
