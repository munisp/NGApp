import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { transactions, velocityLimits, auditLog } from "../../drizzle/schema";

export const transactionVelocityMonitorRouter = router({
  listRules: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(velocityLimits).limit(input?.limit ?? 50);
    return { rules: rows, total: rows.length };
  }),
  getBreaches: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "velocity_breach")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    return { breaches: rows.map(r => ({ id: r.id, agentId: (r.metadata as Record<string, unknown>)?.agentId, breachType: (r.metadata as Record<string, unknown>)?.breachType, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  checkVelocity: protectedProcedure.input(z.object({ agentId: z.number(), transactionType: z.string() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [hourCount] = await db.select({ value: count() }).from(transactions).where(sql`${transactions.agentId} = ${input.agentId} AND ${transactions.createdAt} >= NOW() - INTERVAL '1 hour'`);
    const [dayCount] = await db.select({ value: count() }).from(transactions).where(sql`${transactions.agentId} = ${input.agentId} AND ${transactions.createdAt} >= CURRENT_DATE`);
    const [dayVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(sql`${transactions.agentId} = ${input.agentId} AND ${transactions.createdAt} >= CURRENT_DATE`);
    return { agentId: input.agentId, hourlyCount: Number(hourCount.value), dailyCount: Number(dayCount.value), dailyVolume: Number(dayVolume.value ?? 0), status: Number(hourCount.value) > 50 ? "exceeded" : "within_limits" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRules] = await db.select({ value: count() }).from(velocityLimits);
    const [totalBreaches] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "velocity_breach"));
    return { totalRules: Number(totalRules.value), totalBreaches: Number(totalBreaches.value) };
  }),
});
