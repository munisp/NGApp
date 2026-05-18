import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { fraudAlerts, fraudMlScores, transactions, auditLog } from "../../drizzle/schema";

export const fraudReportGeneratorRouter = router({
  generateReport: protectedProcedure.input(z.object({ dateFrom: z.string(), dateTo: z.string(), type: z.enum(["summary", "detailed", "regulatory"]).default("summary") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [totalAlerts] = await db.select({ value: count() }).from(fraudAlerts).where(gte(fraudAlerts.createdAt, new Date(input.dateFrom)));
    const [totalVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(gte(transactions.createdAt, new Date(input.dateFrom)));
    const reportId = "fraud-rpt-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "fraud_report_generated", resource: "fraud_reports", resourceId: reportId, status: "success", metadata: { dateFrom: input.dateFrom, dateTo: input.dateTo, type: input.type, totalAlerts: Number(totalAlerts.value) } });
    return { reportId, type: input.type, totalAlerts: Number(totalAlerts.value), totalTransactionVolume: Number(totalVolume.value ?? 0), generatedAt: new Date().toISOString() };
  }),
  listReports: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "fraud_report_generated")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { reports: rows.map(r => ({ id: r.resourceId, metadata: r.metadata, generatedAt: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "fraud_report_generated"));
    return { totalReports: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
