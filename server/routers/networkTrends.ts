import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agents, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const networkTrendsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { activeAgents: 0, totalTransactions: 0, totalVolume: "0", avgTxPerAgent: 0, regions: 0 };
    const [activeCount] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true)).limit(100);
    const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
    const [vol] = await db.select({ value: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` }).from(transactions).limit(100);
    const regions = await db.select({ location: agents.location }).from(agents).where(eq(agents.isActive, true)).groupBy(agents.location).limit(100);
    return { activeAgents: Number(activeCount.value), totalTransactions: Number(txCount.value), totalVolume: vol.value, avgTxPerAgent: Number(activeCount.value) > 0 ? Math.round(Number(txCount.value) / Number(activeCount.value)) : 0, regions: regions.length };
  }),
  getRegionalTrends: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { trends: [], total: 0 };
      const regions = await db.select({ location: agents.location, agentCount: count() }).from(agents).where(eq(agents.isActive, true)).groupBy(agents.location).limit(input?.limit ?? 20);
      return { trends: regions.map(r => ({ region: r.location, agentCount: Number(r.agentCount), status: "healthy" })), total: regions.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getAgentGrowth: protectedProcedure.input(z.object({ days: z.number().default(30) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { growth: [] };
      const since = new Date(Date.now() - (input?.days ?? 30) * 24 * 60 * 60 * 1000);
      const [newAgents] = await db.select({ value: count() }).from(agents).where(gte(agents.createdAt, since)).limit(100);
      return { growth: [{ period: "current", newAgents: Number(newAgents.value) }] };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
