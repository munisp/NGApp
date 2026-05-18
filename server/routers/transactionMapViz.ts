import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, deviceLocations, auditLog } from "../../drizzle/schema";

export const transactionMapVizRouter = router({
  getHeatmap: protectedProcedure.input(z.object({ hours: z.number().default(24) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const locations = await db.select().from(deviceLocations).orderBy(desc(deviceLocations.createdAt)).limit(500);
    return { points: locations.map(l => ({ lat: l.latitude, lng: l.longitude, weight: 1 })), period: `${input?.hours ?? 24}h`, total: locations.length };
  }),
  getAgentLocations: protectedProcedure.input(z.object({ limit: z.number().default(100) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(deviceLocations).orderBy(desc(deviceLocations.createdAt)).limit(input?.limit ?? 100);
    return { agents: rows.map(r => ({ agentId: r.agentId, lat: r.latitude, lng: r.longitude, lastSeen: r.createdAt })), total: rows.length };
  }),
  getRegionStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalAgents] = await db.select({ value: count() }).from(agents);
    const [totalLocations] = await db.select({ value: count() }).from(deviceLocations);
    return { totalAgents: Number(totalAgents.value), totalLocationPoints: Number(totalLocations.value) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(deviceLocations);
    return { totalDataPoints: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
