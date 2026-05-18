import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { customers, transactions, chatSessions, disputes, auditLog } from "../../drizzle/schema";

export const customer360ViewRouter = router({
  getFullView: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new Error("Customer not found");
    const recentTx = await db.select().from(transactions).where(eq(transactions.agentId, input.customerId)).orderBy(desc(transactions.createdAt)).limit(10);
    const [txStats] = await db.select({ total: count(), volume: sum(sql`CAST(amount AS numeric)`) }).from(transactions).where(eq(transactions.agentId, input.customerId));
    const openDisputes = await db.select().from(disputes).where(and(eq(disputes.customerId, input.customerId), eq(disputes.status, "open"))).limit(5);
    return { customer, recentTransactions: recentTx, transactionStats: { totalCount: Number(txStats.total), totalVolume: Number(txStats.volume ?? 0) }, openDisputes, riskScore: customer.riskScore ?? 0 };
  }),
  getTimeline: protectedProcedure.input(z.object({ customerId: z.number(), limit: z.number().min(1).max(200).default(50) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const txEvents = await db.select().from(transactions).where(eq(transactions.agentId, input.customerId)).orderBy(desc(transactions.createdAt)).limit(input.limit);
    return { events: txEvents.map(t => ({ type: "transaction", id: t.id, amount: t.amount, status: t.status, timestamp: t.createdAt })), total: txEvents.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(customers);
    const [active] = await db.select({ value: count() }).from(customers).where(eq(customers.status, "active"));
    return { totalCustomers: Number(total.value), activeCustomers: Number(active.value) };
  }),
});
