import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const cocoIndexPipelineRouter = router({
  listPipelines: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [registry] = await db.select().from(systemConfig).where(eq(systemConfig.key, "coco_index_registry")).limit(1);
      const pipelines = registry ? JSON.parse(String(registry.value)) : [];
      return { pipelines: pipelines.slice(0, input?.limit ?? 50), total: pipelines.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "coco_index_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { enabled: true, schedule: "0 * * * *", retryPolicy: { maxRetries: 3, backoffMs: 5000 } };
  }),
  trigger: protectedProcedure.input(z.object({ pipelineId: z.string().min(1).max(128).optional(), force: z.boolean().default(false) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const runId = crypto.randomUUID();
      await db.insert(auditLog).values({ action: "coco_index_triggered", resource: "coco_index", resourceId: runId, status: "success", metadata: { pipelineId: input.pipelineId, force: input.force } });
      return { runId, status: "running", startedAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "coco_index_triggered")).limit(100);
    return { totalRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
