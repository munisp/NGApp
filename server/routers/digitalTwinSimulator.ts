// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions, agents } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

interface SimulationParams {
  agentCount: number;
  transactionsPerDay: number;
  avgTransactionSize: number;
  growthRate: number;
  durationDays: number;
  churnRate: number;
}

interface SimulationResult {
  day: number;
  activeAgents: number;
  dailyTransactions: number;
  dailyVolume: number;
  cumulativeRevenue: number;
  churnedAgents: number;
}

function runSimulation(params: SimulationParams): SimulationResult[] {
  const results: SimulationResult[] = [];
  let activeAgents = params.agentCount;
  let cumulativeRevenue = 0;
  let totalChurned = 0;

  for (let day = 1; day <= params.durationDays; day++) {
    const newAgents = Math.floor(activeAgents * params.growthRate / 365);
    const churned = Math.floor(activeAgents * params.churnRate / 365);
    activeAgents = activeAgents + newAgents - churned;
    totalChurned += churned;

    const dailyTx = Math.floor(activeAgents * params.transactionsPerDay * (1 + Math.sin(day / 7 * Math.PI) * 0.2));
    const dailyVolume = dailyTx * params.avgTransactionSize;
    const dailyRevenue = dailyVolume * 0.015;
    cumulativeRevenue += dailyRevenue;

    if (day % 7 === 0 || day === 1 || day === params.durationDays) {
      results.push({ day, activeAgents, dailyTransactions: dailyTx, dailyVolume, cumulativeRevenue, churnedAgents: totalChurned });
    }
  }
  return results;
}

function calculateBreakeven(results: SimulationResult[], fixedCostPerDay: number): number | null {
  let cumulativeCost = 0;
  for (const r of results) {
    cumulativeCost += fixedCostPerDay * (r.day === 1 ? 1 : 7);
    if (r.cumulativeRevenue > cumulativeCost) return r.day;
  }
  return null;
}

export const digitalTwinSimulatorRouter = router({
  simulate: protectedProcedure
    .input(z.object({
      agentCount: z.number().min(1).max(100000).default(1000),
      transactionsPerDay: z.number().min(0.1).max(100).default(5),
      avgTransactionSize: z.number().positive().default(2500),
      growthRate: z.number().min(-0.5).max(2).default(0.15),
      durationDays: z.number().min(7).max(365).default(90),
      churnRate: z.number().min(0).max(1).default(0.05),
      fixedCostPerDay: z.number().default(50000),
    }))
    .mutation(async ({ input }) => {
      const results = runSimulation(input);
      const breakeven = calculateBreakeven(results, input.fixedCostPerDay);
      const finalResult = results[results.length - 1];
      return {
        timeline: results,
        summary: {
          finalActiveAgents: finalResult.activeAgents,
          totalRevenue: finalResult.cumulativeRevenue,
          totalChurned: finalResult.churnedAgents,
          breakevenDay: breakeven,
          avgDailyVolume: finalResult.dailyVolume,
        },
      };
    }),

  modelFromHistory: protectedProcedure
    .input(z.object({ lookbackDays: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const txResult = await db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(sum(amount), 0)` }).from(transactions);
      const agentResult = await db.select({ count: sql<number>`count(*)` }).from(agents);
      const txCount = txResult[0]?.count || 0;
      const txTotal = txResult[0]?.total || 0;
      const agentCount = agentResult[0]?.count || 0;
      return {
        estimatedParams: {
          agentCount: agentCount || 100,
          transactionsPerDay: agentCount > 0 ? txCount / Math.max(agentCount, 1) / input.lookbackDays : 5,
          avgTransactionSize: txCount > 0 ? txTotal / txCount : 2500,
          growthRate: 0.15,
          churnRate: 0.05,
        },
        dataPoints: { totalTransactions: txCount, totalAgents: agentCount, totalVolume: txTotal },
      };
    }),

  compareScenarios: protectedProcedure
    .input(z.object({
      scenarios: z.array(z.object({
        name: z.string(),
        agentCount: z.number().default(1000),
        transactionsPerDay: z.number().default(5),
        avgTransactionSize: z.number().default(2500),
        growthRate: z.number().default(0.15),
        durationDays: z.number().default(90),
        churnRate: z.number().default(0.05),
      })).min(2).max(5),
    }))
    .mutation(async ({ input }) => {
      return input.scenarios.map(scenario => {
        const results = runSimulation({ ...scenario, durationDays: scenario.durationDays });
        const final = results[results.length - 1];
        return { name: scenario.name, finalAgents: final.activeAgents, totalRevenue: final.cumulativeRevenue, totalChurned: final.churnedAgents };
      });
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
