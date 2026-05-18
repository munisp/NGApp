import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { customers, transactions, chatSessions, disputes, auditLog } from "../../drizzle/schema";

export const customer360ViewRouter = router({
  getFullView: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) return null;
    const recentTx = await db.select().from(transactions).where(eq(transactions.customerId, input.customerId)).orderBy(desc(transactions.createdAt)).limit(10);
    const recentChats = await db.select().from(chatSessions).where(eq(chatSessions.customerId, input.customerId)).orderBy(desc(chatSessions.createdAt)).limit(5);
    const recentDisputes = await db.select().from(disputes).where(eq(disputes.customerId, input.customerId)).orderBy(desc(disputes.createdAt)).limit(5);
    const [txStats] = await db.select({ txCount: count(), volume: sum(transactions.amount) }).from(transactions).where(eq(transactions.customerId, input.customerId));
    return { customer, recentTransactions: recentTx, recentChats, recentDisputes, summary: { totalTransactions: Number(txStats.txCount), totalVolume: Number(txStats.volume ?? 0) } };
  }),
  getTimeline: protectedProcedure.input(z.object({ customerId: z.number(), limit: z.number().default(20) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const events = await db.select().from(auditLog).where(eq(auditLog.resourceId, String(input.customerId))).orderBy(desc(auditLog.createdAt)).limit(input.limit);
    return { timeline: events, total: events.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(customers);
    return { totalCustomers: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
