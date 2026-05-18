import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, avg, gte } from "drizzle-orm";
import { agents, transactions, agentPerformanceScores, disputes, auditLog } from "../../drizzle/schema";

export const agentScorecardRouter = router({
  getScorecard: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
    if (!agent) return null;
    const [txStats] = await db.select({ txCount: count(), volume: sum(transactions.amount) }).from(transactions).where(eq(transactions.agentId, input.agentId));
    const [successTx] = await db.select({ cnt: count() }).from(transactions).where(and(eq(transactions.agentId, input.agentId), eq(transactions.status, "success")));
    const [disputeCount] = await db.select({ cnt: count() }).from(disputes).where(eq(disputes.agentId, input.agentId));
    const successRate = Number(txStats.txCount) > 0 ? Math.round(Number(successTx.cnt) / Number(txStats.txCount) * 100) : 100;
    const disputeRate = Number(txStats.txCount) > 0 ? Math.round(Number(disputeCount.cnt) / Number(txStats.txCount) * 10000) / 100 : 0;
    const overallScore = Math.max(0, Math.min(100, successRate - disputeRate * 5));
    return { agentId: input.agentId, name: agent.businessName, tier: agent.tier, location: agent.location, metrics: { txCount: Number(txStats.txCount), volume: Number(txStats.volume ?? 0), successRate, disputeRate, disputeCount: Number(disputeCount.cnt) }, overallScore, rating: overallScore >= 90 ? "Excellent" : overallScore >= 70 ? "Good" : overallScore >= 50 ? "Average" : "Needs Improvement" };
  }),
  listScorecards: protectedProcedure.input(z.object({ limit: z.number().default(50), minScore: z.number().optional() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(agentPerformanceScores).orderBy(desc(agentPerformanceScores.score)).limit(input.limit);
    return { scorecards: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [avgScore] = await db.select({ value: avg(agentPerformanceScores.score) }).from(agentPerformanceScores);
    const [total] = await db.select({ value: count() }).from(agentPerformanceScores);
    return { averageScore: Number(avgScore.value ?? 0), totalScorecards: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
  refreshScorecard: protectedProcedure.input(z.object({ agentId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "scorecard_refresh", resource: "agent_scores", resourceId: String(input.agentId), status: "success", metadata: {} });
    return { success: true, agentId: input.agentId, refreshedAt: new Date().toISOString() };
  }),
});
