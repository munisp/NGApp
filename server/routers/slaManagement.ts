import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { sla_definitions, sla_breaches, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const slaManagementRouter = router({
  listSlas: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(sla_definitions).orderBy(desc(sla_definitions.createdAt)).limit(input?.limit ?? 50);
      return { slas: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getSla: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [sla] = await db.select().from(sla_definitions).where(eq(sla_definitions.id, input.id)).limit(1);
      if (!sla) return null;
      const breaches = await db.select().from(sla_breaches).where(eq(sla_breaches.slaDefinitionId, input.id)).orderBy(desc(sla_breaches.createdAt)).limit(20);
      return { ...sla, breaches };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  createSla: protectedProcedure.input(z.object({ name: z.string(), metric: z.string(), threshold: z.number(), unit: z.string().default("minutes") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [sla] = await db.insert(sla_definitions).values({ name: input.name, serviceType: "custom", metricType: input.metric, targetValue: input.threshold, measurementWindow: input.unit }).returning();
      await db.insert(auditLog).values({ action: "sla_created", resource: "sla_definitions", resourceId: String(sla.id), status: "success", metadata: { name: input.name, metric: input.metric } });
      return sla;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalSlas] = await db.select({ value: count() }).from(sla_definitions).limit(100);
    const [totalBreaches] = await db.select({ value: count() }).from(sla_breaches).limit(100);
    return { totalSlas: Number(totalSlas.value), totalBreaches: Number(totalBreaches.value) };
  }),
});
