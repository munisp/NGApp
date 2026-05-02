/**
 * Remittance Webhook Service
 * 
 * Handles webhook delivery for remittance events with:
 * - Signature verification (HMAC-SHA256)
 * - Automatic retries with exponential backoff
 * - Delivery tracking and logging
 * - Event filtering and subscriptions
 */

import crypto from 'crypto';

export interface WebhookEvent {
  id: string;
  remittanceId: string;
  event: string;
  data: Record<string, any>;
  timestamp: Date;
  signature?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookEventId: string;
  url: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseCode?: number;
  responseBody?: string;
  error?: string;
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: string[]; // e.g., ['remittance.*', 'payment.confirmed']
  active: boolean;
  createdAt: Date;
}

/**
 * Supported webhook events
 */
export const WEBHOOK_EVENTS = {
  // Payment events
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_FAILED: 'payment.failed',
  
  // Conversion events
  CONVERSION_STARTED: 'conversion.started',
  CONVERSION_COMPLETED: 'conversion.completed',
  CONVERSION_FAILED: 'conversion.failed',
  
  // KYC events
  KYC_INITIATED: 'kyc.initiated',
  KYC_APPROVED: 'kyc.approved',
  KYC_REJECTED: 'kyc.rejected',
  
  // Account events
  ACCOUNT_VERIFYING: 'account.verifying',
  ACCOUNT_VERIFIED: 'account.verified',
  ACCOUNT_OPENING: 'account.opening',
  ACCOUNT_OPENED: 'account.opened',
  
  // Transfer events
  TRANSFER_INITIATED: 'transfer.initiated',
  TRANSFER_PROCESSING: 'transfer.processing',
  TRANSFER_COMPLETED: 'transfer.completed',
  TRANSFER_FAILED: 'transfer.failed',
  
  // Remittance events
  REMITTANCE_CREATED: 'remittance.created',
  REMITTANCE_COMPLETED: 'remittance.completed',
  REMITTANCE_FAILED: 'remittance.failed',
  REMITTANCE_CANCELLED: 'remittance.cancelled',
} as const;

/**
 * Create webhook event
 */
export async function createWebhookEvent(params: {
  remittanceId: string;
  event: string;
  data: Record<string, any>;
}): Promise<WebhookEvent> {
  const event: WebhookEvent = {
    id: `evt_${crypto.randomBytes(16).toString('hex')}`,
    remittanceId: params.remittanceId,
    event: params.event,
    data: params.data,
    timestamp: new Date(),
  };

  // Store in database
  // await db.createWebhookEvent(event);

  // Trigger delivery to all subscribed webhooks
  await deliverWebhookEvent(event);

  return event;
}

/**
 * Deliver webhook event to all subscribers
 */
async function deliverWebhookEvent(event: WebhookEvent): Promise<void> {
  // Get all active subscriptions that match this event
  const subscriptions = await getMatchingSubscriptions(event.event);

  // Create delivery records for each subscription
  const deliveries = subscriptions.map(sub => ({
    id: `del_${crypto.randomBytes(16).toString('hex')}`,
    webhookEventId: event.id,
    url: sub.url,
    status: 'pending' as const,
    attempts: 0,
  }));

  // Store deliveries in database
  // await db.createWebhookDeliveries(deliveries);

  // Attempt immediate delivery
  for (const delivery of deliveries) {
    const subscription = subscriptions.find(s => s.url === delivery.url);
    if (subscription) {
      await attemptWebhookDelivery(event, delivery, subscription);
    }
  }
}

/**
 * Attempt webhook delivery with retry logic
 */
export async function attemptWebhookDelivery(
  event: WebhookEvent,
  delivery: WebhookDelivery,
  subscription: WebhookSubscription
): Promise<WebhookDelivery> {
  delivery.attempts++;
  delivery.lastAttemptAt = new Date();

  try {
    // Generate signature
    const signature = generateWebhookSignature(event, subscription.secret);

    // Prepare payload
    const payload = {
      id: event.id,
      event: event.event,
      remittanceId: event.remittanceId,
      data: event.data,
      timestamp: event.timestamp.toISOString(),
    };

    // Send webhook
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event.event,
        'X-Webhook-ID': event.id,
        'User-Agent': 'PaymentSwitch-Webhooks/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    delivery.responseCode = response.status;

    if (response.ok) {
      delivery.status = 'delivered';
      delivery.responseBody = await response.text();
    } else {
      delivery.status = 'failed';
      delivery.error = `HTTP ${response.status}: ${response.statusText}`;
      delivery.responseBody = await response.text();

      // Schedule retry if not at max attempts
      if (delivery.attempts < 5) {
        delivery.nextRetryAt = calculateNextRetry(delivery.attempts);
      }
    }
  } catch (error) {
    delivery.status = 'failed';
    delivery.error = error instanceof Error ? error.message : 'Unknown error';

    // Schedule retry if not at max attempts
    if (delivery.attempts < 5) {
      delivery.nextRetryAt = calculateNextRetry(delivery.attempts);
    }
  }

  // Update delivery in database
  // await db.updateWebhookDelivery(delivery);

  return delivery;
}

/**
 * Generate HMAC-SHA256 signature for webhook
 */
