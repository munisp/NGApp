import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agents, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentClusterAnalyticsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalClusters: 0, activeAgents: 0, avgAgentsPerCluster: 0, topCluster: null };
    const regions = await db.select({ location: agents.location, cnt: count() }).from(agents).where(eq(agents.isActive, true)).groupBy(agents.location).limit(100);
    const [activeCount] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true)).limit(100);
    return { totalClusters: regions.length, activeAgents: Number(activeCount.value), avgAgentsPerCluster: regions.length > 0 ? Math.round(Number(activeCount.value) / regions.length) : 0, topCluster: regions.length > 0 ? regions[0].location : null };
  }),
  listClusters: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { clusters: [], total: 0 };
      const regions = await db.select({ location: agents.location, agentCount: count() }).from(agents).where(eq(agents.isActive, true)).groupBy(agents.location).limit(input?.limit ?? 50);
      return { clusters: regions.map(r => ({ location: r.location, agentCount: Number(r.agentCount), status: "active" })), total: regions.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getClusterDetail: protectedProcedure.input(z.object({ location: z.string() })).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { agents: [], total: 0 };
      const rows = await db.select().from(agents).where(and(eq(agents.isActive, true), eq(agents.location, input.location))).limit(50);
      return { agents: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
