import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, avg, and, gte } from "drizzle-orm";
import { platform_health_checks, platform_incidents, observabilityAlerts, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const platformHealthDashRouter = router({
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [checks] = await db.select({ total: count(), avgLat: avg(platform_health_checks.responseTime) }).from(platform_health_checks).limit(100);
    const [healthy] = await db.select({ value: count() }).from(platform_health_checks).where(eq(platform_health_checks.status, "healthy")).limit(100);
    const [incidents] = await db.select({ value: count() }).from(platform_incidents).limit(100);
    const [alerts] = await db.select({ value: count() }).from(observabilityAlerts).limit(100);
    const totalChecks = Number(checks.total);
    return { totalChecks, healthyChecks: Number(healthy.value), avgLatencyMs: Math.round(Number(checks.avgLat ?? 0)), uptimePercent: totalChecks > 0 ? Math.round((Number(healthy.value) / totalChecks) * 100) : 100, openIncidents: Number(incidents.value), activeAlerts: Number(alerts.value) };
  }),
  getComponentHealth: protectedProcedure.input(z.object({ component: z.string().min(1) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const checks = await db.select().from(platform_health_checks).where(eq(platform_health_checks.serviceName, input.component)).orderBy(desc(platform_health_checks.checkedAt)).limit(20);
      return { component: input.component, checks, status: checks.length > 0 && checks[0].status === "healthy" ? "healthy" : "degraded" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getIncidents: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(platform_incidents).orderBy(desc(platform_incidents.startedAt)).limit(input?.limit ?? 20);
      return { incidents: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [checks] = await db.select({ value: count() }).from(platform_health_checks).limit(100);
    const [incidents] = await db.select({ value: count() }).from(platform_incidents).limit(100);
    return { totalChecks: Number(checks.value), totalIncidents: Number(incidents.value) };
  }),
});
