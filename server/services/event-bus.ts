type EventHandler = (payload: Record<string, unknown>) => void | Promise<void>;

interface EventSubscription {
  handler: EventHandler;
  once: boolean;
}

const EVENT_TYPES = [
  'transaction.created',
  'transaction.completed',
  'transaction.failed',
  'payment.initiated',
  'payment.completed',
  'payment.failed',
  'account.created',
  'account.updated',
  'account.suspended',
  'budget.threshold_reached',
  'budget.exceeded',
  'savings.goal_reached',
  'savings.contribution',
  'auth.login',
  'auth.logout',
  'auth.failed_attempt',
  'auth.mfa_required',
  'kyc.submitted',
  'kyc.approved',
  'kyc.rejected',
  'notification.sent',
  'notification.failed',
  'audit.action',
  'bnpl.application_created',
  'bnpl.payment_due',
  'bnpl.payment_overdue',
  'credit_score.updated',
  'bill.reminder',
  'bill.overdue',
] as const;

type EventType = (typeof EVENT_TYPES)[number] | string;

interface EventEnvelope {
  id: string;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: number;
  source: string;
  correlationId?: string;
}

class EventBus {
  private subscribers = new Map<string, EventSubscription[]>();
  private deadLetterQueue: EventEnvelope[] = [];
  private eventLog: EventEnvelope[] = [];
  private maxLogSize = 10000;

  subscribe(eventType: EventType, handler: EventHandler, once = false): () => void {
    const subs = this.subscribers.get(eventType) || [];
    const subscription: EventSubscription = { handler, once };
    subs.push(subscription);
    this.subscribers.set(eventType, subs);

    return () => {
      const current = this.subscribers.get(eventType) || [];
      const idx = current.indexOf(subscription);
      if (idx >= 0) current.splice(idx, 1);
    };
  }

  once(eventType: EventType, handler: EventHandler): () => void {
    return this.subscribe(eventType, handler, true);
  }

  async publish(
    eventType: EventType,
    payload: Record<string, unknown>,
    source = 'api-server',
    correlationId?: string
  ): Promise<void> {
    const envelope: EventEnvelope = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      payload,
      timestamp: Date.now(),
      source,
      correlationId,
    };

    this.eventLog.push(envelope);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize / 2);
    }

    const subs = this.subscribers.get(eventType) || [];
    const wildcardSubs = this.subscribers.get('*') || [];
    const allSubs = [...subs, ...wildcardSubs];

    const toRemove: EventSubscription[] = [];

    for (const sub of allSubs) {
      try {
        await sub.handler(envelope as unknown as Record<string, unknown>);
        if (sub.once) toRemove.push(sub);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${eventType}:`, error);
        this.deadLetterQueue.push(envelope);
      }
    }

    for (const sub of toRemove) {
      const current = this.subscribers.get(eventType) || [];
      const idx = current.indexOf(sub);
      if (idx >= 0) current.splice(idx, 1);
    }
  }

  getRecentEvents(limit = 100): EventEnvelope[] {
    return this.eventLog.slice(-limit);
  }

  getDeadLetterQueue(): EventEnvelope[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  getSubscriberCount(eventType?: EventType): number {
    if (eventType) {
      return (this.subscribers.get(eventType) || []).length;
    }
    let total = 0;
    for (const subs of this.subscribers.values()) {
      total += subs.length;
    }
    return total;
  }
}

export const eventBus = new EventBus();

export function setupDefaultEventHandlers(): void {
  eventBus.subscribe('transaction.completed', async (event) => {
    const envelope = event as unknown as EventEnvelope;
    console.log(`[Audit] Transaction completed: ${envelope.payload.transactionId}`);
  });

  eventBus.subscribe('auth.failed_attempt', async (event) => {
    const envelope = event as unknown as EventEnvelope;
    console.log(`[Security] Failed auth attempt from: ${envelope.payload.ip}`);
  });

  eventBus.subscribe('budget.exceeded', async (event) => {
    const envelope = event as unknown as EventEnvelope;
    console.log(`[Alert] Budget exceeded for category: ${envelope.payload.category}`);
  });

  eventBus.subscribe('kyc.submitted', async (event) => {
    const envelope = event as unknown as EventEnvelope;
    console.log(`[KYC] Verification submitted: ${envelope.payload.userId}`);
  });

  eventBus.subscribe('payment.failed', async (event) => {
    const envelope = event as unknown as EventEnvelope;
    console.log(`[Payment] Payment failed: ${envelope.payload.paymentId}, reason: ${envelope.payload.reason}`);
  });
}

export { EventBus, EventType, EventEnvelope };
