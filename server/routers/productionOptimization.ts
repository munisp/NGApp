import { TRPCError } from "@trpc/server";
/**
 * productionOptimization.ts
 * Arps decline curve analysis, EUR forecasting, and setpoint advisor.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { declineCurveParams, productionRecords, wells } from "../../drizzle/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── Arps Decline Curve Math ──────────────────────────────────────────────────

/**
 * Arps exponential decline: q(t) = qi * exp(-Di * t)
 * Arps hyperbolic decline:  q(t) = qi / (1 + b * Di * t)^(1/b)
 * Arps harmonic decline:    q(t) = qi / (1 + Di * t)   [b=1 special case]
 */
function arpsRate(qi: number, di: number, b: number, t: number): number {
  if (b === 0) {
    // Exponential
    return qi * Math.exp(-di * t);
  } else if (Math.abs(b - 1) < 1e-6) {
    // Harmonic
    return qi / (1 + di * t);
  } else {
    // Hyperbolic
    return qi / Math.pow(1 + b * di * t, 1 / b);
  }
}

/**
 * EUR calculation: integrate Arps rate from t=0 until rate hits economic limit.
 * Returns { eurBbls, remainingLifeYears, forecastPoints }
 */
function calculateEUR(
  qi: number,
  di: number,
  b: number,
  economicLimit: number,
  maxYears = 30
): { eurBbls: number; remainingLifeYears: number; forecastPoints: Array<{ year: number; rate: number; cumulative: number }> } {
  const dt = 1 / 12; // monthly steps
  let cumulative = 0;
  let t = 0;
  const forecastPoints: Array<{ year: number; rate: number; cumulative: number }> = [];

  while (t <= maxYears) {
    const rate = arpsRate(qi, di, b, t);
    if (rate < economicLimit) break;
    cumulative += rate * dt * 365; // BBL/year * years = BBL
    if (Math.abs(t * 12 - Math.round(t * 12)) < 0.01) {
      // Record at each month boundary
      forecastPoints.push({
        year: Math.round(t * 10) / 10,
        rate: Math.round(rate * 10) / 10,
        cumulative: Math.round(cumulative),
      });
    }
    t += dt;
  }

  return {
    eurBbls: Math.round(cumulative),
    remainingLifeYears: Math.round(t * 10) / 10,
    forecastPoints: forecastPoints.filter((_, i) => i % 3 === 0).slice(0, 120), // quarterly, max 10 years
  };
}

/**
 * Fit Arps parameters from production history using least-squares on log-rate.
 * Returns best-fit qi, Di (annual), b.
 */
