import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const bulkTransactionProcessingRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalBatches: 0, processing: 0, completed: 0, failed: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "bulk_tx_batch")).orderBy(desc(auditLog.createdAt)).limit(500);
    const completed = rows.filter(r => r.status === "success").length;
    const failed = rows.filter(r => r.status === "failure").length;
    return { totalBatches: rows.length, processing: rows.length - completed - failed, completed, failed };
  }),
  listBatches: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { batches: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "bulk_tx_batch")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { batches: rows.map(r => ({ id: r.id, batchId: r.resourceId, ...r.metadata as any, status: r.status, createdAt: r.createdAt })), total: rows.length };
  }),
  submitBatch: protectedProcedure.input(z.object({ transactions: z.array(z.object({ agentId: z.number(), amount: z.number(), type: z.string() })) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const batchId = "BATCH-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "bulk_tx_batch", resource: "transactions", resourceId: batchId, status: "success", metadata: { transactionCount: input.transactions.length } });
    return { success: true, batchId, transactionCount: input.transactions.length };
  }),
});
