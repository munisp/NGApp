import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, gte } from "drizzle-orm";
import { systemConfig, platform_health_checks, auditLog } from "../../drizzle/schema";

export const graphqlSubscriptionGatewayRouter = router({
  listSubscriptions: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.enum(["active", "paused", "error"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platform_health_checks).where(eq(platform_health_checks.serviceName, "graphql_subscription")).orderBy(desc(platform_health_checks.checkedAt)).limit(input?.limit ?? 50);
    return { subscriptions: rows.map(r => ({ id: r.id, component: r.component, status: r.status, latencyMs: r.latencyMs, checkedAt: r.checkedAt })), total: rows.length };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "graphql_subscription_config")).limit(1);
    const defaults = { transport: "websocket", keepAliveMs: 30000, maxConnections: 1000, heartbeatIntervalMs: 15000, reconnectDelayMs: 5000 };
    return config ? { ...defaults, ...JSON.parse(String(config.value)) } : defaults;
  }),
  updateConfig: protectedProcedure.input(z.object({ transport: z.enum(["websocket", "sse", "long-polling"]).optional(), keepAliveMs: z.number().min(5000).max(120000).optional(), maxConnections: z.number().min(10).max(100000).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, "graphql_subscription_config")).limit(1);
    const merged = existing ? { ...JSON.parse(String(existing.value)), ...input } : input;
    if (existing) {
      await db.update(systemConfig).set({ value: JSON.stringify(merged) }).where(eq(systemConfig.key, "graphql_subscription_config"));
    } else {
      await db.insert(systemConfig).values({ key: "graphql_subscription_config", value: JSON.stringify(merged) });
    }
    await db.insert(auditLog).values({ action: "graphql_config_updated", resource: "graphql_subscription", resourceId: "config", status: "success", metadata: input });
    return { success: true, config: merged };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.serviceName, "graphql_subscription"));
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(and(eq(platform_health_checks.serviceName, "graphql_subscription"), eq(platform_health_checks.status, "healthy")));
    return { totalChecks: Number(total.value), healthyChecks: Number(healthy.value), uptimePercent: Number(total.value) > 0 ? Math.round((Number(healthy.value) / Number(total.value)) * 100) : 100 };
  }),
});
