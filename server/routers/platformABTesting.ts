import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { tenantFeatureToggles, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const platformABTestingRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(tenantFeatureToggles).orderBy(desc(tenantFeatureToggles.createdAt)).limit(input?.limit ?? 50);
      return { experiments: rows.map(r => ({ id: r.id, featureKey: r.featureKey, enabled: r.enabled, createdAt: r.createdAt })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  createExperiment: protectedProcedure.input(z.object({ name: z.string().min(1), variant: z.string().default("control") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const expId = "exp-" + crypto.randomUUID().slice(0, 12);
      await db.insert(auditLog).values({ action: "ab_test_created", resource: "ab_test_experiments", resourceId: expId, status: "success", metadata: { name: input.name, variant: input.variant } });
      return { experimentId: expId, name: input.name, variant: input.variant, status: "active" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(tenantFeatureToggles).limit(100);
    return { totalExperiments: Number(total.value) };
  }),
});
