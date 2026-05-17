import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const autoComplianceWorkflowRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalWorkflows: 0, activeWorkflows: 0, completedToday: 0, failedToday: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'compliance_wf_%'`).limit(100);
    return { totalWorkflows: rows.length, activeWorkflows: rows.filter(r => JSON.parse(String(r.value ?? "{}")).status === "active").length, completedToday: 0, failedToday: 0 };
  }),
  listWorkflows: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { workflows: [], total: 0 };
    const rows = await db.select().from(systemConfig).where(sql`${systemConfig.key} LIKE 'compliance_wf_%'`).limit(input?.limit ?? 20);
    let workflows = rows.map(r => ({ id: r.key.replace("compliance_wf_", ""), ...JSON.parse(String(r.value ?? "{}")) }));
    if (input?.status) workflows = workflows.filter((w: any) => w.status === input.status);
    return { workflows, total: workflows.length };
  }),
  createWorkflow: protectedProcedure.input(z.object({ name: z.string(), type: z.string(), steps: z.array(z.string()), schedule: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const wfId = "CWF-" + Date.now().toString(36).toUpperCase();
    await db.insert(systemConfig).values({ key: "compliance_wf_" + wfId, value: JSON.stringify({ ...input, status: "active", createdAt: new Date().toISOString() }) });
    await db.insert(auditLog).values({ action: "compliance_workflow_created", resource: "compliance_workflows", resourceId: wfId, status: "success", metadata: { name: input.name } });
    return { success: true, workflowId: wfId };
  }),
  triggerWorkflow: protectedProcedure.input(z.object({ workflowId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "compliance_workflow_triggered", resource: "compliance_workflows", resourceId: input.workflowId, status: "success", metadata: {} });
    return { success: true, runId: "RUN-" + Date.now().toString(36).toUpperCase() };
  }),
});
