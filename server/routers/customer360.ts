import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { customers, transactions, disputes, loyaltyHistory, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const customer360Router = router({
  getProfile: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      if (!customer) return null;
      const [txStats] = await db.select({ txCount: count(), volume: sum(transactions.amount) }).from(transactions).where(eq(transactions.agentId, input.customerId)).limit(100);
      const [disputeCount] = await db.select({ cnt: count() }).from(disputes).where(eq(disputes.agentId, input.customerId)).limit(100);
      const [loyaltyPoints] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(eq(loyaltyHistory.agentId, input.customerId)).limit(100);
      return { ...customer, metrics: { totalTransactions: Number(txStats.txCount), totalVolume: Number(txStats.volume ?? 0), totalDisputes: Number(disputeCount.cnt), loyaltyPoints: Number(loyaltyPoints.total ?? 0) } };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  listCustomers: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = input?.status ? await db.select().from(customers).where(eq(customers.status, input.status as any)).orderBy(desc(customers.createdAt)).limit(input?.limit ?? 50) : await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(input?.limit ?? 50);
      return { customers: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(customers).limit(100);
    const [active] = await db.select({ value: count() }).from(customers).where(eq(customers.status, "active")).limit(100);
    return { totalCustomers: Number(total.value), activeCustomers: Number(active.value) };
  }),
});
