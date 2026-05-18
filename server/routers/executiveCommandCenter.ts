import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { agents, transactions, disputes, merchants, customers, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const executiveCommandCenterRouter = router({
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [agentCount] = await db.select({ value: count() }).from(agents).limit(100);
    const [activeAgents] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true)).limit(100);
    const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
    const [disputeCount] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "open")).limit(100);
    const [merchantCount] = await db.select({ value: count() }).from(merchants).limit(100);
    const [customerCount] = await db.select({ value: count() }).from(customers).limit(100);
    return { agents: { total: Number(agentCount.value), active: Number(activeAgents.value) }, transactions: { total: Number(txCount.value), volume: Number(txVolume.value ?? 0) }, openDisputes: Number(disputeCount.value), totalMerchants: Number(merchantCount.value), totalCustomers: Number(customerCount.value) };
  }),
  getAlerts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(auditLog).where(eq(auditLog.status, "failure")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
      return { alerts: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getRevenueMetrics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.status, "success")).limit(100);
    const [todayVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(sql`${transactions.status} = 'success' AND ${transactions.createdAt} >= CURRENT_DATE`).limit(100);
    return { totalVolume: Number(totalVolume.value ?? 0), todayVolume: Number(todayVolume.value ?? 0) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).limit(100);
    return { totalTransactions: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
