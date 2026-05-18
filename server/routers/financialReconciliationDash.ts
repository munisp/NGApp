import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { reconciliationBatches, reconciliationItems, transactions, auditLog } from "../../drizzle/schema";

export const financialReconciliationDashRouter = router({
  listBatches: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(reconciliationBatches).where(eq(reconciliationBatches.status, input.status)).orderBy(desc(reconciliationBatches.createdAt)).limit(input?.limit ?? 50) : await db.select().from(reconciliationBatches).orderBy(desc(reconciliationBatches.createdAt)).limit(input?.limit ?? 50);
    return { batches: rows, total: rows.length };
  }),
  getBatch: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [batch] = await db.select().from(reconciliationBatches).where(eq(reconciliationBatches.id, input.id)).limit(1);
    if (!batch) return null;
    const items = await db.select().from(reconciliationItems).where(eq(reconciliationItems.batchId, input.id)).limit(100);
    return { ...batch, items };
  }),
  createBatch: protectedProcedure.input(z.object({ name: z.string(), type: z.string(), dateRange: z.object({ from: z.string(), to: z.string() }).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [batch] = await db.insert(reconciliationBatches).values({ name: input.name, type: input.type, status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "reconciliation_batch_created", resource: "reconciliation_batches", resourceId: String(batch.id), status: "success", metadata: { name: input.name, type: input.type } });
    return batch;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalBatches] = await db.select({ value: count() }).from(reconciliationBatches);
    const [totalItems] = await db.select({ value: count() }).from(reconciliationItems);
    const [matched] = await db.select({ value: count() }).from(reconciliationItems).where(eq(reconciliationItems.status, "matched"));
    return { totalBatches: Number(totalBatches.value), totalItems: Number(totalItems.value), matchedItems: Number(matched.value), matchRate: Number(totalItems.value) > 0 ? Math.round(Number(matched.value) / Number(totalItems.value) * 100) : 0 };
  }),
});
