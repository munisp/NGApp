import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { abTestExperiments, abTestVariants, auditLog } from "../../drizzle/schema";

export const platformABTestingRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().default(20), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(abTestExperiments).where(eq(abTestExperiments.status, input.status)).orderBy(desc(abTestExperiments.createdAt)).limit(input?.limit ?? 20) : await db.select().from(abTestExperiments).orderBy(desc(abTestExperiments.createdAt)).limit(input?.limit ?? 20);
    return { experiments: rows, total: rows.length };
  }),
  getExperiment: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [exp] = await db.select().from(abTestExperiments).where(eq(abTestExperiments.id, input.id)).limit(1);
    if (!exp) return null;
    const variants = await db.select().from(abTestVariants).where(eq(abTestVariants.experimentId, input.id));
    return { ...exp, variants };
  }),
  createExperiment: protectedProcedure.input(z.object({ name: z.string(), description: z.string().optional(), variants: z.array(z.object({ name: z.string(), weight: z.number() })).min(2) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [exp] = await db.insert(abTestExperiments).values({ name: input.name, description: input.description, status: "draft" }).returning();
    for (const v of input.variants) {
      await db.insert(abTestVariants).values({ experimentId: exp.id, name: v.name, weight: v.weight });
    }
    await db.insert(auditLog).values({ action: "ab_test_created", resource: "ab_test_experiments", resourceId: String(exp.id), status: "success", metadata: { name: input.name, variantCount: input.variants.length } });
    return exp;
  }),
  startExperiment: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(abTestExperiments).set({ status: "active" }).where(eq(abTestExperiments.id, input.id));
    await db.insert(auditLog).values({ action: "ab_test_started", resource: "ab_test_experiments", resourceId: String(input.id), status: "success", metadata: {} });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(abTestExperiments);
    const [active] = await db.select({ value: count() }).from(abTestExperiments).where(eq(abTestExperiments.status, "active"));
    return { totalExperiments: Number(total.value), activeExperiments: Number(active.value) };
  }),
});
