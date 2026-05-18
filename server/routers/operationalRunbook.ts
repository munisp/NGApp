import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const operationalRunbookRouter = router({
  listRunbooks: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "runbook")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { runbooks: rows.map(r => ({ id: r.resourceId, name: r.action, status: r.status, metadata: r.metadata, lastRun: r.createdAt })), total: rows.length };
  }),
  executeRunbook: protectedProcedure.input(z.object({ name: z.string(), params: z.record(z.string(), z.unknown()).optional(), dryRun: z.boolean().default(false) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const runId = "runbook-" + crypto.randomUUID();
    await db.insert(auditLog).values({ action: input.name, resource: "runbook", resourceId: runId, status: input.dryRun ? "dry_run" : "success", metadata: { params: input.params, dryRun: input.dryRun } });
    return { runId, name: input.name, status: input.dryRun ? "dry_run_completed" : "completed", dryRun: input.dryRun };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "runbook"));
    return { totalExecutions: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
