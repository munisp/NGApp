import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const cqrsEventStoreRouter = router({
  listEvents: protectedProcedure.input(z.object({ limit: z.number().default(50), aggregateType: z.string().optional(), aggregateId: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(auditLog.resource, "event_store")];
    if (input?.aggregateId) conditions.push(eq(auditLog.resourceId, input.aggregateId));
    const rows = await db.select().from(auditLog).where(conditions.length > 1 ? sql`${auditLog.resource} = 'event_store' AND ${auditLog.resourceId} = ${input?.aggregateId}` : eq(auditLog.resource, "event_store")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { events: rows.map(r => ({ id: r.id, aggregateId: r.resourceId, eventType: r.action, data: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  appendEvent: protectedProcedure.input(z.object({ aggregateType: z.string(), aggregateId: z.string(), eventType: z.string(), data: z.record(z.string(), z.unknown()) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [event] = await db.insert(auditLog).values({ action: input.eventType, resource: "event_store", resourceId: input.aggregateId, status: "success", metadata: { aggregateType: input.aggregateType, ...input.data } }).returning();
    return { eventId: event.id, aggregateId: input.aggregateId, eventType: input.eventType, version: event.id };
  }),
  getAggregate: protectedProcedure.input(z.object({ aggregateId: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const events = await db.select().from(auditLog).where(sql`${auditLog.resource} = 'event_store' AND ${auditLog.resourceId} = ${input.aggregateId}`).orderBy(auditLog.createdAt);
    return { aggregateId: input.aggregateId, events: events.map(e => ({ eventType: e.action, data: e.metadata, timestamp: e.createdAt })), version: events.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "event_store"));
    return { totalEvents: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
