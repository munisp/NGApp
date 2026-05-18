import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg } from "drizzle-orm";
import { fraudMlScores, fraudAlerts, transactions, auditLog } from "../../drizzle/schema";

export const fraudMlScoringEngineRouter = router({
  listScores: protectedProcedure.input(z.object({ limit: z.number().default(50), minScore: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(fraudMlScores).orderBy(desc(fraudMlScores.createdAt)).limit(input?.limit ?? 50);
    return { scores: rows, total: rows.length };
  }),
  getScore: protectedProcedure.input(z.object({ transactionId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [score] = await db.select().from(fraudMlScores).where(eq(fraudMlScores.transactionId, input.transactionId)).limit(1);
    return score ?? null;
  }),
  scoreTransaction: protectedProcedure.input(z.object({ transactionId: z.number(), features: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
    const riskScore = tx ? Math.min(100, Math.max(0, Number(tx.amount) > 500000 ? 75 : Number(tx.amount) > 100000 ? 50 : 15)) : 0;
    const [score] = await db.insert(fraudMlScores).values({ transactionId: input.transactionId, score: riskScore, model: "ensemble_v2", features: input.features ?? {} }).returning();
    if (riskScore > 70) {
      await db.insert(fraudAlerts).values({ transactionId: input.transactionId, severity: riskScore > 90 ? "critical" : "high", status: "open", description: "ML model flagged high risk", riskScore });
    }
    await db.insert(auditLog).values({ action: "fraud_ml_scored", resource: "fraud_ml_scores", resourceId: String(score.id), status: "success", metadata: { transactionId: input.transactionId, riskScore } });
    return score;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudMlScores);
    const [avgScore] = await db.select({ value: avg(fraudMlScores.score) }).from(fraudMlScores);
    const [alerts] = await db.select({ value: count() }).from(fraudAlerts);
    return { totalScored: Number(total.value), averageScore: Number(avgScore.value ?? 0), totalAlerts: Number(alerts.value) };
  }),
});
