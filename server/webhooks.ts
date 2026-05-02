import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { webhooks, webhookEvents } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

/**
 * Webhook router for managing merchant webhooks
 */
export const webhookRouter = router({
  /**
   * List all webhooks for a merchant
   */
  list: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.merchantId, input.merchantId))
        .orderBy(desc(webhooks.createdAt));

      return result;
    }),

  /**
   * Create a new webhook
   */
  create: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      url: z.string().url(),
      events: z.array(z.enum([
        "payment.created",
        "payment.completed",
        "payment.failed",
        "payment.refunded",
        "payment.disputed"
      ])),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Generate webhook secret
      const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

      await db.insert(webhooks).values({
        merchantId: input.merchantId,
        url: input.url,
        events: input.events.join(','),
        secret,
        description: input.description,
        enabled: true,
      });

      return { 
        merchantId: input.merchantId,
        url: input.url,
        events: input.events,
        secret,
        description: input.description,
      };
    }),

  /**
   * Update webhook
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      merchantId: z.number(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      enabled: z.boolean().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: any = {};
      if (input.url) updateData.url = input.url;
      if (input.events) updateData.events = input.events.join(',');
      if (input.enabled !== undefined) updateData.enabled = input.enabled;
      if (input.description !== undefined) updateData.description = input.description;

      await db
        .update(webhooks)
        .set(updateData)
        .where(
          and(
            eq(webhooks.id, input.id),
            eq(webhooks.merchantId, input.merchantId)
          )
        );

      return { success: true };
    }),

  /**
   * Delete webhook
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.number(),
      merchantId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(webhooks)
        .where(
          and(
            eq(webhooks.id, input.id),
            eq(webhooks.merchantId, input.merchantId)
          )
        );

      return { success: true };
    }),

  /**
   * Rotate webhook secret
   */
  rotateSecret: protectedProcedure
    .input(z.object({
      id: z.number(),
      merchantId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const newSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

      await db
        .update(webhooks)
        .set({ secret: newSecret })
        .where(
          and(
            eq(webhooks.id, input.id),
            eq(webhooks.merchantId, input.merchantId)
          )
        );

      return { secret: newSecret };
    }),

  /**
   * Get webhook events (delivery history)
   */
  events: protectedProcedure
    .input(z.object({
      webhookId: z.number(),
      merchantId: z.number(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify webhook belongs to merchant
      const webhook = await db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.id, input.webhookId),
            eq(webhooks.merchantId, input.merchantId)
          )
        )
        .limit(1);

      if (webhook.length === 0) {
        throw new Error("Webhook not found");
      }

      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.webhookId, input.webhookId))
        .orderBy(desc(webhookEvents.createdAt))
        .limit(input.limit);

      return events;
    }),

  /**
   * Retry failed webhook event
   */
  retryEvent: protectedProcedure
    .input(z.object({
      eventId: z.number(),
      merchantId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get event and verify ownership
      const event = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.id, input.eventId))
        .limit(1);

      if (event.length === 0) {
        throw new Error("Event not found");
      }

      const webhook = await db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.id, event[0].webhookId),
            eq(webhooks.merchantId, input.merchantId)
          )
        )
        .limit(1);

      if (webhook.length === 0) {
        throw new Error("Unauthorized");
      }

      // Trigger webhook delivery (implementation would go in a background job)
      // For now, just mark as pending retry
      await db
        .update(webhookEvents)
        .set({ status: 'pending' })
        .where(eq(webhookEvents.id, input.eventId));

      return { success: true };
    }),
});

/**
 * Send webhook notification
 * This would typically be called from a background job
 */
export async function sendWebhook(
  webhookId: number,
  eventType: string,
  payload: any
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const webhook = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (webhook.length === 0 || !webhook[0].enabled) {
    return;
  }

  const webhookConfig = webhook[0];
  const events = webhookConfig.events.split(',');

  if (!events.includes(eventType)) {
    return;
  }

    // Create webhook event record
    const result = await db.insert(webhookEvents).values({
      webhookId,
      eventType,
      payload: JSON.stringify(payload),
      status: 'pending',
    });
    
    const eventId = (result as any).insertId || 0;

  try {
    // Generate signature
    const signature = crypto
      .createHmac('sha256', webhookConfig.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send webhook
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
      },
      body: JSON.stringify(payload),
    });

    // Update event status
    await db
      .update(webhookEvents)
      .set({
        status: response.ok ? 'delivered' : 'failed',
        responseCode: response.status,
        responseBody: await response.text(),
        deliveredAt: response.ok ? new Date() : null,
      })
      .where(eq(webhookEvents.id, eventId));
  } catch (error: any) {
    // Update event as failed
    await db
      .update(webhookEvents)
      .set({
        status: 'failed',
        responseBody: error.message,
      })
      .where(eq(webhookEvents.id, eventId));
  }
}
