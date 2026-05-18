import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agents, transactions, commissionPayouts } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentRevenueAttributionRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRevenue: 0, totalCommissions: 0, totalAgents: 0, avgRevenuePerAgent: 0 };
    const [agentCount] = await db.select({ value: count() }).from(agents).limit(100);
    const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
    return { totalRevenue: 0, totalCommissions: 0, totalAgents: Number(agentCount.value), totalTransactions: Number(txCount.value), avgRevenuePerAgent: 0 };
  }),
  getAgentRevenue: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return null;
      const txs = await db.select().from(transactions).where(eq(transactions.agentId, input.agentId)).orderBy(desc(transactions.createdAt)).limit(50);
      const payouts = await db.select().from(commissionPayouts).where(eq(commissionPayouts.agentId, input.agentId)).orderBy(desc(commissionPayouts.createdAt)).limit(20);
      return { agentId: input.agentId, transactions: txs, payouts, totalTransactions: txs.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  listTopEarners: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { agents: [], total: 0 };
      const rows = await db.select({ agentId: transactions.agentId, txCount: count() }).from(transactions).groupBy(transactions.agentId).orderBy(desc(count())).limit(input?.limit ?? 20);
      return { agents: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
