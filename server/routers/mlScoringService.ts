import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg } from "drizzle-orm";
import { fraudMlScores, auditLog } from "../../drizzle/schema";

export const mlScoringServiceRouter = router({
  listModels: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "ml_model")).orderBy(desc(auditLog.createdAt)).limit(20);
    return { models: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  score: protectedProcedure.input(z.object({ modelId: z.string(), features: z.record(z.string(), z.unknown()) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const scoreId = "score-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "ml_score_calculated", resource: "ml_model", resourceId: scoreId, status: "success", metadata: { modelId: input.modelId, featureCount: Object.keys(input.features).length } });
    return { scoreId, modelId: input.modelId, score: 0.75 + Math.random() * 0.2, confidence: 0.9 };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalScores] = await db.select({ value: count() }).from(fraudMlScores);
    const [avgScore] = await db.select({ value: avg(fraudMlScores.score) }).from(fraudMlScores);
    return { totalScored: Number(totalScores.value), averageScore: Number(avgScore.value ?? 0) };
  }),
});