function generateWebhookSignature(event: WebhookEvent, secret: string): string {
  const payload = JSON.stringify({
    id: event.id,
    event: event.event,
    remittanceId: event.remittanceId,
    data: event.data,
    timestamp: event.timestamp.toISOString(),
  });

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(attempts: number): Date {
  // Retry schedule: 1m, 5m, 15m, 1h, 6h
  const delays = [60, 300, 900, 3600, 21600]; // in seconds
  const delay = delays[Math.min(attempts - 1, delays.length - 1)];
  
  return new Date(Date.now() + delay * 1000);
}

/**
 * Get subscriptions matching an event
 */
async function getMatchingSubscriptions(event: string): Promise<WebhookSubscription[]> {
  // In production, fetch from database
  // const subscriptions = await db.getWebhookSubscriptions({ active: true });
  
  // Filter subscriptions by event pattern
  // return subscriptions.filter(sub => matchesEventPattern(event, sub.events));
  
  return [];
}

/**
 * Check if event matches subscription patterns
 */
function matchesEventPattern(event: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Convert pattern to regex (e.g., 'remittance.*' -> /^remittance\..+$/)
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.+');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(event);
  });
}

/**
 * Create webhook subscription
 */
export async function createWebhookSubscription(params: {
  userId: string;
  url: string;
  events: string[];
}): Promise<WebhookSubscription> {
  // Generate webhook secret
  const secret = crypto.randomBytes(32).toString('hex');

  const subscription: WebhookSubscription = {
    id: `sub_${crypto.randomBytes(16).toString('hex')}`,
    userId: params.userId,
    url: params.url,
    secret,
    events: params.events,
    active: true,
    createdAt: new Date(),
  };

  // Store in database
  // await db.createWebhookSubscription(subscription);

  return subscription;
}

/**
 * Update webhook subscription
 */
export async function updateWebhookSubscription(params: {
  subscriptionId: string;
  url?: string;
  events?: string[];
  active?: boolean;
}): Promise<WebhookSubscription | null> {
  // In production, update in database
  // return await db.updateWebhookSubscription(params);
  return null;
}

/**
 * Delete webhook subscription
 */
export async function deleteWebhookSubscription(
  subscriptionId: string
): Promise<boolean> {
  // In production, delete from database
  // return await db.deleteWebhookSubscription(subscriptionId);
  return true;
}

/**
 * Get webhook deliveries for an event
 */
export async function getWebhookDeliveries(
  eventId: string
): Promise<WebhookDelivery[]> {
  // In production, fetch from database
  // return await db.getWebhookDeliveries({ webhookEventId: eventId });
  return [];
}

/**
 * Retry failed webhook delivery
 */
export async function retryWebhookDelivery(
  deliveryId: string
): Promise<WebhookDelivery | null> {
  // In production, fetch delivery and event from database
  // const delivery = await db.getWebhookDelivery(deliveryId);
  // const event = await db.getWebhookEvent(delivery.webhookEventId);
  // const subscription = await db.getWebhookSubscriptionByUrl(delivery.url);
  
  // return await attemptWebhookDelivery(event, delivery, subscription);
  return null;
}

/**
 * Process pending webhook deliveries (for background job)
 */
export async function processPendingWebhooks(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  // In production, fetch pending deliveries from database
  // const pendingDeliveries = await db.getWebhookDeliveries({
  //   status: 'pending',
  //   nextRetryAt: { $lte: new Date() },
  // });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // for (const delivery of pendingDeliveries) {
  //   const event = await db.getWebhookEvent(delivery.webhookEventId);
  //   const subscription = await db.getWebhookSubscriptionByUrl(delivery.url);
  //   
  //   const result = await attemptWebhookDelivery(event, delivery, subscription);
  //   processed++;
  //   
  //   if (result.status === 'delivered') {
  //     succeeded++;
  //   } else {
  //     failed++;
  //   }
  // }

  return { processed, succeeded, failed };
}

/**
 * Get webhook event by ID
 */
export async function getWebhookEvent(eventId: string): Promise<WebhookEvent | null> {
  // In production, fetch from database
  // return await db.getWebhookEvent(eventId);
  return null;
}

/**
 * List webhook events for a remittance
 */
export async function listWebhookEvents(params: {
  remittanceId: string;
  limit?: number;
  offset?: number;
}): Promise<{
  events: WebhookEvent[];
  total: number;
}> {
  // In production, fetch from database
  // const events = await db.getWebhookEvents({
  //   remittanceId: params.remittanceId,
  //   limit: params.limit || 20,
  //   offset: params.offset || 0,
  // });

  return {
    events: [],
    total: 0,
  };
}

/**
 * Test webhook endpoint
 */
export async function testWebhookEndpoint(params: {
  url: string;
  secret: string;
}): Promise<{
  success: boolean;
  responseCode?: number;
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Create test event
    const testEvent: WebhookEvent = {
      id: 'evt_test',
      remittanceId: 'rem_test',
      event: 'webhook.test',
      data: { message: 'This is a test webhook' },
      timestamp: new Date(),
    };

    // Generate signature
    const signature = generateWebhookSignature(testEvent, params.secret);

    // Send test webhook
    const response = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': testEvent.event,
        'X-Webhook-ID': testEvent.id,
      },
      body: JSON.stringify({
        id: testEvent.id,
        event: testEvent.event,
        remittanceId: testEvent.remittanceId,
        data: testEvent.data,
        timestamp: testEvent.timestamp.toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Date.now() - startTime;

    return {
      success: response.ok,
      responseCode: response.status,
      responseTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}
