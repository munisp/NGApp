import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const chaosEngineeringConsoleRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "chaos_experiment")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { experiments: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  runExperiment: protectedProcedure.input(z.object({ name: z.string(), target: z.string(), type: z.enum(["latency", "failure", "cpu_stress", "memory_stress", "network_partition"]), duration: z.number().default(60), intensity: z.number().min(1).max(100).default(50) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const expId = "chaos-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "chaos_experiment_run", resource: "chaos_experiment", resourceId: expId, status: "success", metadata: { name: input.name, target: input.target, type: input.type, duration: input.duration, intensity: input.intensity } });
    return { experimentId: expId, name: input.name, status: "completed", target: input.target, type: input.type };
  }),
  stopExperiment: protectedProcedure.input(z.object({ experimentId: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "chaos_experiment_stopped", resource: "chaos_experiment", resourceId: input.experimentId, status: "warning", metadata: {} });
    return { success: true, experimentId: input.experimentId, status: "stopped" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "chaos_experiment"));
    return { totalExperiments: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
