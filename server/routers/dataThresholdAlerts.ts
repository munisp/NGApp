import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const dataThresholdAlertsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalAlerts: 0, activeAlerts: 0, triggeredToday: 0, thresholds: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "threshold_alert_triggered")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalAlerts: rows.length, activeAlerts: 0, triggeredToday: rows.filter(r => { const d = r.createdAt; return d && new Date(d).toDateString() === new Date().toDateString(); }).length, thresholds: 0 };
  }),
  listAlerts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { alerts: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "threshold_alert_triggered")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { alerts: rows.map(r => ({ id: r.id, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  createThreshold: protectedProcedure.input(z.object({ metric: z.string(), operator: z.enum(["gt", "lt", "gte", "lte", "eq"]), value: z.number(), severity: z.enum(["info", "warning", "critical"]).default("warning"), notifyChannels: z.array(z.string()).default(["in_app"]) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const thresholdId = "THR-" + crypto.randomUUID().toUpperCase();
    await db.insert(systemConfig).values({ key: "threshold_" + thresholdId, value: JSON.stringify(input) });
    await db.insert(auditLog).values({ action: "threshold_created", resource: "thresholds", resourceId: thresholdId, status: "success", metadata: input as any });
    return { success: true, thresholdId };
  }),
  deleteThreshold: protectedProcedure.input(z.object({ thresholdId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(systemConfig).where(eq(systemConfig.key, "threshold_" + input.thresholdId));
    return { success: true };
  }),
});
