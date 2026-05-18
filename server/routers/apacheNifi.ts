import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const apacheNifiRouter = router({
  getProcessGroups: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "nifi_process_group")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { processGroups: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, lastRun: r.createdAt, metadata: r.metadata })), total: rows.length };
  }),
  getFlowStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "nifi_config")).limit(1);
    return config ? { flow: JSON.parse(String(config.value)) } : { flow: { status: "running", activeThreads: 0, queuedBytes: 0, totalProcessors: 0 } };
  }),
  startProcessor: protectedProcedure.input(z.object({ processorId: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "nifi_processor_started", resource: "nifi_process_group", resourceId: input.processorId, status: "success", metadata: {} });
    return { success: true, processorId: input.processorId, state: "RUNNING" };
  }),
  stopProcessor: protectedProcedure.input(z.object({ processorId: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "nifi_processor_stopped", resource: "nifi_process_group", resourceId: input.processorId, status: "success", metadata: {} });
    return { success: true, processorId: input.processorId, state: "STOPPED" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "nifi_process_group"));
    return { totalEvents: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
