import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const regulatoryReportGeneratorRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReports: 0, pendingSubmissions: 0, completedSubmissions: 0, nextDeadline: null };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "regulatory_report_generated")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalReports: rows.length, pendingSubmissions: 0, completedSubmissions: rows.length, nextDeadline: null };
  }),
  listReports: protectedProcedure.input(z.object({ regulatoryBody: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { reports: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "regulatory_report_generated")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { reports: rows.map(r => ({ id: r.id, ...r.metadata as any, generatedAt: r.createdAt })), total: rows.length };
  }),
  generateReport: protectedProcedure.input(z.object({ reportType: z.string(), regulatoryBody: z.enum(["CBN", "NDIC", "SEC", "NFIU", "FIRS"]), dateFrom: z.string(), dateTo: z.string(), format: z.enum(["pdf", "csv", "xml"]).default("pdf") })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const reportId = "REG-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "regulatory_report_generated", resource: "regulatory_reports", resourceId: reportId, status: "success", metadata: { ...input } as any });
    return { success: true, reportId, status: "generating" };
  }),
});
