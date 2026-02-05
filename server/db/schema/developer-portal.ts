import { pgTable, varchar, timestamp, json, pgEnum, text, boolean, integer } from 'drizzle-orm/pg-core';

export const apiKeyEnvironmentEnum = pgEnum('api_key_environment', ['development', 'production']);
export const apiKeyStatusEnum = pgEnum('api_key_status', ['active', 'revoked', 'expired']);
export const webhookStatusEnum = pgEnum('webhook_status', ['active', 'inactive', 'failed']);
export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', ['pending', 'delivered', 'failed']);

export const apiKeys = pgTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(), // User-friendly name
  keyValue: text('key_value').notNull(), // Actual API key value
  secretValue: text('secret_value').notNull(), // API secret
  environment: apiKeyEnvironmentEnum('environment').notNull().default('development'),
  permissions: varchar('permissions', { length: 500 }).notNull(), // Comma-separated list
  status: apiKeyStatusEnum('status').notNull().default('active'),
  requestCount: varchar('request_count', { length: 20 }).notNull().default('0'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const apiUsageLogs = pgTable('api_usage_logs', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  apiKeyId: varchar('api_key_id', { length: 36 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(), // e.g., '/api/v1/payments'
  method: varchar('method', { length: 10 }).notNull(), // GET, POST, PUT, DELETE
  statusCode: integer('status_code').notNull(),
  responseTime: varchar('response_time', { length: 20 }).notNull(), // in milliseconds
  cost: varchar('cost', { length: 20 }).notNull(), // Cost in NGN
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const webhooks = pgTable('webhooks', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  url: text('url').notNull(),
  events: json('events').$type<string[]>().notNull(), // ['payment.success', 'transfer.completed']
  secret: text('secret').notNull(), // For signature verification
  status: webhookStatusEnum('status').notNull().default('active'),
  failureCount: integer('failure_count').notNull().default(0),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  webhookId: varchar('webhook_id', { length: 36 }).notNull(),
  event: varchar('event', { length: 100 }).notNull(),
  payload: json('payload').notNull(),
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attemptCount: integer('attempt_count').notNull().default(1),
  status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').notNull(),
});
