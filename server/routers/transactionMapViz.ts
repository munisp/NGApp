import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, deviceLocations, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const transactionMapVizRouter = router({
  getHeatmap: protectedProcedure.input(z.object({ hours: z.number().default(24) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const locations = await db.select().from(deviceLocations).orderBy(desc(deviceLocations.createdAt)).limit(500);
      return { points: locations.map(l => ({ lat: l.latitude, lng: l.longitude, weight: 1 })), period: `${input?.hours ?? 24}h`, total: locations.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getAgentLocations: protectedProcedure.input(z.object({ limit: z.number().default(100) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(deviceLocations).orderBy(desc(deviceLocations.createdAt)).limit(input?.limit ?? 100);
      return { agents: rows.map(r => ({ agentId: r.agentId, lat: r.latitude, lng: r.longitude, lastSeen: r.createdAt })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getRegionStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalAgents] = await db.select({ value: count() }).from(agents).limit(100);
    const [totalLocations] = await db.select({ value: count() }).from(deviceLocations).limit(100);
    return { totalAgents: Number(totalAgents.value), totalLocationPoints: Number(totalLocations.value) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(deviceLocations).limit(100);
    return { totalDataPoints: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
