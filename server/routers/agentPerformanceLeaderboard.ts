import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, gte } from "drizzle-orm";
import { agents, transactions, agentPerformanceScores, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentPerformanceLeaderboardRouter = router({
  getLeaderboard: protectedProcedure.input(z.object({ period: z.enum(["daily", "weekly", "monthly", "all_time"]).default("monthly"), limit: z.number().default(20), region: z.string().optional() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const dateFilter = input.period === "daily" ? sql`NOW() - INTERVAL '1 day'` : input.period === "weekly" ? sql`NOW() - INTERVAL '7 days'` : input.period === "monthly" ? sql`NOW() - INTERVAL '30 days'` : sql`NOW() - INTERVAL '10 years'`;
      const rows = await db.select({ agentId: transactions.agentId, txCount: count(), totalVolume: sum(transactions.amount) }).from(transactions).where(gte(transactions.createdAt, dateFilter)).groupBy(transactions.agentId).orderBy(desc(count())).limit(input.limit);
      const leaderboard = [];
      for (const row of rows) {
        if (row.agentId) {
          const [agent] = await db.select({ businessName: agents.businessName, location: agents.location, tier: agents.tier }).from(agents).where(eq(agents.id, row.agentId)).limit(1);
          leaderboard.push({ rank: leaderboard.length + 1, agentId: row.agentId, name: agent?.businessName ?? "Unknown", location: agent?.location, tier: agent?.tier, txCount: Number(row.txCount), totalVolume: Number(row.totalVolume ?? 0) });
        }
      }
      return { leaderboard, period: input.period, generatedAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getAgentRank: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [agentStats] = await db.select({ txCount: count(), totalVolume: sum(transactions.amount) }).from(transactions).where(eq(transactions.agentId, input.agentId)).limit(100);
      const [higherRanked] = await db.select({ cnt: count() }).from(sql`(SELECT agent_id, COUNT(*) as tx_count FROM transactions GROUP BY agent_id HAVING COUNT(*) > ${Number(agentStats.txCount)}) ranked`).limit(100);
      return { agentId: input.agentId, rank: Number(higherRanked.cnt) + 1, txCount: Number(agentStats.txCount), totalVolume: Number(agentStats.totalVolume ?? 0) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true)).limit(100);
    const [txTotal] = await db.select({ value: count() }).from(transactions).limit(100);
    return { totalActiveAgents: Number(total.value), totalTransactions: Number(txTotal.value), lastUpdated: new Date().toISOString() };
  }),
});
