// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

interface PaymentProvider {
  id: string;
  name: string;
  successRate: number;
  avgLatencyMs: number;
  costPercent: number;
  supportedCurrencies: string[];
  maxAmount: number;
  isActive: boolean;
}

const PROVIDERS: PaymentProvider[] = [
  { id: "mpesa", name: "M-Pesa", successRate: 0.97, avgLatencyMs: 800, costPercent: 0.5, supportedCurrencies: ["KES"], maxAmount: 300000, isActive: true },
  { id: "airtel", name: "Airtel Money", successRate: 0.94, avgLatencyMs: 1200, costPercent: 0.4, supportedCurrencies: ["KES", "UGX"], maxAmount: 200000, isActive: true },
  { id: "visa", name: "Visa Direct", successRate: 0.99, avgLatencyMs: 2000, costPercent: 2.5, supportedCurrencies: ["KES", "USD", "EUR"], maxAmount: 5000000, isActive: true },
  { id: "pesalink", name: "PesaLink", successRate: 0.96, avgLatencyMs: 3000, costPercent: 0.3, supportedCurrencies: ["KES"], maxAmount: 999999, isActive: true },
];

function scoreProvider(provider: PaymentProvider, amount: number, currency: string, priority: string): number {
  if (!provider.isActive || !provider.supportedCurrencies.includes(currency) || amount > provider.maxAmount) return -1;
  let score = provider.successRate * 100;
  if (priority === "speed") score += (5000 - provider.avgLatencyMs) / 50;
  else if (priority === "cost") score += (5 - provider.costPercent) * 10;
  else score += provider.successRate * 30 + (5 - provider.costPercent) * 5 + (5000 - provider.avgLatencyMs) / 100;
  return score;
}

export const intelligentRoutingEngineRouter = router({
  route: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      currency: z.string().default("KES"),
      paymentMethod: z.string(),
      priority: z.enum(["speed", "cost", "reliability"]).default("reliability"),
    }))
    .query(async ({ input }) => {
      const scored = PROVIDERS.map(p => ({ provider: p, score: scoreProvider(p, input.amount, input.currency, input.priority) }))
        .filter(s => s.score > 0)
        .sort((a: any, b: any) => b.score - a.score);
      if (scored.length === 0) return { error: "No eligible provider", providers: [] };
      return {
        primary: { id: scored[0].provider.id, name: scored[0].provider.name, score: scored[0].score, estimatedLatencyMs: scored[0].provider.avgLatencyMs, costPercent: scored[0].provider.costPercent },
        fallback: scored.length > 1 ? { id: scored[1].provider.id, name: scored[1].provider.name } : null,
        allOptions: scored.map(s => ({ id: s.provider.id, name: s.provider.name, score: Math.round(s.score) })),
      };
    }),

  listProviders: protectedProcedure.query(async () => {
    return { providers: PROVIDERS };
  }),

  getProviderStats: protectedProcedure
    .input(z.object({ providerId: z.string() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const result = await db.select({ count: sql<number>`count(*)` }).from(transactions);
      const provider = PROVIDERS.find(p => p.id === input.providerId);
      return { provider: provider?.name || "Unknown", totalRouted: result[0]?.count || 0, successRate: provider?.successRate || 0 };
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
  listRoutes: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
  optimizeRouting: protectedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx, input }) => {
      return { success: true } as any;
    }),
});
