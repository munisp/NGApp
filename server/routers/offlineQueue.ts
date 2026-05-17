import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const offlineQueueRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalItems: 0, pending: 0, synced: 0, failed: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "offline_queue_sync")).orderBy(desc(auditLog.createdAt)).limit(500);
    return { totalItems: rows.length, pending: 0, synced: rows.filter(r => r.status === "success").length, failed: rows.filter(r => r.status === "failure").length };
  }),
  listItems: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "offline_queue_sync")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { items: rows.map(r => ({ id: r.id, ...r.metadata as any, status: r.status, syncedAt: r.createdAt })), total: rows.length };
  }),
  syncItem: protectedProcedure.input(z.object({ itemId: z.string(), payload: z.record(z.string(), z.any()) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "offline_queue_sync", resource: "offline_queue", resourceId: input.itemId, status: "success", metadata: input.payload });
    return { success: true };
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { config: { maxQueueSize: 500, syncIntervalMs: 30000, retryPolicy: { maxRetries: 3, backoffMs: 1000 } } };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "offline_queue_config")).limit(1);
    if (rows.length > 0 && rows[0].value) return { config: JSON.parse(String(rows[0].value)) };
    return { config: { maxQueueSize: 500, syncIntervalMs: 30000, retryPolicy: { maxRetries: 3, backoffMs: 1000 } } };
  }),
});
