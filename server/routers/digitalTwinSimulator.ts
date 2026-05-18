import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { agents, transactions, platform_health_checks } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const digitalTwinSimulatorRouter = router({
  simulate: protectedProcedure.input(z.object({ scenario: z.string().min(1), duration: z.number().int().min(1).max(3600).default(60) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [agentCount] = await db.select({ value: count() }).from(agents).limit(100);
      const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
      const [healthCount] = await db.select({ value: count() }).from(platform_health_checks).limit(100);
      return { scenario: input.scenario, duration: input.duration, simulatedAgents: Number(agentCount.value), simulatedTransactions: Number(txCount.value), healthChecks: Number(healthCount.value), status: "completed" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [agents_count] = await db.select({ value: count() }).from(agents).limit(100);
    return { totalAgents: Number(agents_count.value) };
  }),
});
