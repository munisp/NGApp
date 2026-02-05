import { getDb } from '../db.js';
import { webhooks, webhookDeliveries } from '../../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface WebhookEvent {
  event: string;
  data: any;
  userId?: string;
  timestamp: string;
}

/**
 * Deliver a webhook event to all registered webhooks
 * @param event The event name (e.g., 'transaction.created', 'payment.success')
 * @param data The event data payload
 * @param userId Optional user ID to filter webhooks
 */
export async function deliverWebhookEvent(
  event: string,
  data: any,
  userId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('[Webhook] Database not available');
    return;
  }

  try {
    // Find all active webhooks that are subscribed to this event
    let activeWebhooks;
    if (userId) {
      activeWebhooks = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.status, 'active'), eq(webhooks.userId, userId)));
    } else {
      activeWebhooks = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.status, 'active'));
    }

    // Filter webhooks that are subscribed to this event
    const subscribedWebhooks = activeWebhooks.filter((webhook) => {
      const events = webhook.events as string[];
      return events.includes(event) || events.includes('*');
    });

    if (subscribedWebhooks.length === 0) {
      console.log(`[Webhook] No webhooks subscribed to event: ${event}`);
      return;
    }

    console.log(
      `[Webhook] Delivering event "${event}" to ${subscribedWebhooks.length} webhook(s)`
    );

    // Deliver to each webhook
    const deliveryPromises = subscribedWebhooks.map((webhook) =>
      deliverToWebhook(webhook, event, data)
    );

    await Promise.allSettled(deliveryPromises);
  } catch (error) {
    console.error('[Webhook] Error delivering webhook event:', error);
  }
}

/**
 * Deliver an event to a specific webhook
 */
async function deliverToWebhook(
  webhook: any,
  event: string,
  data: any
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const payload: WebhookEvent = {
    event,
    data,
    userId: webhook.userId,
    timestamp: new Date().toISOString(),
  };

  // Generate signature for webhook verification
  const signature = generateSignature(payload, webhook.secret);

  let deliveryId: string | undefined;

  try {
    // Create delivery record
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook.id,
        event,
        payload: payload,
        status: 'pending',
        attemptCount: 0,
        createdAt: new Date(),
      })
      .returning();

    deliveryId = delivery.id;

    // Send HTTP request to webhook URL
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-Delivery-Id': deliveryId.toString(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    // Update delivery record with response
    if (response.ok) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'delivered' as const,
          statusCode: response.status,
          responseBody: await response.text(),
          attemptCount: 1,
          deliveredAt: new Date(),
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      console.log(
        `[Webhook] Successfully delivered event "${event}" to ${webhook.url}`
      );
    } else {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'failed' as const,
          statusCode: response.status,
          responseBody: await response.text(),
          attemptCount: 1,
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      console.error(
        `[Webhook] Failed to deliver event "${event}" to ${webhook.url}: ${response.status}`
      );
    }
  } catch (error: any) {
    console.error(
      `[Webhook] Error delivering to ${webhook.url}:`,
      error.message
    );

    if (deliveryId) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'failed' as const,
          responseBody: error.message,
          attemptCount: 1,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    }
  }
}

/**
 * Generate HMAC signature for webhook verification
 */
function generateSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Event type constants
export const WebhookEvents = {
  // Transaction events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',

  // Payment events
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_PENDING: 'payment.pending',

  // Account events
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_UPDATED: 'account.updated',
  ACCOUNT_DELETED: 'account.deleted',

  // KYC events
  KYC_SUBMITTED: 'kyc.submitted',
  KYC_APPROVED: 'kyc.approved',
  KYC_REJECTED: 'kyc.rejected',

  // Goal events
  GOAL_CREATED: 'goal.created',
  GOAL_COMPLETED: 'goal.completed',
  GOAL_MILESTONE: 'goal.milestone',

  // Bill events
  BILL_CREATED: 'bill.created',
  BILL_PAID: 'bill.paid',
  BILL_DUE: 'bill.due',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
} as const;

export type WebhookEventType = (typeof WebhookEvents)[keyof typeof WebhookEvents];
