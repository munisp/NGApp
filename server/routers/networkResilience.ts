import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const networkResilienceRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { overallHealth: "unknown", circuitBreakers: 0, retryPolicies: 0, fallbacksActive: 0 };
    const events = await db.select().from(auditLog).where(eq(auditLog.resource, "network_resilience")).orderBy(desc(auditLog.createdAt)).limit(100);
    const configs = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'resilience_%'`).limit(50);
    return { overallHealth: "healthy", circuitBreakers: configs.filter(c => c.key.includes("circuit")).length, retryPolicies: configs.filter(c => c.key.includes("retry")).length, fallbacksActive: configs.filter(c => c.key.includes("fallback")).length, totalEvents: events.length };
  }),
  listPolicies: protectedProcedure.input(z.object({ type: z.string().optional(), limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { policies: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'resilience_%'`).limit(input?.limit ?? 50);
    let policies = rows.map(r => ({ id: r.key.replace("resilience_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    if (input?.type) policies = policies.filter((p: any) => p.type === input.type);
    return { policies, total: policies.length };
  }),
  setPolicy: protectedProcedure.input(z.object({ name: z.string(), type: z.enum(["circuit_breaker", "retry", "fallback", "bulkhead", "timeout"]), config: z.record(z.string(), z.any()), enabled: z.boolean().default(true) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: "resilience_" + input.name, value: JSON.stringify({ ...input, updatedAt: new Date().toISOString() }) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify({ ...input, updatedAt: new Date().toISOString() }), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: "resilience_policy_set", resource: "network_resilience", resourceId: input.name, status: "success", metadata: { type: input.type } });
    return { success: true };
  }),
  getEvents: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { events: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "network_resilience")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { events: rows.map(r => ({ id: r.id, action: r.action, ...r.metadata as any, status: r.status, timestamp: r.createdAt })), total: rows.length };
  }),
});
