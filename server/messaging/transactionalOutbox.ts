import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
  destination: string;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  lastError?: string;
  metadata?: Record<string, any>;
}

export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'dead_letter';

export interface InboxMessage {
  id: string;
  messageId: string;
  eventType: string;
  consumerId: string;
  processedAt: Date;
  idempotencyKey: string;
}

export interface OutboxConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  deadLetterAfterRetries: number;
}

const outboxStore = new Map<string, OutboxMessage>();
const inboxStore = new Map<string, InboxMessage>();
const deadLetterQueue: OutboxMessage[] = [];

export class TransactionalOutbox extends EventEmitter {
  private config: OutboxConfig;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private publishers: Map<string, (message: OutboxMessage) => Promise<void>> = new Map();

  constructor(config?: Partial<OutboxConfig>) {
    super();
    this.config = {
      pollIntervalMs: config?.pollIntervalMs || 1000,
      batchSize: config?.batchSize || 100,
      maxRetries: config?.maxRetries || 5,
      retryDelayMs: config?.retryDelayMs || 5000,
      deadLetterAfterRetries: config?.deadLetterAfterRetries || 10
    };
  }

  registerPublisher(destination: string, publisher: (message: OutboxMessage) => Promise<void>): void {
    this.publishers.set(destination, publisher);
  }

  async addMessage(params: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, any>;
    destination: string;
    metadata?: Record<string, any>;
  }): Promise<OutboxMessage> {
    const message: OutboxMessage = {
      id: crypto.randomUUID(),
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payload: params.payload,
      destination: params.destination,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
      metadata: params.metadata
    };

    outboxStore.set(message.id, message);
    this.emit('messageAdded', message);
    return message;
  }

  async processMessages(): Promise<number> {
    const pendingMessages = Array.from(outboxStore.values())
      .filter(m => m.status === 'pending' || m.status === 'failed')
      .filter(m => m.retryCount < this.config.deadLetterAfterRetries)
      .slice(0, this.config.batchSize);

    let processed = 0;

    for (const message of pendingMessages) {
      try {
        message.status = 'processing';
        
        const publisher = this.publishers.get(message.destination);
        if (!publisher) {
          throw new Error(`No publisher registered for destination: ${message.destination}`);
        }

        await publisher(message);
        
        message.status = 'sent';
        message.processedAt = new Date();
        processed++;
        
        this.emit('messageSent', message);
      } catch (error) {
        message.retryCount++;
        message.lastError = (error as Error).message;
        
        if (message.retryCount >= this.config.deadLetterAfterRetries) {
          message.status = 'dead_letter';
          deadLetterQueue.push(message);
          outboxStore.delete(message.id);
          this.emit('messageDeadLettered', message);
        } else {
          message.status = 'failed';
          this.emit('messageFailed', message, error);
        }
      }
    }

    return processed;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.pollInterval = setInterval(async () => {
      try {
        await this.processMessages();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.pollIntervalMs);
    
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.emit('stopped');
  }

  getStats(): {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    deadLetter: number;
  } {
    const messages = Array.from(outboxStore.values());
    return {
      pending: messages.filter(m => m.status === 'pending').length,
      processing: messages.filter(m => m.status === 'processing').length,
      sent: messages.filter(m => m.status === 'sent').length,
      failed: messages.filter(m => m.status === 'failed').length,
      deadLetter: deadLetterQueue.length
    };
  }

  getDeadLetterQueue(): OutboxMessage[] {
    return [...deadLetterQueue];
  }

  async retryDeadLetter(messageId: string): Promise<boolean> {
    const index = deadLetterQueue.findIndex(m => m.id === messageId);
    if (index === -1) return false;

    const message = deadLetterQueue.splice(index, 1)[0];
    message.status = 'pending';
    message.retryCount = 0;
    message.lastError = undefined;
    
    outboxStore.set(message.id, message);
    this.emit('deadLetterRetried', message);
    return true;
  }
}

export class ConsumerDeduplication {
  private consumerId: string;

  constructor(consumerId: string) {
    this.consumerId = consumerId;
  }

  async isDuplicate(messageId: string, idempotencyKey?: string): Promise<boolean> {
    const key = this.getDedupeKey(messageId, idempotencyKey);
    return inboxStore.has(key);
  }

  async markProcessed(messageId: string, eventType: string, idempotencyKey?: string): Promise<void> {
    const key = this.getDedupeKey(messageId, idempotencyKey);
    
    const record: InboxMessage = {
      id: crypto.randomUUID(),
      messageId,
      eventType,
      consumerId: this.consumerId,
      processedAt: new Date(),
      idempotencyKey: idempotencyKey || messageId
    };

    inboxStore.set(key, record);
  }

  async processWithDeduplication<T>(
    messageId: string,
    eventType: string,
    processor: () => Promise<T>,
    idempotencyKey?: string
  ): Promise<{ processed: boolean; result?: T; duplicate: boolean }> {
    if (await this.isDuplicate(messageId, idempotencyKey)) {
      return { processed: false, duplicate: true };
    }

    const result = await processor();
    await this.markProcessed(messageId, eventType, idempotencyKey);
    
    return { processed: true, result, duplicate: false };
  }

  private getDedupeKey(messageId: string, idempotencyKey?: string): string {
    return `${this.consumerId}:${idempotencyKey || messageId}`;
  }
}

export function createKafkaPublisher(kafkaProducer: any): (message: OutboxMessage) => Promise<void> {
  return async (message: OutboxMessage) => {
    await kafkaProducer.send({
      topic: message.destination,
      messages: [{
        key: message.aggregateId,
        value: JSON.stringify({
          id: message.id,
          type: message.eventType,
          aggregateType: message.aggregateType,
          aggregateId: message.aggregateId,
          payload: message.payload,
          timestamp: message.createdAt.toISOString(),
          metadata: message.metadata
        }),
        headers: {
          'event-type': message.eventType,
          'aggregate-type': message.aggregateType,
          'message-id': message.id
        }
      }]
    });
  };
}

let outboxInstance: TransactionalOutbox | null = null;

export function getTransactionalOutbox(): TransactionalOutbox {
  if (!outboxInstance) {
    outboxInstance = new TransactionalOutbox();
  }
  return outboxInstance;
}

export default TransactionalOutbox;
