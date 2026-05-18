import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { systemConfig, auditLog } from "../../drizzle/schema";

export const temporalWorkflowsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalWorkflows: 0, running: 0, completed: 0, failed: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "temporal_workflow")).orderBy(desc(auditLog.createdAt)).limit(500);
    const running = rows.filter(r => (r.metadata as any)?.status === "running").length;
    const completed = rows.filter(r => r.status === "success").length;
    return { totalWorkflows: rows.length, running, completed, failed: rows.filter(r => r.status === "failure").length };
  }),
  listWorkflows: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { workflows: [], total: 0 };
    const conditions: any[] = [eq(auditLog.resource, "temporal_workflow")];
    if (input?.status) conditions.push(sql`${auditLog.status} = ${input.status}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { workflows: rows.map(r => ({ id: r.id, workflowId: r.resourceId, action: r.action, ...r.metadata as any, status: r.status, startedAt: r.createdAt })), total: rows.length };
  }),
  startWorkflow: protectedProcedure.input(z.object({ workflowType: z.string(), taskQueue: z.string().default("default"), input: z.record(z.string(), z.any()).optional(), retryPolicy: z.object({ maxRetries: z.number().default(3), backoffCoefficient: z.number().default(2) }).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const workflowId = "WF-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "workflow_started", resource: "temporal_workflow", resourceId: workflowId, status: "success", metadata: { workflowType: input.workflowType, taskQueue: input.taskQueue, status: "running" } });
    return { success: true, workflowId, status: "running" };
  }),
  cancelWorkflow: protectedProcedure.input(z.object({ workflowId: z.string(), reason: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "workflow_cancelled", resource: "temporal_workflow", resourceId: input.workflowId, status: "success", metadata: { reason: input.reason } });
    return { success: true };
  }),
  getWorkflowConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { config: null };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "temporal_config")).limit(1);
    if (rows.length > 0 && rows[0].value) return { config: JSON.parse(String(rows[0].value)) };
    return { config: { namespace: "54link-production", taskQueues: ["default", "high-priority", "bulk-processing"], workerCount: 4, maxConcurrentActivities: 100 } };
  }),
});
