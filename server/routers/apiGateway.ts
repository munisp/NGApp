import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, avg } from "drizzle-orm";
import { rateLimitRules, apiKeys, apiKeyUsage, platform_health_checks, auditLog } from "../../drizzle/schema";

export const apiGatewayRouter = router({
  listRoutes: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(rateLimitRules).orderBy(desc(rateLimitRules.createdAt)).limit(input?.limit ?? 50);
    return { routes: rows, total: rows.length };
  }),
  getHealth: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [checks] = await db.select({ total: count(), avgLatency: avg(platform_health_checks.latencyMs) }).from(platform_health_checks);
    return { status: "healthy", totalChecks: Number(checks.total), avgLatencyMs: Math.round(Number(checks.avgLatency ?? 0)) };
  }),
  updateRateLimit: protectedProcedure.input(z.object({ ruleId: z.number(), maxRequests: z.number().int().min(1).max(100000), windowMs: z.number().int().min(1000).max(3600000) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(rateLimitRules).set({ maxRequests: input.maxRequests, windowMs: input.windowMs }).where(eq(rateLimitRules.id, input.ruleId));
    await db.insert(auditLog).values({ action: "rate_limit_updated", resource: "rate_limit_rules", resourceId: String(input.ruleId), status: "success", metadata: { maxRequests: input.maxRequests, windowMs: input.windowMs } });
    return { success: true, ruleId: input.ruleId };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [rules] = await db.select({ value: count() }).from(rateLimitRules);
    const [keys] = await db.select({ value: count() }).from(apiKeys);
    return { totalRules: Number(rules.value), totalApiKeys: Number(keys.value) };
  }),
});
