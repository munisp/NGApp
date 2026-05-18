import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const cocoIndexPipelineRouter = router({
  listPipelines: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "coco_pipeline")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { pipelines: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "coco_index_config")).limit(1);
    return config ? { config: JSON.parse(String(config.value)) } : { config: { indexName: "default", shards: 3, replicas: 1, refreshInterval: "30s" } };
  }),
  triggerReindex: protectedProcedure.input(z.object({ indexName: z.string(), force: z.boolean().default(false) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const jobId = "reindex-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "coco_reindex_triggered", resource: "coco_pipeline", resourceId: jobId, status: "success", metadata: { indexName: input.indexName, force: input.force } });
    return { jobId, indexName: input.indexName, status: "triggered" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "coco_pipeline"));
    return { totalPipelineRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
