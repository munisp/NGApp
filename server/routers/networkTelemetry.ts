import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, avg, gte } from "drizzle-orm";
import { platform_health_checks, observabilityAlerts, auditLog } from "../../drizzle/schema";

export const networkTelemetryRouter = router({
  getMetrics: protectedProcedure.input(z.object({ component: z.string().optional(), hoursBack: z.number().min(1).max(168).default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const since = new Date(Date.now() - (input?.hoursBack ?? 24) * 3600000);
    const rows = await db.select().from(platform_health_checks).where(gte(platform_health_checks.checkedAt, since)).orderBy(desc(platform_health_checks.checkedAt)).limit(200);
    return { metrics: rows.map(r => ({ id: r.id, component: r.component, status: r.status, latencyMs: r.latencyMs, checkedAt: r.checkedAt })), total: rows.length, periodHours: input?.hoursBack ?? 24 };
  }),
  getTopEndpoints: protectedProcedure.input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select({ component: platform_health_checks.component, checkCount: count(), avgLatency: avg(platform_health_checks.latencyMs) }).from(platform_health_checks).groupBy(platform_health_checks.component).orderBy(desc(count())).limit(input?.limit ?? 10);
    return { endpoints: rows.map(r => ({ component: r.component, checkCount: Number(r.checkCount), avgLatencyMs: Number(r.avgLatency ?? 0) })) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_health_checks);
    const [avgLat] = await db.select({ value: avg(platform_health_checks.latencyMs) }).from(platform_health_checks);
    const [alerts] = await db.select({ value: count() }).from(observabilityAlerts);
    return { totalChecks: Number(total.value), avgLatencyMs: Math.round(Number(avgLat.value ?? 0)), totalAlerts: Number(alerts.value) };
  }),
});
