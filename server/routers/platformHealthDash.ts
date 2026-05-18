import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { platform_incidents, auditLog, systemConfig } from "../../drizzle/schema";

export const platformHealthDashRouter = router({
  getOverview: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [incidents] = await db.select({ value: count() }).from(platform_incidents).where(eq(platform_incidents.status, "open"));
    const [totalEvents] = await db.select({ value: count() }).from(auditLog);
    const [failures] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.status, "failure"));
    return { openIncidents: Number(incidents.value), totalEvents: Number(totalEvents.value), failures: Number(failures.value), uptime: 99.95, status: Number(incidents.value) > 0 ? "degraded" : "healthy" };
  }),
  getServiceHealth: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const services = ["api-gateway", "kyc-service", "kyb-engine", "deepface", "pos-gateway", "transaction-engine", "notification-service"];
    const results = [];
    for (const svc of services) {
      const [latest] = await db.select().from(auditLog).where(eq(auditLog.resourceId, svc)).orderBy(desc(auditLog.createdAt)).limit(1);
      results.push({ name: svc, status: latest?.status === "failure" ? "unhealthy" : "healthy", lastCheck: latest?.createdAt ?? null });
    }
    return { services: results };
  }),
  getRecentIncidents: protectedProcedure.input(z.object({ limit: z.number().default(10) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platform_incidents).orderBy(desc(platform_incidents.createdAt)).limit(input?.limit ?? 10);
    return { incidents: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platform_incidents);
    const [open] = await db.select({ value: count() }).from(platform_incidents).where(eq(platform_incidents.status, "open"));
    return { totalIncidents: Number(total.value), openIncidents: Number(open.value), lastUpdated: new Date().toISOString() };
  }),
});
