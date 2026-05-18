import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { data_export_jobs, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const batchProcessingRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(data_export_jobs.status, input.status));
      const rows = await db.select().from(data_export_jobs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50);
      return { jobs: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  create: protectedProcedure.input(z.object({ name: z.string().min(1), exportType: z.string().min(1), format: z.string().default("csv") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [job] = await db.insert(data_export_jobs).values({ name: input.name, exportType: input.exportType, format: input.format, status: "pending", requestedBy: "system" }).returning();
      await db.insert(auditLog).values({ action: "batch_job_created", resource: "data_export_jobs", resourceId: String(job.id), status: "success", metadata: { name: input.name, type: input.exportType } });
      return { id: job.id, name: input.name, status: "pending" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(data_export_jobs).limit(100);
    const [pending] = await db.select({ value: count() }).from(data_export_jobs).where(eq(data_export_jobs.status, "pending")).limit(100);
    return { totalJobs: Number(total.value), pendingJobs: Number(pending.value) };
  }),
});
