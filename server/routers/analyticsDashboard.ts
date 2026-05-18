import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { analyticsDashboards, analyticsMetrics, agents, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const analyticsDashboardRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(analyticsDashboards).orderBy(desc(analyticsDashboards.createdAt)).limit(input?.limit ?? 20);
      return { dashboards: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [dashboard] = await db.select().from(analyticsDashboards).where(eq(analyticsDashboards.id, input.id)).limit(1);
      return dashboard ?? null;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getOverview: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [agentCount] = await db.select({ value: count() }).from(agents).limit(100);
    const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
    const [dashCount] = await db.select({ value: count() }).from(analyticsDashboards).limit(100);
    return { totalAgents: Number(agentCount.value), totalTransactions: Number(txCount.value), totalVolume: Number(txVolume.value ?? 0), totalDashboards: Number(dashCount.value) };
  }),
  create: protectedProcedure.input(z.object({ name: z.string(), description: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [dashboard] = await db.insert(analyticsDashboards).values({ name: input.name, description: input.description, config: input.config ?? {} }).returning();
      await db.insert(auditLog).values({ action: "dashboard_created", resource: "analytics_dashboards", resourceId: String(dashboard.id), status: "success", metadata: { name: input.name } });
      return dashboard;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  update: protectedProcedure.input(z.object({ id: z.number(), name: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.config) updates.config = input.config;
      await db.update(analyticsDashboards).set(updates).where(eq(analyticsDashboards.id, input.id));
      await db.insert(auditLog).values({ action: "dashboard_updated", resource: "analytics_dashboards", resourceId: String(input.id), status: "success", metadata: {} });
      return { success: true, id: input.id };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      await db.delete(analyticsDashboards).where(eq(analyticsDashboards.id, input.id));
      await db.insert(auditLog).values({ action: "dashboard_deleted", resource: "analytics_dashboards", resourceId: String(input.id), status: "success", metadata: {} });
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
