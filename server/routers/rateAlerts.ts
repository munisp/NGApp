import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const rateAlertsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalAlerts: 0, activeAlerts: 0, triggeredToday: 0, avgResponseTime: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "rate_alert_triggered")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalAlerts: rows.length, activeAlerts: 0, triggeredToday: rows.filter(r => { const d = r.createdAt; return d && new Date(d).toDateString() === new Date().toDateString(); }).length, avgResponseTime: 0 };
  }),
  listAlerts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { alerts: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "rate_alert_triggered")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { alerts: rows.map(r => ({ id: r.id, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  createAlert: protectedProcedure.input(z.object({ metric: z.string(), threshold: z.number(), operator: z.enum(["gt", "lt", "gte", "lte"]), windowMinutes: z.number().default(5), notifyChannels: z.array(z.string()).default(["in_app"]) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const alertId = "RATE-" + crypto.randomUUID().toUpperCase();
    await db.insert(systemConfig).values({ key: "rate_alert_" + alertId, value: JSON.stringify({ ...input, status: "active", createdAt: new Date().toISOString() }) });
    return { success: true, alertId };
  }),
  deleteAlert: protectedProcedure.input(z.object({ alertId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(systemConfig).where(eq(systemConfig.key, "rate_alert_" + input.alertId));
    return { success: true };
  }),
});
