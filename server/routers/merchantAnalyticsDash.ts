import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { merchants, merchantSettlements, transactions, auditLog } from "../../drizzle/schema";

export const merchantAnalyticsDashRouter = router({
  getDashboard: protectedProcedure.input(z.object({ merchantId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const [totalMerchants] = await db.select({ value: count() }).from(merchants);
    const [activeMerchants] = await db.select({ value: count() }).from(merchants).where(eq(merchants.status, "active"));
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    return { totalMerchants: Number(totalMerchants.value), activeMerchants: Number(activeMerchants.value), totalTransactions: Number(txCount.value), totalVolume: Number(txVolume.value ?? 0) };
  }),
  listMerchants: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(merchants).where(eq(merchants.status, input.status as any)).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 50) : await db.select().from(merchants).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 50);
    return { merchants: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(merchants);
    return { totalMerchants: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
