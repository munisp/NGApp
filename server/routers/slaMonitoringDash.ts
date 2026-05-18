import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { sla_definitions, sla_breaches, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const slaMonitoringDashRouter = router({
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalSlas] = await db.select({ value: count() }).from(sla_definitions).limit(100);
    const [totalBreaches] = await db.select({ value: count() }).from(sla_breaches).limit(100);
    const [recentBreaches] = await db.select({ value: count() }).from(sla_breaches).where(gte(sla_breaches.createdAt, sql`NOW() - INTERVAL '24 hours'`)).limit(100);
    const complianceRate = Number(totalSlas.value) > 0 ? Math.round((1 - Number(totalBreaches.value) / Math.max(Number(totalSlas.value) * 30, 1)) * 100) : 100;
    return { totalSlas: Number(totalSlas.value), totalBreaches: Number(totalBreaches.value), recentBreaches24h: Number(recentBreaches.value), complianceRate: Math.max(0, Math.min(100, complianceRate)) };
  }),
  getBreaches: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(sla_breaches).orderBy(desc(sla_breaches.createdAt)).limit(input?.limit ?? 50);
      return { breaches: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(sla_breaches).limit(100);
    return { totalBreaches: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
