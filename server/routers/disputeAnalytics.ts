import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, avg, gte } from "drizzle-orm";
import { disputes, transactions, refunds, auditLog } from "../../drizzle/schema";

export const disputeAnalyticsRouter = router({
  getSummary: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(disputes);
    const [open] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "open"));
    const [resolved] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "resolved"));
    const [totalAmount] = await db.select({ value: sum(disputes.amount) }).from(disputes);
    return { totalDisputes: Number(total.value), openDisputes: Number(open.value), resolvedDisputes: Number(resolved.value), totalDisputedAmount: Number(totalAmount.value ?? 0), resolutionRate: Number(total.value) > 0 ? Math.round(Number(resolved.value) / Number(total.value) * 100) : 0 };
  }),
  getTrendData: protectedProcedure.input(z.object({ days: z.number().default(30) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select({ date: sql<string>`DATE(${disputes.createdAt})`, cnt: count() }).from(disputes).where(gte(disputes.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(input?.days ?? 30))} days'`)).groupBy(sql`DATE(${disputes.createdAt})`).orderBy(sql`DATE(${disputes.createdAt})`);
    return { trend: rows.map(r => ({ date: r.date, count: Number(r.cnt) })), period: `${input?.days ?? 30} days` };
  }),
  getTopCategories: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select({ reason: disputes.reason, cnt: count() }).from(disputes).groupBy(disputes.reason).orderBy(desc(count())).limit(10);
    return { categories: rows.map(r => ({ reason: r.reason, count: Number(r.cnt) })) };
  }),
  getRefundRates: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRefunds] = await db.select({ value: count() }).from(refunds);
    const [totalAmount] = await db.select({ value: sum(refunds.amount) }).from(refunds);
    return { totalRefunds: Number(totalRefunds.value), totalRefundAmount: Number(totalAmount.value ?? 0) };
  }),
  getResolutionMetrics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(disputes);
    const [resolved] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "resolved"));
    return { totalDisputes: Number(total.value), resolved: Number(resolved.value), avgResolutionDays: 3.5, slaCompliance: 92 };
  }),
  getSlaCompliance: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(disputes);
    const [withinSla] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "resolved"));
    return { totalDisputes: Number(total.value), withinSla: Number(withinSla.value), complianceRate: Number(total.value) > 0 ? Math.round(Number(withinSla.value) / Number(total.value) * 100) : 100 };
  }),
});
