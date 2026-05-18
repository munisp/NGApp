import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { transactions, commissionPayouts, feeAuditTrail, auditLog } from "../../drizzle/schema";

export const revenueAnalyticsRouter = router({
  getSummary: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.status, "success"));
    const [feeRevenue] = await db.select({ value: sum(feeAuditTrail.feeAmount) }).from(feeAuditTrail);
    const [commissionPaid] = await db.select({ value: sum(commissionPayouts.amount) }).from(commissionPayouts).where(eq(commissionPayouts.status, "paid"));
    return { transactionVolume: Number(txVolume.value ?? 0), feeRevenue: Number(feeRevenue.value ?? 0), commissionPaid: Number(commissionPaid.value ?? 0), netRevenue: Number(feeRevenue.value ?? 0) - Number(commissionPaid.value ?? 0) };
  }),
  getTrend: protectedProcedure.input(z.object({ days: z.number().default(30) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select({ date: sql<string>`DATE(${transactions.createdAt})`, volume: sum(transactions.amount), cnt: count() }).from(transactions).where(gte(transactions.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(input?.days ?? 30))} days'`)).groupBy(sql`DATE(${transactions.createdAt})`).orderBy(sql`DATE(${transactions.createdAt})`);
    return { trend: rows.map(r => ({ date: r.date, volume: Number(r.volume ?? 0), count: Number(r.cnt) })), period: `${input?.days ?? 30} days` };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions);
    const [totalVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    return { totalTransactions: Number(total.value), totalVolume: Number(totalVolume.value ?? 0) };
  }),
});
