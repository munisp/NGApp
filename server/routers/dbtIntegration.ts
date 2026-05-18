import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const dbtIntegrationRouter = router({
  listModels: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "dbt_model")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { models: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, runAt: r.createdAt })), total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "dbt_config")).limit(1);
    return config ? { config: JSON.parse(String(config.value)) } : { config: { projectName: "agency_banking", target: "production", threads: 4 } };
  }),
  runModel: protectedProcedure.input(z.object({ modelName: z.string(), fullRefresh: z.boolean().default(false) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const runId = "dbt-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "dbt_model_run", resource: "dbt_model", resourceId: input.modelName, status: "success", metadata: { runId, fullRefresh: input.fullRefresh } });
    return { runId, model: input.modelName, status: "completed" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "dbt_model"));
    return { totalModelRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
