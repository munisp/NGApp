import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { fraudMlScores, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const mlScoringServiceRouter = router({
  listModels: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select({ modelVersion: fraudMlScores.modelVersion, scoreCount: count(), avgScore: avg(fraudMlScores.score) }).from(fraudMlScores).groupBy(fraudMlScores.modelVersion).orderBy(desc(count())).limit(input?.limit ?? 20);
      return { models: rows.map(r => ({ version: r.modelVersion, totalScores: Number(r.scoreCount), avgScore: Number(Number(r.avgScore ?? 0).toFixed(4)) })) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  score: protectedProcedure.input(z.object({ transactionId: z.number(), features: z.record(z.string(), z.number()).optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [tx] = await db.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
      if (!tx) throw new Error("Transaction not found");
      const riskScore = Math.min(1, Math.max(0, (Number(tx.amount) / 1000000) * 0.3 + 0.1));
      const [record] = await db.insert(fraudMlScores).values({ transactionId: input.transactionId, score: String(riskScore), modelVersion: "v3.2.1", features: input.features ?? {} }).returning();
      await db.insert(auditLog).values({ action: "ml_score_generated", resource: "fraud_ml_scores", resourceId: String(record.id), status: "success", metadata: { transactionId: input.transactionId, score: riskScore, modelVersion: "v3.2.1" } });
      return { scoreId: record.id, score: riskScore, riskLevel: riskScore > 0.7 ? "high" : riskScore > 0.4 ? "medium" : "low", modelVersion: "v3.2.1" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(fraudMlScores).limit(100);
    const [avgScore] = await db.select({ value: avg(fraudMlScores.score) }).from(fraudMlScores).limit(100);
    return { totalScores: Number(total.value), avgScore: Number(Number(avgScore.value ?? 0).toFixed(4)) };
  }),
});
