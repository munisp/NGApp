import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { customers, transactions, disputes, loyaltyHistory, auditLog } from "../../drizzle/schema";

export const customer360Router = router({
  getProfile: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) return null;
    const [txStats] = await db.select({ txCount: count(), volume: sum(transactions.amount) }).from(transactions).where(eq(transactions.customerId, input.customerId));
    const [disputeCount] = await db.select({ cnt: count() }).from(disputes).where(eq(disputes.customerId, input.customerId));
    const [loyaltyPoints] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(eq(loyaltyHistory.customerId, input.customerId));
    return { ...customer, metrics: { totalTransactions: Number(txStats.txCount), totalVolume: Number(txStats.volume ?? 0), totalDisputes: Number(disputeCount.cnt), loyaltyPoints: Number(loyaltyPoints.total ?? 0) } };
  }),
  listCustomers: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(customers).where(eq(customers.status, input.status as any)).orderBy(desc(customers.createdAt)).limit(input?.limit ?? 50) : await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(input?.limit ?? 50);
    return { customers: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(customers);
    const [active] = await db.select({ value: count() }).from(customers).where(eq(customers.status, "active"));
    return { totalCustomers: Number(total.value), activeCustomers: Number(active.value) };
  }),
});
