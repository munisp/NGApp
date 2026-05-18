import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const lakehouseAiIntegrationRouter = router({
  listModels: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "lakehouse_model")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { models: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "lakehouse_ai_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { catalogType: "iceberg", storageFormat: "parquet", compressionCodec: "zstd" };
  }),
  trainModel: protectedProcedure.input(z.object({ modelName: z.string(), datasetPath: z.string(), params: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const jobId = "train-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "model_training_started", resource: "lakehouse_model", resourceId: jobId, status: "success", metadata: { modelName: input.modelName, datasetPath: input.datasetPath } });
    return { jobId, modelName: input.modelName, status: "training" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "lakehouse_model"));
    return { totalModels: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
