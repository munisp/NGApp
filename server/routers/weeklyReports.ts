import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const weeklyReportsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReports: 0, scheduledReports: 0, lastGenerated: null };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "weekly_report_generated")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalReports: rows.length, scheduledReports: 0, lastGenerated: rows.length > 0 ? rows[0].createdAt : null };
  }),
  generateWeeklyReport: protectedProcedure.input(z.object({ weekStart: z.string().optional(), includeCharts: z.boolean().default(true) }).optional()).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const weekStart = input?.weekStart ? new Date(input.weekStart) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [txCount] = await db.select({ value: count() }).from(transactions).where(gte(transactions.createdAt, weekStart));
    const [agentCount] = await db.select({ value: count() }).from(agents);
    const reportId = "WR-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "weekly_report_generated", resource: "reports", resourceId: reportId, status: "success", metadata: { weekStart: weekStart.toISOString(), transactionCount: Number(txCount.value), agentCount: Number(agentCount.value) } });
    return { success: true, reportId, summary: { transactionCount: Number(txCount.value), agentCount: Number(agentCount.value), weekStart: weekStart.toISOString() } };
  }),
  listReports: protectedProcedure.input(z.object({ limit: z.number().default(12) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { reports: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "weekly_report_generated")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 12);
    return { reports: rows.map(r => ({ id: r.id, reportId: r.resourceId, ...r.metadata as any, generatedAt: r.createdAt })), total: rows.length };
  }),
});
