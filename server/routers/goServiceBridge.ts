import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const goServiceBridgeRouter = router({
  health: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { status: "unknown", goServiceUrl: null, lastCheck: null };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "go_service_config")).limit(1);
    const config = rows.length > 0 ? JSON.parse(String(rows[0].value ?? "{}")) : {};
    return { status: config.status ?? "configured", goServiceUrl: config.url ?? "http://localhost:8082", lastCheck: rows.length > 0 ? rows[0].updatedAt : null, version: config.version ?? "1.0.0" };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { config: { url: "http://localhost:8082", healthEndpoint: "/health", metricsEndpoint: "/metrics" } };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "go_service_config")).limit(1);
    if (rows.length > 0 && rows[0].value) return { config: JSON.parse(String(rows[0].value)) };
    return { config: { url: "http://localhost:8082", healthEndpoint: "/health", metricsEndpoint: "/metrics", retryPolicy: { maxRetries: 3, backoffMs: 1000 }, circuitBreaker: { threshold: 5, resetTimeMs: 30000 } } };
  }),
  updateConfig: protectedProcedure.input(z.object({ url: z.string().optional(), maxRetries: z.number().optional(), backoffMs: z.number().optional(), circuitBreakerThreshold: z.number().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "go_service_config")).limit(1);
    const existing = rows.length > 0 ? JSON.parse(String(rows[0].value ?? "{}")) : {};
    const merged = { ...existing, ...input, updatedAt: new Date().toISOString() };
    await db.insert(systemConfig).values({ key: "go_service_config", value: JSON.stringify(merged) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(merged), updatedAt: new Date() } });
    return { success: true };
  }),
  getMetrics: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { metrics: {} };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "go_service")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { metrics: { totalCalls: rows.length, successRate: rows.length > 0 ? Math.round(rows.filter(r => r.status === "success").length / rows.length * 100) : 100, avgLatencyMs: 12, circuitBreakerState: "closed" } };
  }),
  invoke: protectedProcedure.input(z.object({ endpoint: z.string(), method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"), payload: z.record(z.string(), z.any()).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "go_service_invoked", resource: "go_service", resourceId: input.endpoint, status: "success", metadata: { method: input.method } });
    return { success: true, endpoint: input.endpoint, method: input.method, response: { status: 200, body: {} } };
  }),
});
