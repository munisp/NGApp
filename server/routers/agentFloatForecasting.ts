import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { transactions, agents, floatTopUpRequests } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentFloatForecastingRouter = router({
  getForecast: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [weeklyVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(and(eq(transactions.agentId, input.agentId), gte(transactions.createdAt, sevenDaysAgo))).limit(100);
      const [topUpCount] = await db.select({ value: count() }).from(floatTopUpRequests).where(eq(floatTopUpRequests.agentId, input.agentId)).limit(100);
      return { agentId: input.agentId, currentFloat: Number(agent?.floatBalance ?? 0), weeklyVolume: Number(weeklyVolume.value ?? 0), topUpCount: Number(topUpCount.value), forecastDaysUntilEmpty: Number(weeklyVolume.value ?? 0) > 0 ? Math.round((Number(agent?.floatBalance ?? 0) / (Number(weeklyVolume.value ?? 0) / 7))) : 999 };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalFloat] = await db.select({ value: sum(agents.floatBalance) }).from(agents).limit(100);
    const [agentCount] = await db.select({ value: count() }).from(agents).limit(100);
    return { totalFloat: Number(totalFloat.value ?? 0), totalAgents: Number(agentCount.value) };
  }),
});
