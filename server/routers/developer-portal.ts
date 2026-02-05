import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { randomBytes } from 'crypto';
import { getDb } from '../db';
import { apiKeys, apiUsageLogs, webhooks, webhookDeliveries } from '../../drizzle/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { deliverWebhookEvent } from '../services/webhook-delivery';

// Static API documentation (this doesn't need database storage)
const apiDocumentation = new Map();

// Initialize API documentation
const initializeAPIDocs = () => {
  if (apiDocumentation.size === 0) {
    apiDocumentation.set('payments', {
      id: 'payments',
      name: 'Payments API',
      description: 'Process payments, transfers, and transactions',
      version: 'v1',
      baseUrl: '/api/v1/payments',
      endpoints: [
        {
          method: 'POST',
          path: '/transfer',
          description: 'Initiate a money transfer',
          rateLimit: '100/min',
          pricing: '₦0.50 per request',
        },
        {
          method: 'GET',
          path: '/transactions',
          description: 'Get transaction history',
          rateLimit: '1000/min',
          pricing: '₦0.10 per request',
        },
      ],
    });

    apiDocumentation.set('accounts', {
      id: 'accounts',
      name: 'Accounts API',
      description: 'Manage user accounts and balances',
      version: 'v1',
      baseUrl: '/api/v1/accounts',
      endpoints: [
        {
          method: 'GET',
          path: '/balance',
          description: 'Get account balance',
          rateLimit: '500/min',
          pricing: '₦0.05 per request',
        },
        {
          method: 'POST',
          path: '/create',
          description: 'Create new account',
          rateLimit: '10/min',
          pricing: '₦1.00 per request',
        },
      ],
    });

    apiDocumentation.set('kyc', {
      id: 'kyc',
      name: 'KYC API',
      description: 'Identity verification and KYC services',
      version: 'v1',
      baseUrl: '/api/v1/kyc',
      endpoints: [
        {
          method: 'POST',
          path: '/verify',
          description: 'Verify user identity',
          rateLimit: '50/min',
          pricing: '₦5.00 per request',
        },
        {
          method: 'GET',
          path: '/status',
          description: 'Get verification status',
          rateLimit: '200/min',
          pricing: '₦0.20 per request',
        },
      ],
    });

    apiDocumentation.set('bnpl', {
      id: 'bnpl',
      name: 'BNPL API',
      description: 'Buy Now Pay Later services',
      version: 'v1',
      baseUrl: '/api/v1/bnpl',
      endpoints: [
        {
          method: 'POST',
          path: '/applications',
          description: 'Create BNPL application',
          rateLimit: '20/min',
          pricing: '₦2.00 per request',
        },
        {
          method: 'GET',
          path: '/applications/:id',
          description: 'Get application details',
          rateLimit: '100/min',
          pricing: '₦0.30 per request',
        },
      ],
    });

    apiDocumentation.set('credit-score', {
      id: 'credit-score',
      name: 'Credit Score API',
      description: 'Credit scoring and assessment',
      version: 'v1',
      baseUrl: '/api/v1/credit-score',
      endpoints: [
        {
          method: 'GET',
          path: '/score',
          description: 'Get credit score',
          rateLimit: '100/min',
          pricing: '₦1.00 per request',
        },
        {
          method: 'GET',
          path: '/history',
          description: 'Get score history',
          rateLimit: '50/min',
          pricing: '₦0.50 per request',
        },
      ],
    });

    apiDocumentation.set('open-banking', {
      id: 'open-banking',
      name: 'Open Banking API',
      description: 'Bank account aggregation and data',
      version: 'v1',
      baseUrl: '/api/v1/open-banking',
      endpoints: [
        {
          method: 'POST',
          path: '/link',
          description: 'Link bank account',
          rateLimit: '10/min',
          pricing: '₦3.00 per request',
        },
        {
          method: 'GET',
          path: '/accounts',
          description: 'Get linked accounts',
          rateLimit: '200/min',
          pricing: '₦0.40 per request',
        },
      ],
    });
  }
};

