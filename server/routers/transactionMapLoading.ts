import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { transactions, deviceLocations, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const transactionMapLoadingRouter = router({
  getMapData: protectedProcedure.input(z.object({ limit: z.number().default(200) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const locations = await db.select().from(deviceLocations).orderBy(desc(deviceLocations.createdAt)).limit(input?.limit ?? 200);
      return { points: locations.map(l => ({ lat: l.latitude, lng: l.longitude, agentId: l.agentId, timestamp: l.createdAt })), total: locations.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getClusterData: protectedProcedure.input(z.object({ zoomLevel: z.number().default(10) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const locations = await db.select().from(deviceLocations).orderBy(desc(deviceLocations.createdAt)).limit(500);
      return { clusters: locations.map(l => ({ lat: l.latitude, lng: l.longitude, count: 1 })), zoomLevel: input?.zoomLevel ?? 10 };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(deviceLocations).limit(100);
    return { totalLocations: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
