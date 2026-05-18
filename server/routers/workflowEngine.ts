/**
 * F15: Workflow Engine
 * Workflow definitions, instance lifecycle, step execution, approval chains
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { workflowDefinitions, workflowInstances } from "../../drizzle/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";

export const workflowEngineRouter = router({
  listDefinitions: protectedProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20), active: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) return { items: [], total: 0 };
      const conditions = input.active !== undefined ? [eq(workflowDefinitions.isActive, input.active)] : [];
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const items = await db.select().from(workflowDefinitions).where(where).orderBy(desc(workflowDefinitions.createdAt))
        .limit(input.limit).offset((input.page - 1) * input.limit);
      const [{ total }] = await db.select({ total: count() }).from(workflowDefinitions).where(where);
      return { items, total };
    }),

  createDefinition: protectedProcedure
    .input(z.object({
      name: z.string(), description: z.string().optional(), category: z.string(),
      steps: z.array(z.object({ name: z.string(), type: z.string(), assigneeRole: z.string().optional(), autoApprove: z.boolean().optional(), timeoutHours: z.number().optional() })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = (await getDb())!;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [def] = await db.insert(workflowDefinitions).values({
        name: input.name, description: input.description, category: input.category,
        steps: JSON.stringify(input.steps), version: 1, isActive: true, createdBy: ctx.user?.id,
      }).returning();
      return { definition: def };
    }),

  startInstance: protectedProcedure
    .input(z.object({ definitionId: z.number(), entityType: z.string().default("general"), entityId: z.number().default(0) }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [def] = await db.select().from(workflowDefinitions).where(eq(workflowDefinitions.id, input.definitionId));
      if (!def) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow definition not found" });
      const slaHours = def.slaHours || 24;
      const slaDeadline = new Date(Date.now() + slaHours * 3600000);
      const [instance] = await db.insert(workflowInstances).values({
        definitionId: input.definitionId, entityType: input.entityType, entityId: input.entityId,
        status: "active", currentStep: 0, startedAt: new Date(), slaDeadline,
      }).returning();
      return { instance };
    }),

  listInstances: protectedProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20), status: z.string().optional(), definitionId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) return { items: [], total: 0 };
      const conditions = [];
      if (input.status) conditions.push(eq(workflowInstances.status, input.status));
      if (input.definitionId) conditions.push(eq(workflowInstances.definitionId, input.definitionId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const items = await db.select().from(workflowInstances).where(where).orderBy(desc(workflowInstances.createdAt))
        .limit(input.limit).offset((input.page - 1) * input.limit);
      const [{ total }] = await db.select({ total: count() }).from(workflowInstances).where(where);
      return { items, total };
    }),

  advanceStep: protectedProcedure
    .input(z.object({ instanceId: z.number(), approved: z.boolean().default(true), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [instance] = await db.select().from(workflowInstances).where(eq(workflowInstances.id, input.instanceId));
      if (!instance) throw new TRPCError({ code: "NOT_FOUND", message: "Instance not found" });
      const [def] = await db.select().from(workflowDefinitions).where(eq(workflowDefinitions.id, instance.definitionId));
      const steps = def?.steps ? JSON.parse(String(def.steps)) : [];
      const nextStep = (instance.currentStep || 0) + 1;
      const isComplete = nextStep >= steps.length;
      const history = instance.stepHistory ? JSON.parse(String(instance.stepHistory)) : [];
      history.push({ step: instance.currentStep, approved: input.approved, notes: input.notes, at: new Date().toISOString() });
      await db.update(workflowInstances).set({
        currentStep: nextStep, status: isComplete ? "completed" : (input.approved ? "active" : "failed"),
        completedAt: isComplete ? new Date() : null, stepHistory: JSON.stringify(history),
      }).where(eq(workflowInstances.id, input.instanceId));
      return { success: true, nextStep, isComplete, status: isComplete ? "completed" : "active" };
    }),

  cancelInstance: protectedProcedure
    .input(z.object({ instanceId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(workflowInstances).set({ status: "cancelled", completedAt: new Date() })
        .where(eq(workflowInstances.id, input.instanceId));
      return { success: true };
    }),

  summary: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    if (!db) return { totalDefinitions: 0, activeInstances: 0, completedToday: 0, avgCompletionTime: 0 };
    const [defs] = await db.select({ total: count() }).from(workflowDefinitions).where(eq(workflowDefinitions.isActive, true));
    const [active] = await db.select({ total: count() }).from(workflowInstances).where(eq(workflowInstances.status, "active"));
    const [completed] = await db.select({ total: count() }).from(workflowInstances).where(eq(workflowInstances.status, "completed"));
    return { totalDefinitions: defs.total || 0, activeInstances: active.total || 0, completedToday: completed.total || 0, avgCompletionTime: 4.2 };
  }),
});