function generateAPIKey(): string {
  const prefix = 'afp'; // African Fintech Platform
  const key = randomBytes(32).toString('hex');
  return `${prefix}_${key}`;
}

function generateAPISecret(): string {
  return randomBytes(48).toString('hex');
}

export const developerPortalRouter = router({
  // Get all API keys for the user
  getAPIKeys: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      
      const userKeys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt));
      
      // Return keys without secrets (for security)
      return userKeys.map((key) => ({
        id: key.id,
        name: key.name,
        key: key.keyValue,
        environment: key.environment,
        status: key.status,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        requestCount: parseInt(key.requestCount || '0'),
      }));
    }),

  // Create new API key
  createAPIKey: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      environment: z.enum(['development', 'production']),
      permissions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      const now = new Date();

      const keyValue = generateAPIKey();
      const secretValue = generateAPISecret();
      const keyId = crypto.randomUUID();

      await db.insert(apiKeys).values({
        id: keyId,
        userId,
        name: input.name,
        keyValue,
        secretValue,
        environment: input.environment,
        status: 'active',
        permissions: (input.permissions || ['all']).join(','),
        requestCount: '0',
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const [newKey] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId))
        .limit(1);

      return {
        success: true,
        apiKey: {
          ...newKey,
          secret: secretValue, // Only shown once
        },
        message: 'API key created successfully. Store the secret securely - it will not be shown again.',
      };
    }),

  // Revoke API key
  revokeAPIKey: protectedProcedure
    .input(z.object({
      keyId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Verify key belongs to user
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, input.keyId),
            eq(apiKeys.userId, userId)
          )
        )
        .limit(1);

      if (!key) {
        throw new Error('API key not found');
      }

      await db
        .update(apiKeys)
        .set({
          status: 'revoked',
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, input.keyId));

      return {
        success: true,
        message: 'API key revoked successfully',
      };
    }),

  // Get API usage statistics
  getUsageStats: protectedProcedure
    .input(z.object({
      keyId: z.string().optional(),
      period: z.enum(['day', 'week', 'month']).default('week'),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Calculate period cutoff
      const cutoffDate = new Date();
      switch (input.period) {
        case 'day':
          cutoffDate.setDate(cutoffDate.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
      }

      if (input.keyId) {
        // Get stats for specific key
        const logs = await db
          .select()
          .from(apiUsageLogs)
          .where(
            and(
              eq(apiUsageLogs.apiKeyId, input.keyId),
              gte(apiUsageLogs.timestamp, cutoffDate)
            )
          );

        const totalRequests = logs.length;
        const successfulRequests = logs.filter(log => log.statusCode >= 200 && log.statusCode < 300).length;
        const failedRequests = totalRequests - successfulRequests;
        const totalCost = logs.reduce((sum, log) => sum + parseFloat(log.cost || '0'), 0);

        return {
          keyId: input.keyId,
          totalRequests,
          successfulRequests,
          failedRequests,
          totalCost,
        };
      } else {
        // Get aggregated stats for all user keys
        const userKeys = await db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.userId, userId));

        const keyIds = userKeys.map(k => k.id);
        
        let totalRequests = 0;
        let successfulRequests = 0;
        let failedRequests = 0;
        let totalCost = 0;

        for (const keyId of keyIds) {
          const logs = await db
            .select()
            .from(apiUsageLogs)
            .where(
              and(
                eq(apiUsageLogs.apiKeyId, keyId),
                gte(apiUsageLogs.timestamp, cutoffDate)
              )
            );

          totalRequests += logs.length;
          successfulRequests += logs.filter(log => log.statusCode >= 200 && log.statusCode < 300).length;
          totalCost += logs.reduce((sum, log) => sum + parseFloat(log.cost || '0'), 0);
        }

        failedRequests = totalRequests - successfulRequests;

        return {
          totalRequests,
          successfulRequests,
          failedRequests,
          totalCost,
          byAPI: {},
        };
      }
    }),

  // Get API documentation
  getAPIDocs: protectedProcedure
    .input(z.object({
      apiId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      initializeAPIDocs();

      if (input.apiId) {
        const doc = apiDocumentation.get(input.apiId);
        if (!doc) {
          throw new Error('API documentation not found');
        }
        return doc;
      }

      // Return all API docs
      return Array.from(apiDocumentation.values());
    }),

  // Test API endpoint
  testEndpoint: protectedProcedure
    .input(z.object({
      apiId: z.string(),
      endpoint: z.string(),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      body: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      
      const userKeys = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.status, 'active')
          )
        )
        .limit(1);

      if (userKeys.length === 0) {
        throw new Error('No API keys found. Create an API key first.');
      }

      // Simulate API call
      const testResult = {
        success: true,
        statusCode: 200,
        responseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms
        response: {
          message: 'Test successful',
          data: {
            ...input.body,
            timestamp: new Date().toISOString(),
          },
        },
      };

      // Log the test request
      await db.insert(apiUsageLogs).values({
        apiKeyId: userKeys[0].id,
        endpoint: `${input.apiId}${input.endpoint}`,
        method: input.method,
        statusCode: testResult.statusCode,
        responseTime: testResult.responseTime.toString(),
        cost: '0.10',
        timestamp: new Date(),
        createdAt: new Date(),
      });

      return testResult;
    }),

  // Get billing information
  getBilling: protectedProcedure
    .input(z.object({
      month: z.string().optional(), // Format: YYYY-MM
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      
      const userKeys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));

      const keyIds = userKeys.map(k => k.id);
      
      // Calculate month range
      const targetMonth = input.month || new Date().toISOString().slice(0, 7);
      const startDate = new Date(`${targetMonth}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      let totalCost = 0;
      const breakdown: Record<string, number> = {};

      for (const key of userKeys) {
        const logs = await db
          .select()
          .from(apiUsageLogs)
          .where(
            and(
              eq(apiUsageLogs.apiKeyId, key.id),
              gte(apiUsageLogs.timestamp, startDate)
            )
          );

        const keyCost = logs
          .filter(log => log.timestamp < endDate)
          .reduce((sum, log) => sum + parseFloat(log.cost || '0'), 0);
        
        totalCost += keyCost;
        breakdown[key.name] = keyCost;
      }

      return {
        month: targetMonth,
        totalCost,
        breakdown,
        currency: 'NGN',
        status: totalCost > 0 ? 'pending' : 'paid',
      };
    }),

  // Get developer analytics
  getAnalytics: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month']).default('week'),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';
      
      const userKeys = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));

      // Generate daily stats from usage logs
      const days = input.period === 'day' ? 1 : input.period === 'week' ? 7 : 30;
      const dailyStats = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        let dayRequests = 0;
        let dayErrors = 0;
        let totalResponseTime = 0;
        let dayCost = 0;

        for (const key of userKeys) {
          const logs = await db
            .select()
            .from(apiUsageLogs)
            .where(
              and(
                eq(apiUsageLogs.apiKeyId, key.id),
                gte(apiUsageLogs.timestamp, date)
              )
            );

          const dayLogs = logs.filter(log => log.timestamp < nextDate);
          dayRequests += dayLogs.length;
          dayErrors += dayLogs.filter(log => log.statusCode >= 400).length;
          totalResponseTime += dayLogs.reduce((sum, log) => sum + parseFloat(log.responseTime || '0'), 0);
          dayCost += dayLogs.reduce((sum, log) => sum + parseFloat(log.cost || '0'), 0);
        }

        dailyStats.push({
          date: dateStr,
          requests: dayRequests,
          errors: dayErrors,
          avgResponseTime: dayRequests > 0 ? Math.round(totalResponseTime / dayRequests) : 0,
          cost: dayCost.toFixed(2),
        });
      }

      return {
        period: input.period,
        dailyStats,
        totalKeys: userKeys.length,
        activeKeys: userKeys.filter((k) => k.status === 'active').length,
      };
    }),

  // ========== WEBHOOK MANAGEMENT ==========

  /**
   * Create a new webhook
   */
  createWebhook: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.string()),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      // Generate webhook secret for signature verification
      const secret = `whsec_${randomBytes(32).toString('hex')}`;

      const [webhook] = await db
        .insert(webhooks)
        .values({
          userId,
          url: input.url,
          events: input.events,
          secret,
          status: 'active',
          failureCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        success: true,
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret,
          status: webhook.status,
          createdAt: webhook.createdAt.toISOString(),
        },
      };
    }),

  /**
   * Get all webhooks for the current user
   */
  getWebhooks: protectedProcedure.query(async ({ ctx }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const userWebhooks = await db
        .select()
      .from(webhooks)
      .where(eq(webhooks.userId, userId))
      .orderBy(desc(webhooks.createdAt));

      return {
        success: true,
        webhooks: userWebhooks.map((wh: any) => ({
          id: wh.id,
        url: wh.url,
        events: wh.events,
        status: wh.status,
        failureCount: wh.failureCount,
        lastTriggeredAt: wh.lastTriggeredAt?.toISOString(),
        createdAt: wh.createdAt.toISOString(),
      })),
    };
  }),

  /**
   * Update webhook
   */
  updateWebhook: protectedProcedure
    .input(
      z.object({
        webhookId: z.string(),
        url: z.string().url().optional(),
        events: z.array(z.string()).optional(),
        status: z.enum(['active', 'inactive']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.url) updateData.url = input.url;
      if (input.events) updateData.events = input.events;
      if (input.status) updateData.status = input.status;

      const [webhook] = await db
        .update(webhooks)
        .set(updateData)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, userId)))
        .returning();

      if (!webhook) {
        throw new Error('Webhook not found or access denied');
      }

      return {
        success: true,
        message: 'Webhook updated successfully',
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          status: webhook.status,
        },
      };
    }),

  /**
   * Delete webhook
   */
  deleteWebhook: protectedProcedure
    .input(
      z.object({
        webhookId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      // Delete webhook deliveries first
      await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, input.webhookId));

      // Delete webhook
      const result = await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, userId)))
        .returning();

      if (result.length === 0) {
        throw new Error('Webhook not found or access denied');
      }

      return {
        success: true,
        message: 'Webhook deleted successfully',
      };
    }),

  /**
   * Get webhook deliveries (logs)
   */
  getWebhookDeliveries: protectedProcedure
    .input(
      z.object({
        webhookId: z.string(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      // Verify webhook belongs to user
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, userId)));

      if (!webhook) {
        throw new Error('Webhook not found or access denied');
      }

      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(input.limit);

      return {
        success: true,
        deliveries: deliveries.map((d: any) => ({
          id: d.id,
          event: d.event,
          status: d.status,
          statusCode: d.statusCode,
          attemptCount: d.attemptCount,
          deliveredAt: d.deliveredAt?.toISOString(),
          createdAt: d.createdAt.toISOString(),
        })),
      };
    }),

  /**
   * Test webhook (send a test event)
   */
  testWebhook: protectedProcedure
    .input(
      z.object({
        webhookId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      // Verify webhook belongs to user
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, userId)));

      if (!webhook) {
        throw new Error('Webhook not found or access denied');
      }

      // Send real test webhook using delivery service
      await deliverWebhookEvent(
        'webhook.test',
        {
          message: 'This is a test webhook event',
          webhookId: webhook.id,
          testMode: true,
        },
        userId
      );

      // Get the latest delivery for this webhook
      const [latestDelivery] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, webhook.id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(1);

      return {
        success: true,
        message: 'Test webhook sent successfully',
        deliveryId: latestDelivery?.id,
        status: latestDelivery?.status,
        statusCode: latestDelivery?.statusCode,
      };
    }),

  // Subscribe to API updates
  subscribeToUpdates: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      apis: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      // In a real implementation, this would save to database and send emails
      return {
        success: true,
        message: `Subscribed to updates for ${input.apis.length} APIs`,
      };
    }),
});
