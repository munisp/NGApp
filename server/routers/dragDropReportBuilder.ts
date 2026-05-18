import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { biReportDefinitions, auditLog } from "../../drizzle/schema";

export const dragDropReportBuilderRouter = router({
  listReports: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(biReportDefinitions).orderBy(desc(biReportDefinitions.createdAt)).limit(input?.limit ?? 20);
    return { reports: rows, total: rows.length };
  }),
  getReport: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [report] = await db.select().from(biReportDefinitions).where(eq(biReportDefinitions.id, input.id)).limit(1);
    return report ?? null;
  }),
  createReport: protectedProcedure.input(z.object({ name: z.string(), description: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [report] = await db.insert(biReportDefinitions).values({ name: input.name, description: input.description, config: input.config ?? {} }).returning();
    await db.insert(auditLog).values({ action: "report_created", resource: "bi_report_definitions", resourceId: String(report.id), status: "success", metadata: { name: input.name } });
    return report;
  }),
  updateReport: protectedProcedure.input(z.object({ id: z.number(), name: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const updates: Record<string, unknown> = {};
    if (input.name) updates.name = input.name;
    if (input.config) updates.config = input.config;
    await db.update(biReportDefinitions).set(updates).where(eq(biReportDefinitions.id, input.id));
    await db.insert(auditLog).values({ action: "report_updated", resource: "bi_report_definitions", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  deleteReport: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(biReportDefinitions).where(eq(biReportDefinitions.id, input.id));
    await db.insert(auditLog).values({ action: "report_deleted", resource: "bi_report_definitions", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(biReportDefinitions);
    return { totalReports: Number(total.value) };
  }),
});
