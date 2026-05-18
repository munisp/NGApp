import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const platformABTestingRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().default(20), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "ab_test_experiments")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    let experiments = rows.map(r => ({ id: r.id, experimentId: r.resourceId, name: (r.metadata as Record<string, unknown>)?.name ?? r.action, status: (r.metadata as Record<string, unknown>)?.status ?? "draft", metadata: r.metadata, createdAt: r.createdAt }));
    if (input?.status) experiments = experiments.filter(e => e.status === input.status);
    return { experiments, total: experiments.length };
  }),
  getExperiment: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(auditLog).where(eq(auditLog.id, input.id)).limit(1);
    if (!row) return null;
    const variants = await db.select().from(auditLog).where(sql`${auditLog.resource} = 'ab_test_variants' AND (${auditLog.metadata}->>'experimentId')::int = ${input.id}`);
    return { id: row.id, experimentId: row.resourceId, name: (row.metadata as Record<string, unknown>)?.name, status: (row.metadata as Record<string, unknown>)?.status ?? "draft", metadata: row.metadata, createdAt: row.createdAt, variants: variants.map(v => ({ id: v.id, name: (v.metadata as Record<string, unknown>)?.name, weight: (v.metadata as Record<string, unknown>)?.weight })) };
  }),
  createExperiment: protectedProcedure.input(z.object({ name: z.string(), description: z.string().optional(), variants: z.array(z.object({ name: z.string(), weight: z.number() })).min(2) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const expId = "exp-" + crypto.randomUUID();
    const [exp] = await db.insert(auditLog).values({ action: "ab_test_created", resource: "ab_test_experiments", resourceId: expId, status: "success", metadata: { name: input.name, description: input.description, status: "draft", variantCount: input.variants.length } }).returning();
    for (const v of input.variants) {
      await db.insert(auditLog).values({ action: "ab_test_variant_added", resource: "ab_test_variants", resourceId: expId + "-" + v.name, status: "success", metadata: { experimentId: exp.id, name: v.name, weight: v.weight } });
    }
    return { id: exp.id, experimentId: expId, name: input.name, status: "draft" };
  }),
  startExperiment: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "ab_test_started", resource: "ab_test_experiments", resourceId: String(input.id), status: "success", metadata: { status: "active" } });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ab_test_created"));
    const [active] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "ab_test_started"));
    return { totalExperiments: Number(total.value), activeExperiments: Number(active.value) };
  }),
});
