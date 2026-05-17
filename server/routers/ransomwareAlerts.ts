import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const ransomwareAlertsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalAlerts: 0, critical: 0, active: 0, resolved: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "ransomware_alert")).orderBy(desc(auditLog.createdAt)).limit(500);
    const critical = rows.filter(r => (r.metadata as any)?.severity === "critical").length;
    const active = rows.filter(r => (r.metadata as any)?.resolved !== true).length;
    return { totalAlerts: rows.length, critical, active, resolved: rows.length - active };
  }),
  listAlerts: protectedProcedure.input(z.object({ severity: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { alerts: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "ransomware_alert")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    let alerts = rows.map(r => ({ id: r.id, ...r.metadata as any, createdAt: r.createdAt }));
    if (input?.severity) alerts = alerts.filter((a: any) => a.severity === input.severity);
    return { alerts, total: alerts.length };
  }),
  createAlert: protectedProcedure.input(z.object({ eventType: z.string(), severity: z.enum(["low", "medium", "high", "critical"]), source: z.string(), description: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const alertId = "RA-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "ransomware_alert", resource: "security", resourceId: alertId, status: "warning", metadata: { eventType: input.eventType, severity: input.severity, source: input.source, description: input.description, resolved: false } });
    return { success: true, alertId };
  }),
  resolveAlert: protectedProcedure.input(z.object({ alertId: z.string(), resolution: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "ransomware_alert_resolved", resource: "security", resourceId: input.alertId, status: "success", metadata: { resolution: input.resolution, resolved: true } });
    return { success: true };
  }),
});
