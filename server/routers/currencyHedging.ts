// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

interface HedgingPosition {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  notionalAmount: number;
  hedgeType: "forward" | "option" | "swap";
  strikeRate: number;
  maturityDate: string;
  status: "active" | "expired" | "exercised";
}

interface ExposureReport {
  currency: string;
  totalExposure: number;
  hedgedAmount: number;
  unhedgedAmount: number;
  hedgeRatio: number;
}

function calculateForwardRate(spotRate: number, domesticRate: number, foreignRate: number, daysToMaturity: number): number {
  const yearFraction = daysToMaturity / 365;
  return spotRate * Math.pow((1 + domesticRate) / (1 + foreignRate), yearFraction);
}

function calculateOptionPremium(spotRate: number, strikeRate: number, volatility: number, daysToMaturity: number): number {
  const timeToMaturity = daysToMaturity / 365;
  const intrinsicValue = Math.max(spotRate - strikeRate, 0);
  const timeValue = spotRate * volatility * Math.sqrt(timeToMaturity) * 0.4;
  return intrinsicValue + timeValue;
}

function assessExposure(positions: HedgingPosition[], totalExposure: number): ExposureReport[] {
  const byCurrency = new Map<string, { hedged: number; total: number }>();
  for (const pos of positions) {
    const key = pos.quoteCurrency;
    const current = byCurrency.get(key) || { hedged: 0, total: totalExposure };
    if (pos.status === "active") current.hedged += pos.notionalAmount;
    byCurrency.set(key, current);
  }
  return Array.from(byCurrency.entries()).map(([currency, data]) => ({
    currency,
    totalExposure: data.total,
    hedgedAmount: data.hedged,
    unhedgedAmount: data.total - data.hedged,
    hedgeRatio: data.hedged / Math.max(data.total, 1),
  }));
}

export const currencyHedgingRouter = router({
  createHedge: protectedProcedure
    .input(z.object({
      baseCurrency: z.string().length(3),
      quoteCurrency: z.string().length(3),
      notionalAmount: z.number().positive(),
      hedgeType: z.enum(["forward", "option", "swap"]),
      spotRate: z.number().positive(),
      daysToMaturity: z.number().min(1).max(365),
    }))
    .mutation(async ({ input }) => {
      const forwardRate = calculateForwardRate(input.spotRate, 0.12, 0.05, input.daysToMaturity);
      const premium = input.hedgeType === "option" ? calculateOptionPremium(input.spotRate, forwardRate, 0.15, input.daysToMaturity) : 0;
      return {
        id: `HEDGE-\${Date.now()}`,
        ...input,
        strikeRate: forwardRate,
        premium,
        maturityDate: new Date(Date.now() + input.daysToMaturity * 86400000).toISOString(),
        status: "active",
      };
    }),

  getExposure: protectedProcedure
    .input(z.object({ baseCurrency: z.string().default("KES") }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const result = await db.select({ total: sql<number>`COALESCE(sum(amount), 0)` }).from(transactions);
      const totalExposure = result[0]?.total || 0;
      return { baseCurrency: input.baseCurrency, totalExposure, hedgeRatio: 0.65, recommendations: totalExposure > 1000000 ? ["Consider increasing hedge ratio to 80%"] : [] };
    }),

  listPositions: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(transactions).limit(input.limit).orderBy(desc(transactions.createdAt));
      return { positions: rows.map(r => ({ id: r.id, status: "active" })), total: rows.length };
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
