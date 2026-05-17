import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const ussdAnalyticsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSessions: 0, completedSessions: 0, abandonedSessions: 0, avgSessionDuration: 0, successRate: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "ussd")).orderBy(desc(auditLog.createdAt)).limit(500);
    const completed = rows.filter(r => r.status === "success").length;
    return { totalSessions: rows.length, completedSessions: completed, abandonedSessions: rows.length - completed, avgSessionDuration: 45, successRate: rows.length > 0 ? Math.round(completed / rows.length * 100) : 0 };
  }),
  getSessionTrends: protectedProcedure.input(z.object({ days: z.number().default(30) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { trends: [] };
    const since = new Date();
    since.setDate(since.getDate() - (input?.days ?? 30));
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.resource, "ussd"), gte(auditLog.createdAt, since))).orderBy(asc(auditLog.createdAt)).limit(1000);
    const dailyMap: Record<string, number> = {};
    rows.forEach(r => { const d = r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "unknown"; dailyMap[d] = (dailyMap[d] || 0) + 1; });
    return { trends: Object.entries(dailyMap).map(([date, cnt]) => ({ date, sessions: cnt })) };
  }),
  getMenuAnalytics: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { menus: [] };
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.resource, "ussd"), eq(auditLog.action, "menu_selected"))).orderBy(desc(auditLog.createdAt)).limit(500);
    const menuMap: Record<string, number> = {};
    rows.forEach(r => { const menu = (r.metadata as any)?.menu ?? "unknown"; menuMap[menu] = (menuMap[menu] || 0) + 1; });
    return { menus: Object.entries(menuMap).map(([menu, cnt]) => ({ menu, selections: cnt })).sort((a, b) => b.selections - a.selections) };
  }),
  getDropoffAnalysis: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { dropoffs: [] };
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.resource, "ussd"), eq(auditLog.status, "failure"))).orderBy(desc(auditLog.createdAt)).limit(200);
    const stepMap: Record<string, number> = {};
    rows.forEach(r => { const step = (r.metadata as any)?.lastStep ?? "unknown"; stepMap[step] = (stepMap[step] || 0) + 1; });
    return { dropoffs: Object.entries(stepMap).map(([step, cnt]) => ({ step, count: cnt })).sort((a, b) => b.count - a.count) };
  }),
});
