/**
 * productionForecasting.ts — Arps decline curve analysis, P10/P50/P90 Monte Carlo, EUR
 * References:
 *   - Arps J.J. (1945) "Analysis of Decline Curves" Trans. AIME 160:228-247
 *   - Fetkovich M.J. (1980) "Decline Curve Analysis Using Type Curves"
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productionForecasts } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Arps decline rate calculation ──────────────────────────────────────────
function arpsRate(qi: number, di: number, b: number, t: number): number {
  if (b === 0) return qi * Math.exp(-di * t);            // exponential
  if (b === 1) return qi / (1 + di * t);                 // harmonic
  return qi / Math.pow(1 + b * di * t, 1 / b);          // hyperbolic
}

function arpsEur(qi: number, di: number, b: number, tMax: number, qAbandonment = 1): number {
  // Numerical integration of Arps rate over time
  let eur = 0;
  const dt = tMax / 3650; // daily steps
  for (let t = 0; t < tMax; t += dt) {
    const q = arpsRate(qi, di, b, t);
    if (q < qAbandonment) break;
    eur += q * dt;
  }
  return eur;
}

// ─── Monte Carlo EUR simulation ──────────────────────────────────────────────
function monteCarloEur(
  qiMean: number, qiStd: number,
  diMean: number, diStd: number,
  bMean: number, bStd: number,
  years: number, iterations = 500
): { p10: number; p50: number; p90: number; mean: number } {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random(); const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
    const qi = Math.max(1, qiMean + qiStd * z0);
    const di = Math.max(0.001, diMean + diStd * z1);
    const b = Math.max(0, Math.min(1, bMean + bStd * z2));
    results.push(arpsEur(qi, di, b, years * 365));
  }
  results.sort((a, b) => a - b);
  return {
    p10: results[Math.floor(results.length * 0.90)],
    p50: results[Math.floor(results.length * 0.50)],
    p90: results[Math.floor(results.length * 0.10)],
    mean: results.reduce((s, v) => s + v, 0) / results.length,
  };
}

export const productionForecastingRouter = router({
  // List forecasts for a well
  list: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(productionForecasts)
        .where(eq(productionForecasts.wellId, input.wellId))
        .orderBy(desc(productionForecasts.createdAt));
    }),

  // Compute Arps decline curve + Monte Carlo EUR
  compute: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      forecastName: z.string().default("New Forecast"),
      declineType: z.enum(["exponential", "hyperbolic", "harmonic"]).default("exponential"),
      initialRateBopd: z.number().positive(),
      declineRateMonthly: z.number().min(0.001).max(0.99),
      bFactor: z.number().min(0).max(1).default(0),
      forecastYears: z.number().int().min(1).max(50).default(10),
      oilPriceUsdPerBbl: z.number().default(70),
      operatingCostUsdPerBbl: z.number().default(15),
      discountRatePct: z.number().default(10),
      // Monte Carlo uncertainty inputs
      qiUncertaintyPct: z.number().default(20),
      diUncertaintyPct: z.number().default(30),
      bUncertaintyAbs: z.number().default(0.1),
      save: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const diDaily = input.declineRateMonthly / 30.44; // convert monthly to daily

      // Build annual forecast profile
      const annualProfile: { year: number; rateBopd: number; cumulativeBbl: number; revenueMUsd: number; npvContribMUsd: number }[] = [];
      let cumulative = 0;
      let npv10 = 0;
      const discountDaily = input.discountRatePct / 100 / 365;

      for (let year = 1; year <= input.forecastYears; year++) {
        let yearlyProd = 0;
        let yearlyNpv = 0;
        for (let day = (year - 1) * 365; day < year * 365; day++) {
          const rate = arpsRate(input.initialRateBopd, diDaily, input.bFactor, day);
          const netCashflow = rate * (input.oilPriceUsdPerBbl - input.operatingCostUsdPerBbl);
          yearlyProd += rate;
          yearlyNpv += netCashflow / Math.pow(1 + discountDaily, day);
        }
        cumulative += yearlyProd;
        npv10 += yearlyNpv;
        annualProfile.push({
          year,
          rateBopd: Math.round(arpsRate(input.initialRateBopd, diDaily, input.bFactor, (year - 0.5) * 365)),
          cumulativeBbl: Math.round(cumulative),
          revenueMUsd: Math.round(yearlyProd * input.oilPriceUsdPerBbl / 1e6 * 100) / 100,
          npvContribMUsd: Math.round(yearlyNpv / 1e6 * 100) / 100,
        });
      }

      // EUR (total recoverable over forecast period)
      const eurBbl = Math.round(cumulative);

      // Monte Carlo P10/P50/P90
      const mc = monteCarloEur(
        input.initialRateBopd, input.initialRateBopd * input.qiUncertaintyPct / 100,
        diDaily, diDaily * input.diUncertaintyPct / 100,
        input.bFactor, input.bUncertaintyAbs,
        input.forecastYears
      );

      const result = {
        wellId: input.wellId,
        forecastName: input.forecastName,
        declineType: input.declineType,
        initialRateBopd: input.initialRateBopd,
        declineRateMonthly: input.declineRateMonthly,
        bFactor: input.bFactor,
        forecastYears: input.forecastYears,
        eurBbl,
        p10EurBbl: Math.round(mc.p10),
        p50EurBbl: Math.round(mc.p50),
        p90EurBbl: Math.round(mc.p90),
        meanEurBbl: Math.round(mc.mean),
        npv10M: Math.round(npv10 / 1e6 * 10) / 10,
        annualProfile,
        model: `Arps ${input.declineType} decline (b=${input.bFactor}), Di=${(input.declineRateMonthly * 100).toFixed(1)}%/month`,
      };

      if (input.save) {
        const db = await getDb();
        if (db) {
          await db.insert(productionForecasts).values({
            wellId: input.wellId,
            forecastName: input.forecastName,
            declineType: input.declineType,
            initialRateBopd: input.initialRateBopd,
            declineRateMonthly: input.declineRateMonthly,
            bFactor: input.bFactor,
            forecastYears: input.forecastYears,
            eurBbl,
            p10EurBbl: mc.p10,
            p50EurBbl: mc.p50,
            p90EurBbl: mc.p90,
            oilPriceUsdPerBbl: input.oilPriceUsdPerBbl,
            npv10M: npv10 / 1e6,
            createdBy: ctx.user.openId,
          });
        }
      }

      return result;
    }),

  // Delete a forecast
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(productionForecasts).where(eq(productionForecasts.id, input.id));
      return { success: true };
    }),
});
