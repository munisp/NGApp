import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const platformProxyRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRoutes: 0, activeProxies: 0, totalRequests: 0, avgLatencyMs: 0 };
    const routes = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'proxy_route_%'`).limit(100);
    const events = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "proxy"));
    return { totalRoutes: routes.length, activeProxies: routes.length, totalRequests: Number(events[0].value), avgLatencyMs: 8 };
  }),
  listRoutes: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { routes: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'proxy_route_%'`).limit(input?.limit ?? 50);
    return { routes: rows.map(r => ({ id: r.key.replace("proxy_route_", ""), ...JSON.parse(String(r.value ?? "{}")) })), total: rows.length };
  }),
  addRoute: protectedProcedure.input(z.object({ name: z.string(), path: z.string(), target: z.string(), method: z.enum(["GET", "POST", "PUT", "DELETE", "ALL"]).default("ALL"), rateLimit: z.number().optional(), auth: z.boolean().default(true), enabled: z.boolean().default(true) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: "proxy_route_" + input.name, value: JSON.stringify({ ...input, createdAt: new Date().toISOString() }) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify({ ...input, updatedAt: new Date().toISOString() }), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: "proxy_route_added", resource: "proxy", resourceId: input.name, status: "success", metadata: { path: input.path, target: input.target } });
    return { success: true };
  }),
  removeRoute: protectedProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(systemConfig).where(eq(systemConfig.key, "proxy_route_" + input.name));
    await db.insert(auditLog).values({ action: "proxy_route_removed", resource: "proxy", resourceId: input.name, status: "success" });
    return { success: true };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { config: null };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "proxy_global_config")).limit(1);
    if (rows.length > 0 && rows[0].value) return { config: JSON.parse(String(rows[0].value)) };
    return { config: { corsEnabled: true, rateLimitDefault: 1000, timeoutMs: 30000, compressionEnabled: true, loggingLevel: "info" } };
  }),
  updateConfig: protectedProcedure.input(z.object({ corsEnabled: z.boolean().optional(), rateLimitDefault: z.number().optional(), timeoutMs: z.number().optional(), compressionEnabled: z.boolean().optional(), loggingLevel: z.enum(["debug", "info", "warn", "error"]).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(systemConfig).values({ key: "proxy_global_config", value: JSON.stringify(input) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input), updatedAt: new Date() } });
    return { success: true };
  }),
});
