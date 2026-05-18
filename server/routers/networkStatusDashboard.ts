import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const networkStatusDashboardRouter = router({
  getStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const services = ["kafka", "redis", "postgresql", "keycloak", "opensearch", "temporal", "apisix"];
    const statuses = [];
    for (const svc of services) {
      const [latest] = await db.select().from(auditLog).where(eq(auditLog.resourceId, svc)).orderBy(desc(auditLog.createdAt)).limit(1);
      statuses.push({ name: svc, status: latest ? "healthy" : "unknown", lastCheck: latest?.createdAt ?? null });
    }
    return { services: statuses, overallStatus: statuses.every(s => s.status === "healthy") ? "healthy" : "degraded" };
  }),
  getLatencyMetrics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "network_latency")).orderBy(desc(auditLog.createdAt)).limit(50);
    return { metrics: rows.map(r => ({ endpoint: r.resourceId, latencyMs: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "network_latency"));
    return { totalChecks: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
