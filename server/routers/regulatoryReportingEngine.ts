import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { complianceFilings, transactions, auditLog } from "../../drizzle/schema";

export const regulatoryReportingEngineRouter = router({
  generateReport: protectedProcedure.input(z.object({ reportType: z.enum(["cbn_returns", "nibss_report", "aml_report", "ctr_report"]), period: z.string(), format: z.enum(["pdf", "xlsx", "csv"]).default("xlsx") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    const refNum = "RPT-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const [filing] = await db.insert(complianceFilings).values({ filingType: input.reportType, referenceNumber: refNum, reportingPeriod: input.period, status: "generated", totalTransactions: Number(txCount.value), totalAmount: String(txVolume.value ?? 0), filingData: JSON.stringify({ format: input.format }) }).returning();
    await db.insert(auditLog).values({ action: "regulatory_report_generated", resource: "compliance_filings", resourceId: String(filing.id), status: "success", metadata: { reportType: input.reportType, period: input.period } });
    return { reportId: filing.id, reportType: input.reportType, period: input.period, status: "generated" };
  }),
  listReports: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(complianceFilings).orderBy(desc(complianceFilings.createdAt)).limit(input?.limit ?? 20);
    return { reports: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceFilings);
    return { totalReports: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
