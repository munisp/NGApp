import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const platformABTestingRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50), status: z.enum(["draft", "active", "paused", "completed"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(auditLog.action, "ab_test_created")];
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { experiments: rows.map(r => ({ id: r.resourceId, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  createExperiment: protectedProcedure.input(z.object({ name: z.string().min(3).max(128), variants: z.array(z.object({ name: z.string().min(1).max(64), weight: z.number().min(0).max(100) })).min(2).max(10), targetAudience: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const totalWeight = input.variants.reduce((s, v) => s + v.weight, 0);
    if (totalWeight !== 100) throw new Error("Variant weights must sum to 100");
    const experimentId = "exp-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "ab_test_created", resource: "ab_test_experiments", resourceId: experimentId, status: "success", metadata: { name: input.name, status: "draft", variantCount: input.variants.length } });
    for (const variant of input.variants) {
      await db.insert(auditLog).values({ action: "ab_test_variant_added", resource: "ab_test_variants", resourceId: `${experimentId}-${variant.name}`, status: "success", metadata: { experimentId: experimentId, name: variant.name, weight: variant.weight } });
    }
    return { id: experimentId, name: input.name, status: "draft", variants: input.variants };
  }),
  activateExperiment: protectedProcedure.input(z.object({ experimentId: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "ab_test_activated", resource: "ab_test_experiments", resourceId: input.experimentId, status: "success", metadata: { activatedAt: new Date().toISOString() } });
    return { experimentId: input.experimentId, status: "active" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ab_test_created"));
    const [active] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ab_test_activated"));
    return { totalExperiments: Number(total.value), activeExperiments: Number(active.value) };
  }),
});
