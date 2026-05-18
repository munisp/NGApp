import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { agents, merchants, transactions, auditLog } from "../../drizzle/schema";

export const platformMaturityScorecardRouter = router({
  getScorecard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [agentCount] = await db.select({ value: count() }).from(agents);
    const [merchantCount] = await db.select({ value: count() }).from(merchants);
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const [auditCount] = await db.select({ value: count() }).from(auditLog);
    const scores = { agentNetwork: Math.min(100, Number(agentCount.value) * 2), merchantCoverage: Math.min(100, Number(merchantCount.value) * 5), transactionVolume: Math.min(100, Number(txCount.value) / 100), auditCompliance: Math.min(100, Number(auditCount.value) / 50), securityPosture: 85, operationalExcellence: 78 };
    const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
    return { overall, scores, maturityLevel: overall > 80 ? "advanced" : overall > 60 ? "intermediate" : overall > 40 ? "developing" : "initial" };
  }),
  getHistory: protectedProcedure.input(z.object({ limit: z.number().default(12) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "maturity_scorecard")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 12);
    return { history: rows.map(r => ({ timestamp: r.createdAt, metadata: r.metadata })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "maturity_scorecard"));
    return { totalAssessments: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
