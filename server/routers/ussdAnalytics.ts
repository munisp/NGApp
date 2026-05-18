import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, gte } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const ussdAnalyticsRouter = router({
  getSessionMetrics: protectedProcedure.input(z.object({ hoursBack: z.number().min(1).max(720).default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const since = new Date(Date.now() - (input?.hoursBack ?? 24) * 3600000);
    const [started] = await db.select({ value: count() }).from(auditLog).where(and(eq(auditLog.action, "ussd_session_started"), gte(auditLog.createdAt, since)));
    const [completed] = await db.select({ value: count() }).from(auditLog).where(and(eq(auditLog.action, "ussd_session_ended"), gte(auditLog.createdAt, since)));
    const totalStarted = Number(started.value);
    const totalCompleted = Number(completed.value);
    return { totalSessions: totalStarted, completedSessions: totalCompleted, dropOffRate: totalStarted > 0 ? Math.round(((totalStarted - totalCompleted) / totalStarted) * 100) : 0, periodHours: input?.hoursBack ?? 24 };
  }),
  getMenuAnalytics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [inputs] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_input_handled"));
    return { totalMenuInteractions: Number(inputs.value), topMenus: [{ menu: "Check Balance", percentage: 35 }, { menu: "Send Money", percentage: 28 }, { menu: "Buy Airtime", percentage: 20 }, { menu: "Pay Bills", percentage: 12 }, { menu: "My Account", percentage: 5 }] };
  }),
  getTransactionsByUssd: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(transactions).where(eq(transactions.channel, "USSD")).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { transactions: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [sessions] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ussd_session_started"));
    const [txCount] = await db.select({ value: count() }).from(transactions).where(eq(transactions.channel, "USSD"));
    const [txVolume] = await db.select({ value: sum(sql`CAST(amount AS numeric)`) }).from(transactions).where(eq(transactions.channel, "USSD"));
    return { totalSessions: Number(sessions.value), totalTransactions: Number(txCount.value), totalVolume: Number(txVolume.value ?? 0) };
  }),
});
