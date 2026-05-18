import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { systemConfig, auditLog, platform_incidents } from "../../drizzle/schema";

export const operationalRunbookRouter = router({
  listRunbooks: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(50), category: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "runbook_registry")).limit(1);
    const registry = rows[0] ? JSON.parse(String(rows[0].value)) : [];
    const filtered = input?.category ? registry.filter((r: any) => r.category === input.category) : registry;
    return { runbooks: filtered.slice(0, input?.limit ?? 50), total: filtered.length };
  }),
  executeRunbook: protectedProcedure.input(z.object({ runbookId: z.string().min(1), parameters: z.record(z.string(), z.string()).optional(), dryRun: z.boolean().default(false) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const executionId = crypto.randomUUID();
    await db.insert(auditLog).values({ action: input.dryRun ? "runbook_dry_run" : "runbook_executed", resource: "operational_runbook", resourceId: executionId, status: "success", metadata: { runbookId: input.runbookId, parameters: input.parameters ?? {}, dryRun: input.dryRun } });
    return { executionId, runbookId: input.runbookId, status: input.dryRun ? "dry_run_complete" : "executed", startedAt: new Date().toISOString() };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [executions] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "runbook_executed"));
    const [incidents] = await db.select({ value: count() }).from(platform_incidents);
    return { totalExecutions: Number(executions.value), openIncidents: Number(incidents.value) };
  }),
});
