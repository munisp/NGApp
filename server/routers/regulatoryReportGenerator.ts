import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { complianceReports, auditLog } from "../../drizzle/schema";

export const regulatoryReportGeneratorRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(complianceReports.status, input.status));
    const rows = await db.select().from(complianceReports).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(complianceReports.periodEnd)).limit(input?.limit ?? 50);
    return { reports: rows, total: rows.length };
  }),
  generate: protectedProcedure.input(z.object({ reportType: z.string().min(1), period: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [report] = await db.insert(complianceReports).values({ reportType: input.reportType, period: input.period, status: "draft", totalAlerts: 0, highAlerts: 0, mediumAlerts: 0, lowAlerts: 0, escalatedAlerts: 0, resolvedAlerts: 0 }).returning();
    await db.insert(auditLog).values({ action: "regulatory_report_generated", resource: "compliance_reports", resourceId: String(report.id), status: "success", metadata: { reportType: input.reportType, period: input.period } });
    return { id: report.id, reportType: input.reportType, status: "draft" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceReports);
    return { totalReports: Number(total.value) };
  }),
});
