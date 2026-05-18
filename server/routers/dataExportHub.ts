import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { data_export_jobs, auditLog } from "../../drizzle/schema";

export const dataExportHubRouter = router({
  listExports: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(data_export_jobs).where(eq(data_export_jobs.status, input.status)).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50) : await db.select().from(data_export_jobs).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50);
    return { exports: rows, total: rows.length };
  }),
  getExport: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [job] = await db.select().from(data_export_jobs).where(eq(data_export_jobs.id, input.id)).limit(1);
    return job ?? null;
  }),
  createExport: protectedProcedure.input(z.object({ name: z.string(), type: z.string(), format: z.enum(["csv", "json", "xlsx", "parquet"]).default("csv"), filters: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [job] = await db.insert(data_export_jobs).values({ name: input.name, type: input.type, format: input.format, status: "pending", filters: input.filters ?? {} }).returning();
    await db.insert(auditLog).values({ action: "data_export_created", resource: "data_export_jobs", resourceId: String(job.id), status: "success", metadata: { name: input.name, type: input.type, format: input.format } });
    return job;
  }),
  cancelExport: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(data_export_jobs).set({ status: "cancelled" }).where(eq(data_export_jobs.id, input.id));
    await db.insert(auditLog).values({ action: "data_export_cancelled", resource: "data_export_jobs", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(data_export_jobs);
    return { totalExports: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
