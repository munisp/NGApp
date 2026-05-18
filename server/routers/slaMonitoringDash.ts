import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import { slaDefinitions, slaBreaches, auditLog } from "../../drizzle/schema";

export const slaMonitoringDashRouter = router({
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalSlas] = await db.select({ value: count() }).from(slaDefinitions);
    const [totalBreaches] = await db.select({ value: count() }).from(slaBreaches);
    const [recentBreaches] = await db.select({ value: count() }).from(slaBreaches).where(gte(slaBreaches.createdAt, sql`NOW() - INTERVAL '24 hours'`));
    const complianceRate = Number(totalSlas.value) > 0 ? Math.round((1 - Number(totalBreaches.value) / Math.max(Number(totalSlas.value) * 30, 1)) * 100) : 100;
    return { totalSlas: Number(totalSlas.value), totalBreaches: Number(totalBreaches.value), recentBreaches24h: Number(recentBreaches.value), complianceRate: Math.max(0, Math.min(100, complianceRate)) };
  }),
  getBreaches: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(slaBreaches).orderBy(desc(slaBreaches.createdAt)).limit(input?.limit ?? 50);
    return { breaches: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(slaBreaches);
    return { totalBreaches: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
