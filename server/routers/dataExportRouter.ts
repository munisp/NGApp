import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { data_export_jobs, auditLog } from "../../drizzle/schema";

export const dataExportRouterRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(data_export_jobs).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50);
    return { jobs: rows, total: rows.length };
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [job] = await db.select().from(data_export_jobs).where(eq(data_export_jobs.id, input.id)).limit(1);
    return job ?? null;
  }),
  create: protectedProcedure.input(z.object({ name: z.string(), type: z.string(), format: z.enum(["csv", "json", "xlsx"]).default("csv") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [job] = await db.insert(data_export_jobs).values({ name: input.name, type: input.type, format: input.format, status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "export_created", resource: "data_export_jobs", resourceId: String(job.id), status: "success", metadata: { name: input.name } });
    return job;
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(data_export_jobs).where(eq(data_export_jobs.id, input.id));
    await db.insert(auditLog).values({ action: "export_deleted", resource: "data_export_jobs", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(data_export_jobs);
    return { totalExports: Number(total.value) };
  }),
});
