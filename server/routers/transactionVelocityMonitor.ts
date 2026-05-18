import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { transactions, velocityLimits } from "../../drizzle/schema";

export const transactionVelocityMonitorRouter = router({
  checkVelocity: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [hourlyCount] = await db.select({ value: count() }).from(transactions).where(and(eq(transactions.agentId, input.agentId), gte(transactions.createdAt, oneHourAgo)));
    const [hourlyVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(and(eq(transactions.agentId, input.agentId), gte(transactions.createdAt, oneHourAgo)));
    return { agentId: input.agentId, hourlyTransactions: Number(hourlyCount.value), hourlyVolume: Number(hourlyVolume.value ?? 0) };
  }),
  listLimits: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(velocityLimits).limit(input?.limit ?? 50);
    return { limits: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions);
    const [limitsCount] = await db.select({ value: count() }).from(velocityLimits);
    return { totalTransactions: Number(total.value), totalLimits: Number(limitsCount.value) };
  }),
});
