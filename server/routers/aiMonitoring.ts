import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, gte } from "drizzle-orm";
import { auditLog, analyticsMetrics } from "../../drizzle/schema";

export const aiMonitoringRouter = router({
  getModelMetrics: protectedProcedure.input(z.object({ model: z.string().optional(), hours: z.number().default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const since = sql`NOW() - INTERVAL '${sql.raw(String(input?.hours ?? 24))} hours'`;
    const rows = await db.select().from(analyticsMetrics).where(gte(analyticsMetrics.createdAt, since)).orderBy(desc(analyticsMetrics.createdAt)).limit(100);
    return { metrics: rows, total: rows.length, period: `${input?.hours ?? 24}h` };
  }),
  getInferenceLog: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "ai_inference")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { logs: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalInferences] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "ai_inference"));
    const [totalMetrics] = await db.select({ value: count() }).from(analyticsMetrics);
    return { totalInferences: Number(totalInferences.value), totalMetrics: Number(totalMetrics.value), lastUpdated: new Date().toISOString() };
  }),
  logInference: protectedProcedure.input(z.object({ model: z.string(), input: z.string(), latencyMs: z.number(), tokensUsed: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "ai_inference", resource: "ai_inference", resourceId: "inf-" + crypto.randomUUID(), status: "success", metadata: { model: input.model, latencyMs: input.latencyMs, tokensUsed: input.tokensUsed } });
    return { success: true, loggedAt: new Date().toISOString() };
  }),
});
