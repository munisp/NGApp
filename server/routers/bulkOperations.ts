import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { data_export_jobs, auditLog } from "../../drizzle/schema";

export const bulkOperationsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(data_export_jobs.exportType, "bulk_operation")];
    if (input?.status) conditions.push(eq(data_export_jobs.status, input.status));
    const rows = await db.select().from(data_export_jobs).where(and(...conditions)).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50);
    return { operations: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), operationType: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [job] = await db.insert(data_export_jobs).values({ name: input.name, exportType: "bulk_operation", format: "json", status: "pending", requestedBy: "system" }).returning();
    await db.insert(auditLog).values({ action: "bulk_operation_created", resource: "data_export_jobs", resourceId: String(job.id), status: "success", metadata: { name: input.name, type: input.operationType } });
    return { id: job.id, name: input.name, status: "pending" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(data_export_jobs).where(eq(data_export_jobs.exportType, "bulk_operation"));
    return { totalOperations: Number(total.value) };
  }),
});
