import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { randomBytes, createHmac } from 'crypto';
import { createChildLogger } from '../lib/logger';
import { getStore } from '../lib/persistentStore';

const log = createChildLogger('developerPortal');

type ApiKey = {
  id: string;
  name: string;
  key: string;
  secret: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  requestCount: number;
  rateLimit: number;
  status: 'active' | 'revoked' | 'expired';
  ownerId: number;
};

type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: 'active' | 'inactive' | 'failing';
  createdAt: string;
  lastDeliveryAt: string | null;
  successRate: number;
  ownerId: number;
};

type WebhookDelivery = {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  statusCode: number;
  responseTimeMs: number;
  deliveredAt: string;
  success: boolean;
};

// Persistent stores (PostgreSQL-backed with in-memory fallback)
const apiKeyStore = getStore('developer_api_keys');
const webhookStore = getStore('developer_webhooks');
const deliveryStore = getStore('developer_webhook_deliveries');

const AVAILABLE_SCOPES = [
  'payments:read', 'payments:write',
  'transfers:read', 'transfers:write',
  'accounts:read',
  'cards:read', 'cards:write',
  'compliance:read',
  'webhooks:manage',
  'settlements:read',
];

const AVAILABLE_EVENTS = [
  'payment.created', 'payment.completed', 'payment.failed',
  'transfer.initiated', 'transfer.completed', 'transfer.failed',
  'settlement.completed', 'settlement.failed',
  'compliance.alert', 'compliance.screening.completed',
  'card.tokenized', 'card.transaction.completed',
  'webhook.test',
];

export const developerPortalRouter = router({
  // API Key Management
  createApiKey: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      environment: z.enum(['sandbox', 'production']),
      scopes: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = `key-${randomBytes(8).toString('hex')}`;
      const prefix = input.environment === 'sandbox' ? 'sk_test' : 'sk_live';
      const key: ApiKey = {
        id,
        name: input.name,
        key: `${prefix}_${randomBytes(24).toString('hex')}`,
        secret: `sec_${randomBytes(32).toString('hex')}`,
        environment: input.environment,
        scopes: input.scopes,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        requestCount: 0,
        rateLimit: input.environment === 'sandbox' ? 100 : 1000,
        status: 'active',
        ownerId: ctx.user.id,
      };
      await apiKeyStore.set(id, key as unknown as Record<string, unknown>);
      log.info({ id: key.id, env: input.environment }, 'API key created');
      return { id: key.id, key: key.key, secret: key.secret };
    }),

  listApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const all = await apiKeyStore.list<ApiKey>();
    return all
      .filter(k => k.ownerId === ctx.user.id)
      .map(k => ({
        ...k,
        secret: k.secret.substring(0, 8) + '...',
        key: k.key.substring(0, 12) + '...',
      }));
  }),

  revokeApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = await apiKeyStore.get<ApiKey>(input.id);
      if (!key || key.ownerId !== ctx.user.id) return { success: false, error: 'Key not found' };
      key.status = 'revoked';
      await apiKeyStore.set(input.id, key as unknown as Record<string, unknown>);
      log.info({ id: input.id }, 'API key revoked');
      return { success: true };
    }),

  getAvailableScopes: protectedProcedure.query(() => AVAILABLE_SCOPES),
  getAvailableEvents: protectedProcedure.query(() => AVAILABLE_EVENTS),

  // Webhook Management
  createWebhookEndpoint: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      events: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = `wh-${randomBytes(8).toString('hex')}`;
      const endpoint: WebhookEndpoint = {
        id,
        url: input.url,
        events: input.events,
        secret: `whsec_${randomBytes(32).toString('hex')}`,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastDeliveryAt: null,
        successRate: 100,
        ownerId: ctx.user.id,
      };
      await webhookStore.set(id, endpoint as unknown as Record<string, unknown>);
      log.info({ id: endpoint.id, url: input.url }, 'Webhook endpoint created');
      return { id: endpoint.id, secret: endpoint.secret };
    }),

  listWebhookEndpoints: protectedProcedure.query(async ({ ctx }) => {
    const all = await webhookStore.list<WebhookEndpoint>();
    return all.filter(e => e.ownerId === ctx.user.id);
  }),

  testWebhook: protectedProcedure
    .input(z.object({ endpointId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const endpoint = await webhookStore.get<WebhookEndpoint>(input.endpointId);
      if (!endpoint || endpoint.ownerId !== ctx.user.id) return { success: false, error: 'Endpoint not found' };

      const testPayload = {
        id: `evt-test-${randomBytes(8).toString('hex')}`,
        type: 'webhook.test',
        data: {
          message: 'This is a test webhook delivery',
          timestamp: new Date().toISOString(),
        },
        created: new Date().toISOString(),
      };

      // Sign the payload
      const signature = createHmac('sha256', endpoint.secret)
        .update(JSON.stringify(testPayload))
        .digest('hex');

      let statusCode = 200;
      let responseTimeMs = 0;
      let success = false;

      try {
        const start = Date.now();
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Id': testPayload.id,
          },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(10_000),
        });
        responseTimeMs = Date.now() - start;
        statusCode = res.status;
        success = res.ok;
      } catch {
        statusCode = 0;
        responseTimeMs = 10000;
        success = false;
      }

      const deliveryId = `del-${randomBytes(8).toString('hex')}`;
      const delivery: WebhookDelivery = {
        id: deliveryId,
        endpointId: input.endpointId,
        event: 'webhook.test',
        payload: testPayload,
        statusCode,
        responseTimeMs,
        deliveredAt: new Date().toISOString(),
        success,
      };
      await deliveryStore.set(deliveryId, delivery as unknown as Record<string, unknown>);
      endpoint.lastDeliveryAt = delivery.deliveredAt;
      await webhookStore.set(input.endpointId, endpoint as unknown as Record<string, unknown>);

      log.info({ endpointId: input.endpointId, success, statusCode }, 'Webhook test sent');
      return { success, statusCode, responseTimeMs, deliveryId: delivery.id };
    }),

  getWebhookDeliveries: protectedProcedure
    .input(z.object({ endpointId: z.string() }))
    .query(async ({ ctx, input }) => {
      const endpoint = await webhookStore.get<WebhookEndpoint>(input.endpointId);
      if (!endpoint || endpoint.ownerId !== ctx.user.id) return [];
      const all = await deliveryStore.list<WebhookDelivery>();
      return all.filter(d => d.endpointId === input.endpointId);
    }),

  // API usage stats
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    const allKeys = await apiKeyStore.list<ApiKey>();
    const userKeys = allKeys.filter(k => k.ownerId === ctx.user.id);
    const allEndpoints = await webhookStore.list<WebhookEndpoint>();
    const deliveryCount = await deliveryStore.count();
    return {
      totalKeys: userKeys.length,
      activeKeys: userKeys.filter(k => k.status === 'active').length,
      totalRequests: userKeys.reduce((a, k) => a + k.requestCount, 0),
      webhookEndpoints: allEndpoints.filter(e => e.ownerId === ctx.user.id).length,
      totalDeliveries: deliveryCount,
    };
  }),
});
