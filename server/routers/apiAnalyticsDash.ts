import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { apiKeys, apiKeyUsage, auditLog } from "../../drizzle/schema";

export const apiAnalyticsDashRouter = router({
  getUsageStats: protectedProcedure.input(z.object({ hours: z.number().default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const [totalKeys] = await db.select({ value: count() }).from(apiKeys);
    const [activeKeys] = await db.select({ value: count() }).from(apiKeys).where(eq(apiKeys.status, "active"));
    const recentUsage = await db.select().from(apiKeyUsage).orderBy(desc(apiKeyUsage.lastUsedAt)).limit(50);
    return { totalKeys: Number(totalKeys.value), activeKeys: Number(activeKeys.value), recentUsage, period: `${input?.hours ?? 24}h` };
  }),
  getTopConsumers: protectedProcedure.input(z.object({ limit: z.number().default(10) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(apiKeyUsage).orderBy(desc(apiKeyUsage.requestCount)).limit(input?.limit ?? 10);
    return { topConsumers: rows, total: rows.length };
  }),
  getEndpointMetrics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "api_endpoint")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { endpoints: rows.map(r => ({ endpoint: r.resourceId, action: r.action, status: r.status, timestamp: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(apiKeys);
    const [active] = await db.select({ value: count() }).from(apiKeys).where(eq(apiKeys.status, "active"));
    return { totalApiKeys: Number(total.value), activeApiKeys: Number(active.value), lastUpdated: new Date().toISOString() };
  }),
});