function fitDeclineCurve(
  rates: number[],
  curveType: "EXPONENTIAL" | "HYPERBOLIC" | "HARMONIC"
): { qi: number; di: number; b: number; r2: number } {
  if (rates.length < 3) {
    return { qi: rates[0] ?? 100, di: 0.3, b: curveType === "HYPERBOLIC" ? 0.5 : curveType === "HARMONIC" ? 1 : 0, r2: 0 };
  }

  const qi = rates[0];
  const b = curveType === "EXPONENTIAL" ? 0 : curveType === "HARMONIC" ? 1 : 0.5;

  // Fit Di using linear regression on log(q) vs time for exponential
  // For simplicity, use two-point method: Di = -ln(q_last/q_first) / t_last
  const validRates = rates.filter(r => r > 0);
  if (validRates.length < 2) return { qi, di: 0.3, b, r2: 0 };

  const tLast = (validRates.length - 1) / 12; // years
  let di: number;

  if (b === 0) {
    di = -Math.log(validRates[validRates.length - 1] / validRates[0]) / Math.max(tLast, 0.001);
  } else if (b === 1) {
    di = (validRates[0] / validRates[validRates.length - 1] - 1) / Math.max(tLast, 0.001);
  } else {
    // Hyperbolic approximation
    di = (Math.pow(validRates[0] / validRates[validRates.length - 1], b) - 1) / (b * Math.max(tLast, 0.001));
  }

  di = Math.max(0.01, Math.min(di, 5)); // clamp to reasonable range

  // Calculate R²
  const predicted = validRates.map((_, i) => arpsRate(qi, di, b, i / 12));
  const mean = validRates.reduce((a, b) => a + b, 0) / validRates.length;
  const ssTot = validRates.reduce((a, r) => a + Math.pow(r - mean, 2), 0);
  const ssRes = validRates.reduce((a, r, i) => a + Math.pow(r - predicted[i], 2), 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { qi, di: Math.round(di * 1000) / 1000, b, r2: Math.round(r2 * 1000) / 1000 };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const productionOptimizationRouter = router({
  /**
   * List all saved decline curve parameters.
   */
  listCurves: protectedProcedure
    .input(z.object({ wellId: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = input.wellId ? [eq(declineCurveParams.wellId, input.wellId)] : [];
      return db.select().from(declineCurveParams)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(declineCurveParams.fittedAt))
        .limit(input.limit);
    }),

  /**
   * Fit Arps decline curve to a well's production history and save params.
   */
  fitCurve: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      curveType: z.enum(["EXPONENTIAL", "HYPERBOLIC", "HARMONIC"]).default("EXPONENTIAL"),
      economicLimit: z.number().default(5),
      notes: z.string().optional(),
      // Optional: override with manual params instead of fitting
      manualQi: z.number().optional(),
      manualDi: z.number().optional(),
      manualB: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch last 24 months of production
      const since = new Date();
      since.setMonth(since.getMonth() - 24);
      const records = await db.select().from(productionRecords)
        .where(and(eq(productionRecords.wellId, input.wellId), gte(productionRecords.date, since)))
        .orderBy(productionRecords.date);

      let qi: number, di: number, b: number, r2: number;

      if (input.manualQi !== undefined && input.manualDi !== undefined) {
        qi = input.manualQi;
        di = input.manualDi;
        b = input.manualB ?? (input.curveType === "HYPERBOLIC" ? 0.5 : input.curveType === "HARMONIC" ? 1 : 0);
        r2 = 0;
      } else if (records.length >= 3) {
        const oilRates = records.map(r => r.oilBbls ?? 0);
        const fit = fitDeclineCurve(oilRates, input.curveType);
        qi = fit.qi;
        di = fit.di;
        b = fit.b;
        r2 = fit.r2;
      } else {
        // Fallback defaults
        qi = 500;
        di = 0.3;
        b = input.curveType === "HYPERBOLIC" ? 0.5 : input.curveType === "HARMONIC" ? 1 : 0;
        r2 = 0;
      }

      const { eurBbls, remainingLifeYears } = calculateEUR(qi, di, b, input.economicLimit);

      const [row] = await db.insert(declineCurveParams).values({
        wellId: input.wellId,
        curveType: input.curveType,
        qi,
        di,
        b,
        economicLimit: input.economicLimit,
        eurBbls,
        remainingLifeYears,
        createdBy: ctx.user.name ?? ctx.user.openId,
        notes: input.notes,
        fittedAt: new Date(),
      }).returning();

      return { ...row, r2 };
    }),

  /**
   * Generate forecast points for a given set of decline curve parameters.
   */
  forecast: protectedProcedure
    .input(z.object({
      qi: z.number(),
      di: z.number(),
      b: z.number().default(0),
      economicLimit: z.number().default(5),
      curveType: z.enum(["EXPONENTIAL", "HYPERBOLIC", "HARMONIC"]).default("EXPONENTIAL"),
    }))
    .query(({ input }) => {
      const { eurBbls, remainingLifeYears, forecastPoints } = calculateEUR(
        input.qi, input.di, input.b, input.economicLimit
      );
      return { eurBbls, remainingLifeYears, forecastPoints };
    }),

  /**
   * EUR summary for all wells with saved decline curves.
   */
  eurSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const curves = await db.select().from(declineCurveParams)
      .orderBy(desc(declineCurveParams.fittedAt));

    // Deduplicate: keep latest per well
    const wellMap = new Map<string, typeof curves[0]>();
    curves.forEach(c => {
      if (!wellMap.has(c.wellId)) wellMap.set(c.wellId, c);
    });

    const wellList = await db.select().from(wells).limit(200);
    const wellNameMap = new Map(wellList.map(w => [w.wellId, w.name]));

    return Array.from(wellMap.values()).map(c => ({
      wellId: c.wellId,
      wellName: wellNameMap.get(c.wellId) ?? c.wellId,
      curveType: c.curveType,
      qi: c.qi,
      di: c.di,
      b: c.b,
      eurBbls: c.eurBbls ?? 0,
      remainingLifeYears: c.remainingLifeYears ?? 0,
      economicLimit: c.economicLimit ?? 5,
      fittedAt: c.fittedAt,
    }));
  }),

  /**
   * Choke/pump setpoint advisor based on simplified IPR/VLP intersection.
   * Uses Vogel's IPR model and a simplified VLP correlation.
   */
  setpointAdvisor: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      reservoirPressure: z.number().describe("psi"),
      bubblePointPressure: z.number().describe("psi"),
      maxOilRate: z.number().describe("BBL/day at zero BHP"),
      currentBhp: z.number().optional().describe("psi"),
      tubeId: z.number().default(2.441).describe("inches"),
      fluidGravity: z.number().default(0.85).describe("specific gravity"),
    }))
    .query(({ input }) => {
      const { reservoirPressure: pr, bubblePointPressure: pb, maxOilRate: qmax } = input;

      // Vogel IPR: q/qmax = 1 - 0.2*(pwf/pr) - 0.8*(pwf/pr)^2
      const iprPoints: Array<{ bhp: number; rate: number }> = [];
      for (let bhp = 0; bhp <= pr; bhp += pr / 20) {
        const ratio = bhp / pr;
        const q = qmax * (1 - 0.2 * ratio - 0.8 * ratio * ratio);
        iprPoints.push({ bhp: Math.round(bhp), rate: Math.round(Math.max(0, q)) });
      }

      // Simplified VLP: linear approximation (BHP increases with rate)
      // BHP_wellhead ≈ reservoir_pressure * 0.3 + rate * 0.5 (simplified)
      const vlpPoints: Array<{ bhp: number; rate: number }> = [];
      for (let rate = 0; rate <= qmax; rate += qmax / 20) {
        const bhp = pr * 0.25 + rate * 0.6;
        vlpPoints.push({ bhp: Math.round(bhp), rate: Math.round(rate) });
      }

      // Find AOF (Absolute Open Flow) — rate at BHP = 0
      const aof = qmax;

      // Find optimal operating point: intersection of IPR and VLP
      // Solve: qmax*(1 - 0.2*p/pr - 0.8*(p/pr)^2) = (p - pr*0.25) / 0.6
      let optimalRate = qmax * 0.6; // default 60% of AOF
      let optimalBhp = pr * 0.4;
      let minDiff = Infinity;
      for (let p = 0; p <= pr; p += pr / 100) {
        const iprQ = qmax * (1 - 0.2 * (p / pr) - 0.8 * Math.pow(p / pr, 2));
        const vlpQ = (p - pr * 0.25) / 0.6;
        const diff = Math.abs(iprQ - vlpQ);
        if (diff < minDiff && iprQ > 0 && vlpQ > 0) {
          minDiff = diff;
          optimalRate = Math.round(iprQ);
          optimalBhp = Math.round(p);
        }
      }

      // Choke recommendation: optimal rate / max rate * 100%
      const chokePosition = Math.round((optimalRate / Math.max(qmax, 1)) * 100);
      // ESP frequency: scale 30-60 Hz based on optimal rate
      const espFrequency = Math.round(30 + (optimalRate / Math.max(qmax, 1)) * 30);

      return {
        iprPoints,
        vlpPoints,
        aof,
        optimalRate,
        optimalBhp,
        recommendations: {
          chokePosition: `${chokePosition}%`,
          espFrequency: `${espFrequency} Hz`,
          targetBhp: `${optimalBhp} psi`,
          rationale: `Optimal operating point at ${optimalRate} BBL/day (${chokePosition}% of AOF). BHP target ${optimalBhp} psi balances productivity with reservoir energy conservation.`,
        },
      };
    }),

  /**
   * Auto-fit Arps decline curve from the last N days of production history.
   * Queries productionRecords for the given well, extracts daily oil rates,
   * and runs least-squares fitting for the requested curve type.
   */
  fitFromHistory: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      curveType: z.enum(["EXPONENTIAL", "HYPERBOLIC", "HARMONIC"]).default("EXPONENTIAL"),
      lookbackDays: z.number().default(90),
      economicLimit: z.number().default(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const since = new Date(Date.now() - input.lookbackDays * 86400000);

      // Query production records using the correct column names from schema
      const records = await db.select({
        date: productionRecords.date,
        oilBbls: productionRecords.oilBbls,
      })
        .from(productionRecords)
        .where(and(
          eq(productionRecords.wellId, input.wellId),
          gte(productionRecords.date, since)
        ))
        .orderBy(productionRecords.date);

      if (records.length < 3) {
        throw new Error(`Insufficient history: only ${records.length} records found for well ${input.wellId} in the last ${input.lookbackDays} days. Need at least 3.`);
      }

      // Use oilBbls as daily production proxy
      const rates = records
        .map(r => r.oilBbls ?? 0)
        .filter(r => r > 0);

      if (rates.length < 3) {
        throw new Error(`Insufficient non-zero production data: only ${rates.length} valid rate points found.`);
      }

      const { qi, di, b, r2 } = fitDeclineCurve(rates, input.curveType);
      const { eurBbls, remainingLifeYears } = calculateEUR(qi, di, b, input.economicLimit);

      const [row] = await db.insert(declineCurveParams).values({
        wellId: input.wellId,
        curveType: input.curveType,
        qi,
        di,
        b,
        economicLimit: input.economicLimit,
        eurBbls,
        remainingLifeYears,
        createdBy: ctx.user.name ?? ctx.user.openId,
        notes: `Auto-fitted from ${rates.length} production records (last ${input.lookbackDays}d). R²=${r2}`,
        fittedAt: new Date(),
      }).returning();

      return {
        id: row.id,
        wellId: input.wellId,
        curveType: input.curveType,
        qi,
        di,
        b,
        r2,
        eurBbls,
        remainingLifeYears,
        dataPoints: rates.length,
        lookbackDays: input.lookbackDays,
        message: `Fitted from ${rates.length} data points over ${input.lookbackDays} days. R²=${r2}. EUR: ${eurBbls.toLocaleString()} BBL.`,
      };
    }),

  /**
   * Delete a saved decline curve.
   */
  deleteCurve: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(declineCurveParams).where(eq(declineCurveParams.id, input.id));
      return { success: true };
    }),

  /**
   * Portfolio EUR comparison — runs Arps fit for every active well that has
   * sufficient production history, returns wells ranked by remaining EUR.
   * Used by the multi-well comparison chart.
   */
  portfolioEUR: protectedProcedure
    .input(z.object({
      lookbackDays: z.number().default(90),
      economicLimit: z.number().default(5),
      limit: z.number().default(30),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all active wells
      const activeWells = await db.select({
        wellId: wells.wellId,
        name: wells.name,
        field: wells.field,
        status: wells.status,
      })
        .from(wells)
        .where(eq(wells.status, "ACTIVE"))
        .limit(input.limit);

      const since = new Date(Date.now() - input.lookbackDays * 86400000);

      const results: Array<{
        wellId: string;
        wellName: string;
        field: string;
        eurBbls: number;
        remainingLifeYears: number;
        qi: number;
        di: number;
        r2: number;
        dataPoints: number;
        workoversRecommended: boolean;
      }> = [];

      for (const well of activeWells) {
        try {
          const records = await db.select({ oilBbls: productionRecords.oilBbls })
            .from(productionRecords)
            .where(and(
              eq(productionRecords.wellId, well.wellId),
              gte(productionRecords.date, since)
            ))
            .orderBy(productionRecords.date);

          const rates = records.map(r => r.oilBbls ?? 0).filter(r => r > 0);
          if (rates.length < 3) continue;

          const { qi, di, b, r2 } = fitDeclineCurve(rates, "EXPONENTIAL");
          const { eurBbls, remainingLifeYears } = calculateEUR(qi, di, b, input.economicLimit);

          results.push({
            wellId: well.wellId,
            wellName: well.name,
            field: well.field,
            eurBbls,
            remainingLifeYears,
            qi,
            di,
            r2,
            dataPoints: rates.length,
            // Flag wells with high decline rate (>15%/month) or low remaining life (<1yr)
            workoversRecommended: di > 0.15 || remainingLifeYears < 1,
          });
        } catch {
          // Skip wells with insufficient or noisy data
        }
      }

      // Sort by EUR descending (highest reserves first)
      return results.sort((a, b) => b.eurBbls - a.eurBbls);
    }),
});
