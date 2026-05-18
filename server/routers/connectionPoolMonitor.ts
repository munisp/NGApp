import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const connectionPoolMonitorRouter = router({
  getPoolStatus: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "connection_pool_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { activeConnections: 0, idleConnections: 10, maxConnections: 100, waitingRequests: 0, avgLatencyMs: 5 };
  }),
  getHistory: protectedProcedure.input(z.object({ limit: z.number().default(100) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "connection_pool")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 100);
    return { history: rows.map(r => ({ timestamp: r.createdAt, metadata: r.metadata })), total: rows.length };
  }),
  updateConfig: protectedProcedure.input(z.object({ maxConnections: z.number().optional(), idleTimeoutMs: z.number().optional(), acquireTimeoutMs: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(systemConfig).values({ key: "connection_pool_config", value: JSON.stringify(input) }).onConflictDoUpdate({ target: systemConfig.key, set: { value: JSON.stringify(input), updatedAt: new Date() } });
    await db.insert(auditLog).values({ action: "pool_config_updated", resource: "connection_pool", resourceId: "config", status: "success", metadata: input });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "connection_pool"));
    return { totalEvents: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
