import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { transactions, agents } from "../../drizzle/schema";

export const aiCashFlowPredictorRouter = router({
  predict: protectedProcedure.input(z.object({ agentId: z.number().optional(), days: z.number().int().min(1).max(90).default(7) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const conditions = [gte(transactions.createdAt, thirtyDaysAgo)];
    if (input.agentId) conditions.push(eq(transactions.agentId, input.agentId));
    const [volume30d] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(and(...conditions));
    const [count30d] = await db.select({ value: count() }).from(transactions).where(and(...conditions));
    const dailyAvg = Number(volume30d.value ?? 0) / 30;
    return { predictedVolume: dailyAvg * input.days, dailyAverage: dailyAvg, transactionCount30d: Number(count30d.value), forecastDays: input.days };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    const [txCount] = await db.select({ value: count() }).from(transactions);
    return { totalVolume: Number(total.value ?? 0), totalTransactions: Number(txCount.value) };
  }),
});
