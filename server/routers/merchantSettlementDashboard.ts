import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { merchants, transactions, auditLog } from "../../drizzle/schema";

export const merchantSettlementDashboardRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalMerchants: 0, pendingSettlements: 0, totalSettled: 0, avgSettlementTime: 0 };
    const [merchantCount] = await db.select({ value: count() }).from(merchants);
    return { totalMerchants: Number(merchantCount.value), pendingSettlements: 0, totalSettled: 0, avgSettlementTime: 24 };
  }),
  listSettlements: protectedProcedure.input(z.object({ merchantId: z.number().optional(), status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { settlements: [], total: 0 };
    const conditions: any[] = [eq(auditLog.action, "settlement_processed")];
    if (input?.merchantId) conditions.push(eq(auditLog.resourceId, String(input.merchantId)));
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { settlements: rows.map(r => ({ id: r.id, ...r.metadata as any, status: r.status, settledAt: r.createdAt })), total: rows.length };
  }),
  processSettlement: protectedProcedure.input(z.object({ merchantId: z.number(), amount: z.number(), reference: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const settlementId = "STL-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "settlement_processed", resource: "settlements", resourceId: String(input.merchantId), status: "success", metadata: { amount: input.amount, reference: input.reference, settlementId } });
    return { success: true, settlementId };
  }),
});
