import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { complianceChecks, complianceFilings, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const regulatorySandboxRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50), status: z.enum(["active", "completed", "suspended"]).optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(complianceChecks).orderBy(desc(complianceChecks.createdAt)).limit(input?.limit ?? 50);
      return { experiments: rows.map(r => ({ id: r.id, checkType: r.checkType, status: r.status, result: r.result, performedAt: r.createdAt })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  createExperiment: protectedProcedure.input(z.object({ name: z.string().min(3).max(128), regulationType: z.string().min(1), parameters: z.record(z.string(), z.string()).optional(), durationDays: z.number().int().min(1).max(365).default(90) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const experimentId = "SAND-" + crypto.randomUUID().slice(0, 12).toUpperCase();
      const [check] = await db.insert(complianceChecks).values({ checkType: "sandbox_experiment", ruleCode: input.regulationType, result: "pending" }).returning();
      await db.insert(auditLog).values({ action: "sandbox_experiment_created", resource: "regulatory_sandbox", resourceId: experimentId, status: "success", metadata: { name: input.name, regulationType: input.regulationType, durationDays: input.durationDays } });
      return { experimentId, checkId: check.id, name: input.name, status: "active", expiresAt: new Date(Date.now() + input.durationDays * 86400000).toISOString() };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceChecks).where(eq(complianceChecks.checkType, "sandbox_experiment")).limit(100);
    return { totalExperiments: Number(total.value) };
  }),
});
