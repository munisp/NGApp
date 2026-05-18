import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { reconciliationBatches, reconciliationItems, transactions, feeAuditTrail, auditLog } from "../../drizzle/schema";

export const revenueReconciliationRouter = router({
  listBatches: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(reconciliationBatches).where(eq(reconciliationBatches.type, "revenue")).orderBy(desc(reconciliationBatches.createdAt)).limit(input?.limit ?? 50);
    return { batches: rows, total: rows.length };
  }),
  createBatch: protectedProcedure.input(z.object({ name: z.string(), dateFrom: z.string(), dateTo: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [batch] = await db.insert(reconciliationBatches).values({ name: input.name, type: "revenue", status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "revenue_reconciliation_created", resource: "reconciliation_batches", resourceId: String(batch.id), status: "success", metadata: { dateFrom: input.dateFrom, dateTo: input.dateTo } });
    return batch;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(reconciliationBatches).where(eq(reconciliationBatches.type, "revenue"));
    const [totalFees] = await db.select({ value: sum(feeAuditTrail.feeAmount) }).from(feeAuditTrail);
    return { totalBatches: Number(total.value), totalFeeRevenue: Number(totalFees.value ?? 0) };
  }),
});
