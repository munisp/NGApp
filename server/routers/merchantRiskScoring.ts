import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { merchants, transactions, disputes, auditLog } from "../../drizzle/schema";

export const merchantRiskScoringRouter = router({
  getMerchantRisk: protectedProcedure.input(z.object({ merchantId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, input.merchantId)).limit(1);
    if (!merchant) return null;
    const [txCount] = await db.select({ value: count() }).from(transactions).where(eq(transactions.merchantId, input.merchantId));
    const [disputeCount] = await db.select({ value: count() }).from(disputes).where(eq(disputes.merchantId, input.merchantId));
    const disputeRate = Number(txCount.value) > 0 ? Number(disputeCount.value) / Number(txCount.value) * 100 : 0;
    const riskScore = Math.min(100, Math.max(0, disputeRate * 10 + (merchant.status === "suspended" ? 30 : 0)));
    return { merchantId: input.merchantId, name: merchant.businessName, riskScore: Math.round(riskScore), riskLevel: riskScore > 70 ? "high" : riskScore > 40 ? "medium" : "low", factors: { disputeRate: Math.round(disputeRate * 100) / 100, txCount: Number(txCount.value), disputeCount: Number(disputeCount.value) } };
  }),
  listHighRisk: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(merchants).where(eq(merchants.status, "suspended")).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 20);
    return { highRiskMerchants: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(merchants);
    const [suspended] = await db.select({ value: count() }).from(merchants).where(eq(merchants.status, "suspended"));
    return { totalMerchants: Number(total.value), suspendedMerchants: Number(suspended.value), riskRate: Number(total.value) > 0 ? Math.round(Number(suspended.value) / Number(total.value) * 100) : 0 };
  }),
});
