import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { transactions, commissionPayouts, feeAuditTrail, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const revenueAnalyticsRouter = router({
  getSummary: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.status, "success")).limit(100);
    const [feeRevenue] = await db.select({ value: sum(feeAuditTrail.feeAmount) }).from(feeAuditTrail).limit(100);
    const [commissionPaid] = await db.select({ value: sum(commissionPayouts.amount) }).from(commissionPayouts).where(eq(commissionPayouts.status, "paid")).limit(100);
    return { transactionVolume: Number(txVolume.value ?? 0), feeRevenue: Number(feeRevenue.value ?? 0), commissionPaid: Number(commissionPaid.value ?? 0), netRevenue: Number(feeRevenue.value ?? 0) - Number(commissionPaid.value ?? 0) };
  }),
  getTrend: protectedProcedure.input(z.object({ days: z.number().default(30) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select({ date: sql<string>`DATE(${transactions.createdAt})`, volume: sum(transactions.amount), cnt: count() }).from(transactions).where(gte(transactions.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(input?.days ?? 30))} days'`)).groupBy(sql`DATE(${transactions.createdAt})`).orderBy(sql`DATE(${transactions.createdAt})`).limit(100);
      return { trend: rows.map(r => ({ date: r.date, volume: Number(r.volume ?? 0), count: Number(r.cnt) })), period: `${input?.days ?? 30} days` };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).limit(100);
    const [totalVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
    return { totalTransactions: Number(total.value), totalVolume: Number(totalVolume.value ?? 0) };
  }),
});
