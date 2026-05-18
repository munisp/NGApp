import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { apiKeys, apiKeyUsage, rateLimitRules, auditLog } from "../../drizzle/schema";

export const apiGatewayRouter = router({
  listRoutes: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "api_route")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { routes: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, timestamp: r.createdAt, metadata: r.metadata })), total: rows.length };
  }),
  getRateLimits: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(rateLimitRules).orderBy(desc(rateLimitRules.createdAt)).limit(50);
    return { rules: rows, total: rows.length };
  }),
  createRateLimit: protectedProcedure.input(z.object({ endpoint: z.string(), maxRequests: z.number(), windowSeconds: z.number(), action: z.string().default("reject") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [rule] = await db.insert(rateLimitRules).values({ endpoint: input.endpoint, maxRequests: input.maxRequests, windowSeconds: input.windowSeconds, action: input.action }).returning();
    await db.insert(auditLog).values({ action: "rate_limit_created", resource: "rate_limit_rules", resourceId: String(rule.id), status: "success", metadata: { endpoint: input.endpoint } });
    return rule;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalKeys] = await db.select({ value: count() }).from(apiKeys);
    const [totalRules] = await db.select({ value: count() }).from(rateLimitRules);
    return { totalApiKeys: Number(totalKeys.value), totalRateLimitRules: Number(totalRules.value), lastUpdated: new Date().toISOString() };
  }),
  deleteRateLimit: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(rateLimitRules).where(eq(rateLimitRules.id, input.id));
    await db.insert(auditLog).values({ action: "rate_limit_deleted", resource: "rate_limit_rules", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
});
