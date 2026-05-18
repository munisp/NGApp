import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const apacheAirflowRouter = router({
  getDags: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "airflow_dag")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { dags: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, lastRun: r.createdAt, metadata: r.metadata })), total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "airflow_config")).limit(1);
    return config ? { config: JSON.parse(String(config.value)) } : { config: { schedulerUrl: "", executorType: "local", maxParallelism: 16, dagConcurrency: 16 } };
  }),
  triggerDag: protectedProcedure.input(z.object({ dagId: z.string(), conf: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const runId = "run-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "airflow_dag_triggered", resource: "airflow_dag", resourceId: input.dagId, status: "success", metadata: { runId, conf: input.conf } });
    return { success: true, dagId: input.dagId, runId, triggeredAt: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRuns] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "airflow_dag"));
    const [successRuns] = await db.select({ value: count() }).from(auditLog).where(sql`${auditLog.resource} = 'airflow_dag' AND ${auditLog.status} = 'success'`);
    return { totalRuns: Number(totalRuns.value), successfulRuns: Number(successRuns.value), successRate: Number(totalRuns.value) > 0 ? Math.round(Number(successRuns.value) / Number(totalRuns.value) * 100) : 100 };
  }),
});
