import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { platform_health_checks, platform_incidents, observabilityAlerts, auditLog } from "../../drizzle/schema";

export const platformHealthDashRouter = router({
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [checks] = await db.select({ total: count(), avgLat: avg(platform_health_checks.latencyMs) }).from(platform_health_checks);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.status, "healthy"));
    const [incidents] = await db.select({ value: count() }).from(platform_incidents);
    const [alerts] = await db.select({ value: count() }).from(observabilityAlerts);
    const totalChecks = Number(checks.total);
    return { totalChecks, healthyChecks: Number(healthy.value), avgLatencyMs: Math.round(Number(checks.avgLat ?? 0)), uptimePercent: totalChecks > 0 ? Math.round((Number(healthy.value) / totalChecks) * 100) : 100, openIncidents: Number(incidents.value), activeAlerts: Number(alerts.value) };
  }),
  getComponentHealth: protectedProcedure.input(z.object({ component: z.string().min(1) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const checks = await db.select().from(platform_health_checks).where(eq(platform_health_checks.component, input.component)).orderBy(desc(platform_health_checks.checkedAt)).limit(20);
    return { component: input.component, checks, status: checks.length > 0 && checks[0].status === "healthy" ? "healthy" : "degraded" };
  }),
  getIncidents: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platform_incidents).orderBy(desc(platform_incidents.createdAt)).limit(input?.limit ?? 20);
    return { incidents: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [checks] = await db.select({ value: count() }).from(platform_health_checks);
    const [incidents] = await db.select({ value: count() }).from(platform_incidents);
    return { totalChecks: Number(checks.value), totalIncidents: Number(incidents.value) };
  }),
});
