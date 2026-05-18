import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const distributedTracingDashRouter = router({
  listTraces: protectedProcedure.input(z.object({ limit: z.number().default(50), service: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.service ? await db.select().from(auditLog).where(sql`${auditLog.resource} = 'trace' AND ${auditLog.metadata}->>'service' = ${input.service}`).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50) : await db.select().from(auditLog).where(eq(auditLog.resource, "trace")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { traces: rows.map(r => ({ traceId: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  getTrace: protectedProcedure.input(z.object({ traceId: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const spans = await db.select().from(auditLog).where(sql`${auditLog.resource} = 'trace' AND ${auditLog.resourceId} = ${input.traceId}`).orderBy(auditLog.createdAt);
    return { traceId: input.traceId, spans: spans.map(s => ({ spanId: s.id, action: s.action, status: s.status, metadata: s.metadata, timestamp: s.createdAt })), spanCount: spans.length };
  }),
  getServiceMap: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select({ action: auditLog.action, cnt: count() }).from(auditLog).where(eq(auditLog.resource, "trace")).groupBy(auditLog.action).orderBy(desc(count())).limit(20);
    return { services: rows.map(r => ({ service: r.action, requestCount: Number(r.cnt) })) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "trace"));
    return { totalTraces: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
