/**
 * reservoirPressure.ts — Material balance, aquifer influx, pressure maintenance planning
 * References:
 *   - Havlena D. & Odeh A.S. (1963) "The Material Balance as an Equation of a Straight Line"
 *   - Craft B.C. & Hawkins M.F. (1959) Applied Petroleum Reservoir Engineering
 *   - van Everdingen A.F. & Hurst W. (1949) "The Application of the Laplace Transformation to Flow Problems in Reservoirs"
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { reservoirPressureRecords } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Material Balance Equation (simplified Havlena-Odeh) ─────────────────────
function materialBalance(params: {
  initialPressurePsia: number;
  currentPressurePsia: number;
  cumulativeOilBbl: number;
  cumulativeWaterBbl: number;
  cumulativeGasMscf: number;
  waterInfluxBbl: number;
  oilFvfRbPerStb: number;
  waterFvfRbPerStb: number;
  gasFvfRbPerMscf: number;
  solutionGorScfPerStb: number;
  totalCompressibilityPerPsi: number;
  poreVolumeBbl: number;
}): {
  f: number; // underground withdrawal
  eg: number; // gas expansion
  eo: number; // oil expansion
  ew: number; // water expansion + influx
  recoveryFactorPct: number;
  ooipBbl: number;
} {
  const { initialPressurePsia: pi, currentPressurePsia: p } = params;
  const dP = pi - p;

  // Underground withdrawal F
  const f = params.cumulativeOilBbl * params.oilFvfRbPerStb
    + params.cumulativeWaterBbl * params.waterFvfRbPerStb
    + params.cumulativeGasMscf * params.gasFvfRbPerMscf;

  // Oil + dissolved gas expansion Eo
  const eo = params.oilFvfRbPerStb - 1.0 + params.solutionGorScfPerStb * (params.gasFvfRbPerMscf - 1.0 / 1000);

  // Gas cap expansion Eg (simplified, no gas cap assumed)
  const eg = 0;

  // Water expansion + influx Ew
  const ew = params.waterInfluxBbl + params.poreVolumeBbl * params.totalCompressibilityPerPsi * dP;

  // OOIP estimate from Havlena-Odeh: N = (F - We) / Eo
  const ooipBbl = eo > 0 ? (f - params.waterInfluxBbl) / eo : 0;
  const recoveryFactorPct = ooipBbl > 0 ? (params.cumulativeOilBbl / ooipBbl) * 100 : 0;

  return {
    f: Math.round(f),
    eg: Math.round(eg),
    eo: Math.round(eo * 1000) / 1000,
    ew: Math.round(ew),
    recoveryFactorPct: Math.round(recoveryFactorPct * 10) / 10,
    ooipBbl: Math.round(ooipBbl),
  };
}

export const reservoirPressureRouter = router({
  // List pressure records for a field
  list: protectedProcedure
    .input(z.object({ fieldId: z.string().default("DEFAULT"), wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(reservoirPressureRecords)
        .where(eq(reservoirPressureRecords.fieldId, input.fieldId))
        .orderBy(desc(reservoirPressureRecords.recordDate));
    }),

  // Add pressure measurement
  addRecord: protectedProcedure
    .input(z.object({
      fieldId: z.string().default("DEFAULT"),
      wellId: z.string().optional(),
      recordDate: z.string(),
      measuredPressurePsia: z.number().positive(),
      measurementMethod: z.enum(["BHP", "RFT", "MDT", "DST", "STATIC"]).default("BHP"),
      depthFt: z.number().optional(),
      waterCutFrac: z.number().min(0).max(1).optional(),
      gasCap: z.boolean().default(false),
      aquiferStrength: z.enum(["NONE", "WEAK", "MODERATE", "STRONG"]).default("NONE"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [record] = await db.insert(reservoirPressureRecords).values({
        fieldId: input.fieldId,
        wellId: input.wellId,
        recordDate: new Date(input.recordDate),
        measuredPressurePsia: input.measuredPressurePsia,
        measurementMethod: input.measurementMethod,
        depthFt: input.depthFt,
        waterCutFrac: input.waterCutFrac,
        gasCap: input.gasCap,
        aquiferStrength: input.aquiferStrength,
        notes: input.notes,
      }).returning();
      return record;
    }),

  // Run material balance calculation
  materialBalance: protectedProcedure
    .input(z.object({
      fieldId: z.string().default("DEFAULT"),
      initialPressurePsia: z.number().positive().default(3500),
      currentPressurePsia: z.number().positive().default(2800),
      cumulativeOilMBbl: z.number().positive().default(5000),
      cumulativeWaterMBbl: z.number().default(500),
      cumulativeGasMmscf: z.number().default(2000),
      waterInfluxMBbl: z.number().default(0),
      oilFvfRbPerStb: z.number().default(1.25),
      waterFvfRbPerStb: z.number().default(1.02),
      gasFvfRbPerMscf: z.number().default(0.005),
      solutionGorScfPerStb: z.number().default(500),
      totalCompressibilityPerPsi: z.number().default(1.5e-5),
      poreVolumeMBbl: z.number().default(50000),
    }))
    .query(async ({ input }) => {
      const result = materialBalance({
        initialPressurePsia: input.initialPressurePsia,
        currentPressurePsia: input.currentPressurePsia,
        cumulativeOilBbl: input.cumulativeOilMBbl * 1000,
        cumulativeWaterBbl: input.cumulativeWaterMBbl * 1000,
        cumulativeGasMscf: input.cumulativeGasMmscf * 1000,
        waterInfluxBbl: input.waterInfluxMBbl * 1000,
        oilFvfRbPerStb: input.oilFvfRbPerStb,
        waterFvfRbPerStb: input.waterFvfRbPerStb,
        gasFvfRbPerMscf: input.gasFvfRbPerMscf,
        solutionGorScfPerStb: input.solutionGorScfPerStb,
        totalCompressibilityPerPsi: input.totalCompressibilityPerPsi,
        poreVolumeBbl: input.poreVolumeMBbl * 1000,
      });

      // Pressure maintenance recommendation
      const pressureDeclinePct = ((input.initialPressurePsia - input.currentPressurePsia) / input.initialPressurePsia) * 100;
      let maintenancePlan = "";
      if (pressureDeclinePct < 5) {
        maintenancePlan = "Reservoir pressure is well-maintained. Continue current injection rates.";
      } else if (pressureDeclinePct < 15) {
        maintenancePlan = `Moderate pressure decline (${pressureDeclinePct.toFixed(1)}%). Consider increasing water injection by 10-15% to maintain pressure above bubble point.`;
      } else if (pressureDeclinePct < 30) {
        maintenancePlan = `Significant pressure decline (${pressureDeclinePct.toFixed(1)}%). Initiate or expand water/gas injection program. Target voidage replacement ratio ≥ 1.0.`;
      } else {
        maintenancePlan = `Severe pressure depletion (${pressureDeclinePct.toFixed(1)}%). Immediate pressure maintenance required. Evaluate EOR options (WAG, polymer flood, CO2 injection).`;
      }

      // Aquifer influx estimate (van Everdingen-Hurst simplified)
      const aquiferInfluxMBbl = input.waterInfluxMBbl > 0
        ? input.waterInfluxMBbl
        : Math.round(pressureDeclinePct * input.poreVolumeMBbl * 0.001);

      return {
        fieldId: input.fieldId,
        pressureDeclinePct: Math.round(pressureDeclinePct * 10) / 10,
        ooipMMBbl: Math.round(result.ooipBbl / 1e6 * 10) / 10,
        recoveryFactorPct: result.recoveryFactorPct,
        undergroundWithdrawalMBbl: Math.round(result.f / 1000),
        aquiferInfluxEstimateMBbl: aquiferInfluxMBbl,
        voidageReplacementRatio: input.waterInfluxMBbl > 0
          ? Math.round((input.waterInfluxMBbl / input.cumulativeOilMBbl) * 100) / 100
          : 0,
        maintenancePlan,
        model: "Havlena-Odeh (1963) material balance",
      };
    }),

  // Pressure trend analysis
  pressureTrend: protectedProcedure
    .input(z.object({ fieldId: z.string().default("DEFAULT") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { trend: [], declineRatePsiPerYear: 0 };
      const records = await db.select().from(reservoirPressureRecords)
        .where(eq(reservoirPressureRecords.fieldId, input.fieldId))
        .orderBy(reservoirPressureRecords.recordDate);

      if (records.length < 2) return { trend: records, declineRatePsiPerYear: 0 };

      // Linear regression for decline rate
      const n = records.length;
      const xs = records.map((r, i) => i);
      const ys = records.map(r => r.measuredPressurePsia);
      const xMean = xs.reduce((s, v) => s + v, 0) / n;
      const yMean = ys.reduce((s, v) => s + v, 0) / n;
      const slope = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0)
        / xs.reduce((s, x) => s + Math.pow(x - xMean, 2), 0);

      // Estimate time between records in years
      const firstDate = new Date(records[0].recordDate).getTime();
      const lastDate = new Date(records[n - 1].recordDate).getTime();
      const totalYears = (lastDate - firstDate) / (365.25 * 24 * 3600 * 1000);
      const declineRatePsiPerYear = totalYears > 0 ? Math.round(slope * (n - 1) / totalYears * 10) / 10 : 0;

      return {
        trend: records.map(r => ({
          date: r.recordDate,
          pressurePsia: r.measuredPressurePsia,
          method: r.measurementMethod,
        })),
        declineRatePsiPerYear,
        totalYears: Math.round(totalYears * 10) / 10,
      };
    }),
});
