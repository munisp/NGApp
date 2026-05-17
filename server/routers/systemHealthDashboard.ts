import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const systemHealthDashboardRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { overallHealth: "unknown", services: 0, healthyServices: 0, degradedServices: 0, downServices: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'service_health_%'`).limit(100);
    const services = rows.map(r => JSON.parse(String(r.value ?? "{}")));
    const healthy = services.filter((s: any) => s.status === "healthy").length;
    const degraded = services.filter((s: any) => s.status === "degraded").length;
    return { overallHealth: degraded === 0 ? "healthy" : "degraded", services: services.length, healthyServices: healthy, degradedServices: degraded, downServices: services.length - healthy - degraded };
  }),
  listServices: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { services: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'service_health_%'`).limit(input?.limit ?? 50);
    let services = rows.map(r => ({ id: r.key.replace("service_health_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    if (input?.status) services = services.filter((s: any) => s.status === input.status);
    return { services, total: services.length };
  }),
  updateServiceHealth: protectedProcedure.input(z.object({ serviceId: z.string(), status: z.enum(["healthy", "degraded", "down"]), latencyMs: z.number().optional(), errorRate: z.number().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: "service_health_" + input.serviceId, value: JSON.stringify({ status: input.status, latencyMs: input.latencyMs, errorRate: input.errorRate, lastCheck: new Date().toISOString() }) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify({ status: input.status, latencyMs: input.latencyMs, errorRate: input.errorRate, lastCheck: new Date().toISOString() }), updatedAt: new Date() } });
    return { success: true };
  }),
});
