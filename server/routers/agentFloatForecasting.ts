import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { transactions, agents, floatTopUpRequests } from "../../drizzle/schema";

export const agentFloatForecastingRouter = router({
  getForecast: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [weeklyVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(and(eq(transactions.agentId, input.agentId), gte(transactions.createdAt, sevenDaysAgo)));
    const [topUpCount] = await db.select({ value: count() }).from(floatTopUpRequests).where(eq(floatTopUpRequests.agentId, input.agentId));
    return { agentId: input.agentId, currentFloat: Number(agent?.floatBalance ?? 0), weeklyVolume: Number(weeklyVolume.value ?? 0), topUpCount: Number(topUpCount.value), forecastDaysUntilEmpty: Number(weeklyVolume.value ?? 0) > 0 ? Math.round((Number(agent?.floatBalance ?? 0) / (Number(weeklyVolume.value ?? 0) / 7))) : 999 };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalFloat] = await db.select({ value: sum(agents.floatBalance) }).from(agents);
    const [agentCount] = await db.select({ value: count() }).from(agents);
    return { totalFloat: Number(totalFloat.value ?? 0), totalAgents: Number(agentCount.value) };
  }),
});
