import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { data_export_jobs, auditLog } from "../../drizzle/schema";

export const transactionExportEngineRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(data_export_jobs.exportType, "transactions")];
    if (input?.status) conditions.push(eq(data_export_jobs.status, input.status));
    const rows = await db.select().from(data_export_jobs).where(and(...conditions)).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50);
    return { exports: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), format: z.string().default("csv"), filters: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [job] = await db.insert(data_export_jobs).values({ name: input.name, exportType: "transactions", format: input.format, filters: input.filters, status: "pending", requestedBy: "system" }).returning();
    await db.insert(auditLog).values({ action: "tx_export_created", resource: "data_export_jobs", resourceId: String(job.id), status: "success", metadata: { name: input.name } });
    return { id: job.id, name: input.name, status: "pending" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(data_export_jobs).where(eq(data_export_jobs.exportType, "transactions"));
    return { totalExports: Number(total.value) };
  }),
});
