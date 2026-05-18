import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const pipelineMonitoringRouter = router({
  listPipelines: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "pipeline")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { pipelines: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  getPipelineStatus: protectedProcedure.input(z.object({ pipelineId: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const events = await db.select().from(auditLog).where(sql`${auditLog.resource} = 'pipeline' AND ${auditLog.resourceId} = ${input.pipelineId}`).orderBy(desc(auditLog.createdAt)).limit(10);
    return { pipelineId: input.pipelineId, events, status: events[0]?.status ?? "unknown" };
  }),
  triggerPipeline: protectedProcedure.input(z.object({ name: z.string(), params: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const runId = "pipe-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "pipeline_triggered", resource: "pipeline", resourceId: runId, status: "success", metadata: { name: input.name, params: input.params } });
    return { runId, name: input.name, status: "triggered" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "pipeline"));
    return { totalRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
