import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { complianceReports, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const regulatoryReportGeneratorRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(complianceReports.status, input.status));
      const rows = await db.select().from(complianceReports).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(complianceReports.periodEnd)).limit(input?.limit ?? 50);
      return { reports: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  generate: protectedProcedure.input(z.object({ reportType: z.string().min(1), period: z.string().min(1) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [report] = await db.insert(complianceReports).values({ reportType: input.reportType, period: input.period, status: "draft", totalAlerts: 0, highAlerts: 0, mediumAlerts: 0, lowAlerts: 0, escalatedAlerts: 0, resolvedAlerts: 0 }).returning();
      await db.insert(auditLog).values({ action: "regulatory_report_generated", resource: "compliance_reports", resourceId: String(report.id), status: "success", metadata: { reportType: input.reportType, period: input.period } });
      return { id: report.id, reportType: input.reportType, status: "draft" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceReports).limit(100);
    return { totalReports: Number(total.value) };
  }),
});
