import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, count } from "drizzle-orm";
import { data_export_jobs, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const auditTrailExportRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(data_export_jobs.status, input.status));
      const rows = await db.select().from(data_export_jobs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(data_export_jobs.createdAt)).limit(input?.limit ?? 50);
      const [total] = await db.select({ value: count() }).from(data_export_jobs).limit(100);
      return { exports: rows, total: Number(total.value) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  export: protectedProcedure.input(z.object({ name: z.string().min(1), exportType: z.string().min(1), format: z.enum(["csv", "json", "xlsx"]).default("csv"), filters: z.string().optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [job] = await db.insert(data_export_jobs).values({ name: input.name, exportType: input.exportType, format: input.format, filters: input.filters ?? null, status: "pending", requestedBy: "system" }).returning();
      await db.insert(auditLog).values({ action: "audit_trail_export_created", resource: "data_export_jobs", resourceId: String(job.id), status: "success", metadata: { name: input.name, format: input.format } });
      return { id: job.id, name: job.name, status: "pending" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
