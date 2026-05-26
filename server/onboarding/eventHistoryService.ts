/**
 * Event History Service for Webhook Delivery Tracking
 */

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { webhookDeliveryLogs } from "../../drizzle/schema";

export interface EventHistoryFilter {
  webhookId?: number;
  credentialId?: number;
  status?: "pending" | "delivered" | "failed";
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface DeliveryStats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  successRate: number;
  averageDurationMs: number;
}

/**
 * Get paginated event history with filters
 */
export async function getEventHistory(filter: EventHistoryFilter) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filter.webhookId) {
    conditions.push(eq(webhookDeliveryLogs.webhookId, filter.webhookId));
  }

  if (filter.status) {
    conditions.push(eq(webhookDeliveryLogs.status, filter.status));
  }

  if (filter.eventType) {
    conditions.push(eq(webhookDeliveryLogs.event, filter.eventType));
  }

  if (filter.startDate) {
    conditions.push(gte(webhookDeliveryLogs.createdAt, filter.startDate));
  }

  if (filter.endDate) {
    conditions.push(lte(webhookDeliveryLogs.createdAt, filter.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(webhookDeliveryLogs)
    .where(whereClause);

  const total = Number(countResult[0]?.count || 0);

  // Get paginated results
  const events = await db
    .select()
    .from(webhookDeliveryLogs)
    .where(whereClause)
    .orderBy(desc(webhookDeliveryLogs.createdAt))
    .limit(filter.limit || 50)
    .offset(filter.offset || 0);

  return {
    events: events.map((e) => ({
      id: e.id,
      webhookId: e.webhookId,
      event: e.event,
      payload: e.payload,
      eventData: e.eventData ? JSON.parse(e.eventData) : null,
      status: e.status,
      statusCode: e.statusCode,
      responseBody: e.responseBody,
      errorMessage: e.errorMessage,
      deliveryDurationMs: e.deliveryDurationMs,
      attempts: e.attempts,
      lastAttemptAt: e.lastAttemptAt,
      nextRetryAt: e.nextRetryAt,
      createdAt: e.createdAt,
    })),
    total,
    hasMore: (filter.offset || 0) + (filter.limit || 50) < total,
  };
}

/**
 * Get detailed information for a specific event
 */
export async function getEventDetails(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(webhookDeliveryLogs)
    .where(eq(webhookDeliveryLogs.id, eventId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const event = result[0];

  return {
    id: event.id,
    webhookId: event.webhookId,
    event: event.event,
    payload: JSON.parse(event.payload),
    eventData: event.eventData ? JSON.parse(event.eventData) : null,
    status: event.status,
    statusCode: event.statusCode,
    responseBody: event.responseBody,
    errorMessage: event.errorMessage,
    deliveryDurationMs: event.deliveryDurationMs,
    attempts: event.attempts,
    lastAttemptAt: event.lastAttemptAt,
    nextRetryAt: event.nextRetryAt,
    createdAt: event.createdAt,
  };
}

/**
 * Get delivery statistics
 */
export async function getDeliveryStats(filter: {
  webhookId?: number;
  credentialId?: number;
  startDate?: Date;
  endDate?: Date;
}): Promise<DeliveryStats> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filter.webhookId) {
    conditions.push(eq(webhookDeliveryLogs.webhookId, filter.webhookId));
  }

  if (filter.startDate) {
    conditions.push(gte(webhookDeliveryLogs.createdAt, filter.startDate));
  }

  if (filter.endDate) {
    conditions.push(lte(webhookDeliveryLogs.createdAt, filter.endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      delivered: sql<number>`sum(case when ${webhookDeliveryLogs.status} = 'delivered' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${webhookDeliveryLogs.status} = 'failed' then 1 else 0 end)`,
      pending: sql<number>`sum(case when ${webhookDeliveryLogs.status} = 'pending' then 1 else 0 end)`,
      avgDuration: sql<number>`avg(${webhookDeliveryLogs.deliveryDurationMs})`,
    })
    .from(webhookDeliveryLogs)
    .where(whereClause);

  const result = stats[0];
  const total = Number(result.total || 0);
  const delivered = Number(result.delivered || 0);
  const failed = Number(result.failed || 0);
  const pending = Number(result.pending || 0);
  const avgDuration = Number(result.avgDuration || 0);

  return {
    total,
    delivered,
    failed,
    pending,
    successRate: total > 0 ? (delivered / total) * 100 : 0,
    averageDurationMs: Math.round(avgDuration),
  };
}

/**
 * Retry a failed delivery
 */
export async function retryFailedDelivery(eventId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update status to pending for retry
  await db
    .update(webhookDeliveryLogs)
    .set({
      status: "pending",
      lastAttemptAt: new Date(),
    })
    .where(eq(webhookDeliveryLogs.id, eventId));
}

/**
 * Export event history as JSON
 */
export async function exportEventHistory(filter: EventHistoryFilter) {
  const { events } = await getEventHistory({
    ...filter,
    limit: 10000, // Max export limit
    offset: 0,
  });

  return events;
}
