import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { complianceFilings, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const regulatoryReportingEngineRouter = router({
  generateReport: protectedProcedure.input(z.object({ reportType: z.enum(["cbn_returns", "nibss_report", "aml_report", "ctr_report"]), period: z.string(), format: z.enum(["pdf", "xlsx", "csv"]).default("xlsx") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
      const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
      const refNum = "RPT-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const [filing] = await db.insert(complianceFilings).values({ filingType: input.reportType, referenceNumber: refNum, reportingPeriod: input.period, status: "generated", totalTransactions: Number(txCount.value), totalAmount: String(txVolume.value ?? 0), filingData: JSON.stringify({ format: input.format }) }).returning();
      await db.insert(auditLog).values({ action: "regulatory_report_generated", resource: "compliance_filings", resourceId: String(filing.id), status: "success", metadata: { reportType: input.reportType, period: input.period } });
      return { reportId: filing.id, reportType: input.reportType, period: input.period, status: "generated" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  listReports: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(complianceFilings).orderBy(desc(complianceFilings.createdAt)).limit(input?.limit ?? 20);
      return { reports: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceFilings).limit(100);
    return { totalReports: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
