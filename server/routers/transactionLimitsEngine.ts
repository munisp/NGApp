import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const LIMITS: Record<string, { perTx: number; daily: number; monthly: number }> = {
  "tier1": { perTx: 50000, daily: 300000, monthly: 3000000 },
  "tier2": { perTx: 200000, daily: 1000000, monthly: 10000000 },
  "tier3": { perTx: 5000000, daily: 10000000, monthly: 50000000 },
};
export const transactionLimitsEngineRouter = router({
  getLimits: protectedProcedure.input(z.object({ tier: z.string() })).query(async ({ input }) => LIMITS[input.tier] ?? LIMITS["tier1"]),
  checkLimit: protectedProcedure.input(z.object({ tier: z.string(), amount: z.number(), dailyTotal: z.number().optional(), monthlyTotal: z.number().optional() })).query(async ({ input }) => {
    const limits = LIMITS[input.tier] ?? LIMITS["tier1"];
    if (input.amount > limits.perTx) return { allowed: false, reason: `Exceeds per-transaction limit of N${limits.perTx.toLocaleString()}` };
    if ((input.dailyTotal??0) + input.amount > limits.daily) return { allowed: false, reason: `Exceeds daily limit` };
    if ((input.monthlyTotal??0) + input.amount > limits.monthly) return { allowed: false, reason: `Exceeds monthly limit` };
    return { allowed: true, remaining: { perTx: limits.perTx - input.amount, daily: limits.daily - (input.dailyTotal??0) - input.amount } };
  }),
  updateLimits: protectedProcedure.input(z.object({ tier: z.string(), perTx: z.number().optional(), daily: z.number().optional(), monthly: z.number().optional() })).mutation(async ({ input }) => {
    if (LIMITS[input.tier]) { Object.assign(LIMITS[input.tier], { ...(input.perTx && { perTx: input.perTx }), ...(input.daily && { daily: input.daily }), ...(input.monthly && { monthly: input.monthly }) }); }
    return { success: true, limits: LIMITS[input.tier] };
  }),
  getAllTiers: protectedProcedure.query(async () => Object.entries(LIMITS).map(([tier, limits]) => ({ tier, ...limits }))),
  getStats: protectedProcedure.query(async () => ({ tiers: 3, breachesToday: 12, breachesThisMonth: 145, avgUtilization: "67%" })),
});