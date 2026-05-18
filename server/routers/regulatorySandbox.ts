import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const regulatorySandboxRouter = router({
  listExperiments: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "regulatory_sandbox")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { experiments: rows.map(r => ({ id: r.resourceId, action: r.action, status: r.status, metadata: r.metadata, timestamp: r.createdAt })), total: rows.length };
  }),
  createExperiment: protectedProcedure.input(z.object({ name: z.string(), description: z.string(), regulatoryFramework: z.string(), duration: z.number().default(90) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const expId = "sandbox-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: "sandbox_experiment_created", resource: "regulatory_sandbox", resourceId: expId, status: "success", metadata: { name: input.name, framework: input.regulatoryFramework, duration: input.duration } });
    return { experimentId: expId, name: input.name, status: "active", endsAt: new Date(Date.now() + input.duration * 86400000).toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "regulatory_sandbox"));
    return { totalExperiments: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
