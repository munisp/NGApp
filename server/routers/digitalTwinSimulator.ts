import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { agents, transactions, platform_health_checks } from "../../drizzle/schema";

export const digitalTwinSimulatorRouter = router({
  simulate: protectedProcedure.input(z.object({ scenario: z.string().min(1), duration: z.number().int().min(1).max(3600).default(60) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [agentCount] = await db.select({ value: count() }).from(agents);
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const [healthCount] = await db.select({ value: count() }).from(platform_health_checks);
    return { scenario: input.scenario, duration: input.duration, simulatedAgents: Number(agentCount.value), simulatedTransactions: Number(txCount.value), healthChecks: Number(healthCount.value), status: "completed" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [agents_count] = await db.select({ value: count() }).from(agents);
    return { totalAgents: Number(agents_count.value) };
  }),
});
