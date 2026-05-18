import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, transactions } from "../../drizzle/schema";

export const batchProcessingRouter = router({
  listBatches: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "batch_processing")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { batches: rows.map(r => ({ id: r.resourceId, status: r.status, metadata: r.metadata, processedAt: r.createdAt })), total: rows.length };
  }),
  getBatch: protectedProcedure.input(z.object({ batchId: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [batch] = await db.select().from(auditLog).where(sql`${auditLog.action} = 'batch_processing' AND ${auditLog.resourceId} = ${input.batchId}`).limit(1);
    return batch ? { id: batch.resourceId, status: batch.status, metadata: batch.metadata, processedAt: batch.createdAt } : null;
  }),
  submitBatch: protectedProcedure.input(z.object({ type: z.string(), items: z.array(z.record(z.string(), z.unknown())), priority: z.enum(["low", "normal", "high"]).default("normal") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const batchId = "batch-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "batch_processing", resource: "batch_jobs", resourceId: batchId, status: "success", metadata: { type: input.type, itemCount: input.items.length, priority: input.priority } });
    return { batchId, status: "submitted", itemCount: input.items.length, submittedAt: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "batch_processing"));
    return { totalBatches: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
