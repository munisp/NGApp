/**
 * Trexm Co-Creation Routers (v35.0)
 * Covers all 6 upstream focus area gaps:
 *   1. Geomechanics / Wellbore Stability (1D MEM + Mud Weight Window)
 *   2. Oil-Based Mud (OBM) Management
 *   3. Sand Production Management
 *   4. Produced Water Management
 *   5. Heavy Oil / Thermal EOR
 *   6. Gas Well Liquid Loading (Turner Model)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { withCache, cacheKey, TTL } from "../cache";
import {
  geomechanicalModels,
  mudInventory,
  mudTransactions,
  sandProductionRecords,
  producedWaterRecords,
  heavyOilParameters,
  liquidLoadingEvents,
} from "../../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

// ─── Physics helpers ──────────────────────────────────────────────────────────

function overburdenGradient(avgBulkDensityGcc: number): number {
  return avgBulkDensityGcc * 8.345;
}

function shminGradient(obgPpg: number, ppgPpg: number, poissonRatio: number, biotCoeff: number): number {
  const nu = poissonRatio;
  const alpha = biotCoeff;
  return (nu / (1 - nu)) * (obgPpg - alpha * ppgPpg) + alpha * ppgPpg;
}

function fractureGradient(obgPpg: number, ppgPpg: number, poissonRatio: number): number {
  const nu = poissonRatio;
  return (nu / (1 - nu)) * (obgPpg - ppgPpg) + ppgPpg;
}

function collapseGradient(obgPpg: number, ppgPpg: number, ucsPsi: number, frictionAngleDeg: number, tvdFt: number): number {
  const phi = (frictionAngleDeg * Math.PI) / 180;
  const N = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
  const collapsePsi = (obgPpg * 0.052 * tvdFt) / N - ucsPsi / N;
  return collapsePsi / (0.052 * tvdFt);
}

function turnerCriticalVelocity(pressurePsia: number, tempF: number, tubingIdIn: number): { criticalVelocityFps: number; criticalRateMscfd: number } {
  const tempR = tempF + 459.67;
  const gasGravity = 0.65;
  const zFactor = 0.9;
  const rhoGas = (pressurePsia * gasGravity * 28.97) / (zFactor * 10.73 * tempR);
  const rhoLiquid = 67.0;
  const surfaceTension = 60.0;
  const vc = 5.62 * Math.pow((surfaceTension * (rhoLiquid - rhoGas)) / (rhoGas * rhoGas), 0.25);
  const tubingAreaFt2 = Math.PI * Math.pow(tubingIdIn / 24, 2);
  const qcMscfd = (vc * tubingAreaFt2 * pressurePsia * 86400) / (zFactor * tempR * 14.7 * 1000);
  return { criticalVelocityFps: vc, criticalRateMscfd: qcMscfd };
}

function heavyOilViscosity(apiGravity: number, tempF: number): number {
  const x = Math.pow(10, 3.0324 - 0.02023 * apiGravity) * Math.pow(tempF, -1.163);
  return Math.pow(10, x) - 1;
}

function sandOnsetDrawdown(ucsPsi: number, frictionAngleDeg: number, porosityFraction: number): number {
  const phi = (frictionAngleDeg * Math.PI) / 180;
  const cohesion = ucsPsi / (2 * Math.sqrt((1 + Math.sin(phi)) / (1 - Math.sin(phi))));
  return cohesion * 2 * (1 - porosityFraction);
}

// ─── 1. Geomechanics Router ──────────────────────────────────────────────────

export const geomechanicsRouter = router({
  list: protectedProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const key = cacheKey("trexm", "geomech_list", { well: input.wellId });
      return withCache(key, TTL.TREXM, async () => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        if (input.wellId) {
          return db.select().from(geomechanicalModels)
            .where(eq(geomechanicalModels.wellId, input.wellId))
            .orderBy(desc(geomechanicalModels.createdAt));
        }
        return db.select().from(geomechanicalModels).orderBy(desc(geomechanicalModels.createdAt));
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [model] = await db.select().from(geomechanicalModels)
        .where(eq(geomechanicalModels.id, input.id));
      return model ?? null;
    }),

  compute: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      tvdFt: z.number(),
      avgBulkDensityGcc: z.number().default(2.3),
      normalPpGradientPpg: z.number().default(8.6),
      eatonExponent: z.number().default(3.0),
      lotPressurePpg: z.number().optional(),
      ucsPsi: z.number().default(3000),
      frictionAngleDeg: z.number().default(30),
      biotCoefficient: z.number().default(0.8),
      poissonRatio: z.number().default(0.25),
      inclinationDeg: z.number().default(0),
      azimuthDeg: z.number().default(0),
      currentMudWeightPpg: z.number(),
      stressRegime: z.enum(["NORMAL_FAULTING", "STRIKE_SLIP", "THRUST_FAULTING"]).default("NORMAL_FAULTING"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const obg = overburdenGradient(input.avgBulkDensityGcc);
      const ppg = input.normalPpGradientPpg;
      const shmin = shminGradient(obg, ppg, input.poissonRatio, input.biotCoefficient);
      const fg = fractureGradient(obg, ppg, input.poissonRatio);
      const cg = collapseGradient(obg, ppg, input.ucsPsi, input.frictionAngleDeg, input.tvdFt);
      const mwLower = cg;
      const mwUpper = input.lotPressurePpg ? input.lotPressurePpg * 0.95 : fg * 0.95;
      const windowWidth = mwUpper - mwLower;
      const mw = input.currentMudWeightPpg;

      let mudWeightStatus: "OPTIMAL" | "NEAR_COLLAPSE_LIMIT" | "NEAR_FRACTURE_LIMIT" | "BELOW_COLLAPSE" | "ABOVE_FRACTURE";
      if (mw < cg) mudWeightStatus = "BELOW_COLLAPSE";
      else if (mw > fg) mudWeightStatus = "ABOVE_FRACTURE";
      else if (mw < cg + 0.3) mudWeightStatus = "NEAR_COLLAPSE_LIMIT";
      else if (mw > fg - 0.3) mudWeightStatus = "NEAR_FRACTURE_LIMIT";
      else mudWeightStatus = "OPTIMAL";

      let stabilityRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      if (mudWeightStatus === "BELOW_COLLAPSE" || mudWeightStatus === "ABOVE_FRACTURE") stabilityRisk = "CRITICAL";
      else if (mudWeightStatus.includes("NEAR")) stabilityRisk = "HIGH";
      else if (windowWidth < 0.5) stabilityRisk = "MEDIUM";
      else stabilityRisk = "LOW";

      const recommendedMw = (mwLower + mwUpper) / 2;

      const [saved] = await db.insert(geomechanicalModels).values({
        ...input,
        overburdenGradientPpg: obg,
        shminGradientPpg: shmin,
        fractureGradientPpg: fg,
        collapseGradientPpg: cg,
        mwLowerPpg: mwLower,
        mwUpperPpg: mwUpper,
        mwWindowWidthPpg: windowWidth,
        mudWeightStatus,
        stabilityRisk,
        recommendedMwPpg: recommendedMw,
        computedAt: new Date(),
        createdBy: ctx.user?.name ?? "system",
      }).returning();

      return saved;
    }),

  stressProfile: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async () => {
      const depths = Array.from({ length: 20 }, (_, i) => (i + 1) * 500);
      return depths.map((depth) => {
        const obg = 2.3 * 8.345;
        const ppg = 8.6 + depth * 0.0002;
        const fg = fractureGradient(obg, ppg, 0.25);
        const cg = collapseGradient(obg, ppg, 3000, 30, depth);
        return {
          depthFt: depth,
          overburdenPpg: obg,
          porePressurePpg: ppg,
          shminPpg: shminGradient(obg, ppg, 0.25, 0.8),
          fractureGradientPpg: fg,
          collapseGradientPpg: cg,
        };
      });
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const models = await db.select().from(geomechanicalModels);
    const critical = models.filter((m) => m.stabilityRisk === "CRITICAL").length;
    const high = models.filter((m) => m.stabilityRisk === "HIGH").length;
    const avgWindow = models.reduce((s, m) => s + (m.mwWindowWidthPpg ?? 0), 0) / (models.length || 1);
    return { total: models.length, critical, high, avgWindowWidthPpg: avgWindow };
  }),
});

// ─── 2. Mud Management Router ────────────────────────────────────────────────

export const mudManagementRouter = router({
  listInventory: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(mudInventory).orderBy(desc(mudInventory.updatedAt));
  }),

  upsertInventory: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      locationId: z.string(),
      locationName: z.string(),
      mudType: z.enum(["OBM", "SBM", "WBM", "BRINE"]),
      mudGrade: z.string().optional(),
      currentVolumeBbl: z.number().default(0),
      maxCapacityBbl: z.number(),
      reorderPointBbl: z.number().optional(),
      costPerBblUsd: z.number().optional(),
      supplierName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.id) {
        const [updated] = await db.update(mudInventory)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(mudInventory.id, input.id))
          .returning();
        return updated;
      }
      const [created] = await db.insert(mudInventory).values(input).returning();
      return created;
    }),

  recordTransaction: protectedProcedure
    .input(z.object({
      inventoryId: z.number(),
      transactionType: z.enum(["RECEIVED", "CONSUMED", "TRANSFERRED", "DISPOSED", "RETURNED"]),
      volumeBbl: z.number(),
      costUsd: z.number().optional(),
      wellId: z.string().optional(),
      fromLocationId: z.string().optional(),
      toLocationId: z.string().optional(),
      referenceNumber: z.string().optional(),
      performedBy: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [txn] = await db.insert(mudTransactions).values(input).returning();
      const delta = (input.transactionType === "RECEIVED" || input.transactionType === "RETURNED")
        ? input.volumeBbl
        : -input.volumeBbl;
      await db.update(mudInventory)
        .set({ currentVolumeBbl: sql`current_volume_bbl + ${delta}`, updatedAt: new Date() })
        .where(eq(mudInventory.id, input.inventoryId));
      return txn;
    }),

  listTransactions: protectedProcedure
    .input(z.object({ inventoryId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(mudTransactions)
        .where(eq(mudTransactions.inventoryId, input.inventoryId))
        .orderBy(desc(mudTransactions.transactionAt));
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const inventory = await db.select().from(mudInventory);
    const totalCostUsd = inventory.reduce((s, i) => s + (i.currentVolumeBbl ?? 0) * (i.costPerBblUsd ?? 0), 0);
    const lowStock = inventory.filter((i) => i.reorderPointBbl != null && i.currentVolumeBbl <= (i.reorderPointBbl ?? 0));
    const obmVolume = inventory.filter((i) => i.mudType === "OBM").reduce((s, i) => s + (i.currentVolumeBbl ?? 0), 0);
    return { totalItems: inventory.length, totalCostUsd, lowStockAlerts: lowStock.length, obmVolumeBbl: obmVolume };
  }),
});

// ─── 3. Sand Production Router ───────────────────────────────────────────────

export const sandManagementRouter = router({
  list: protectedProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.wellId) {
        return db.select().from(sandProductionRecords)
          .where(eq(sandProductionRecords.wellId, input.wellId))
          .orderBy(desc(sandProductionRecords.recordedAt));
      }
      return db.select().from(sandProductionRecords)
        .orderBy(desc(sandProductionRecords.recordedAt)).limit(100);
    }),

  analyze: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      drawdownPsi: z.number(),
      flowRateBpd: z.number(),
      waterCut: z.number().default(0),
      sandRateMgL: z.number().optional(),
      ucsPsi: z.number().default(2500),
      frictionAngleDeg: z.number().default(28),
      porosityFraction: z.number().default(0.22),
      sandControlMethod: z.enum(["NONE", "CHOKEBACK", "GRAVEL_PACK", "FRAC_PACK", "EXPANDABLE_SAND_SCREEN", "STANDALONE_SCREEN", "CHEMICAL_CONSOLIDATION"]).default("NONE"),
      completionType: z.enum(["OPEN_HOLE", "CASED_PERFORATED", "GRAVEL_PACK", "FRAC_PACK", "EXPANDABLE_SAND_SCREEN", "STANDALONE_SCREEN"]).default("CASED_PERFORATED"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const criticalDrawdown = sandOnsetDrawdown(input.ucsPsi, input.frictionAngleDeg, input.porosityFraction);
      const safetyMargin = criticalDrawdown - input.drawdownPsi;
      let sandRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
      if (safetyMargin < 0) sandRisk = "CRITICAL";
      else if (safetyMargin < criticalDrawdown * 0.1) sandRisk = "HIGH";
      else if (safetyMargin < criticalDrawdown * 0.25) sandRisk = "MODERATE";
      else sandRisk = "LOW";

      const [record] = await db.insert(sandProductionRecords).values({
        wellId: input.wellId,
        recordedAt: new Date(),
        sandRateMgL: input.sandRateMgL,
        drawdownPsi: input.drawdownPsi,
        flowRateBpd: input.flowRateBpd,
        waterCut: input.waterCut,
        sandRisk,
        criticalDrawdownPsi: criticalDrawdown,
        safetyMarginPsi: safetyMargin,
        sandControlMethod: input.sandControlMethod,
        completionType: input.completionType,
        ucsPsi: input.ucsPsi,
        notes: input.notes,
      }).returning();

      return { ...record, criticalDrawdownPsi: criticalDrawdown, safetyMarginPsi: safetyMargin };
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const records = await db.select().from(sandProductionRecords)
      .orderBy(desc(sandProductionRecords.recordedAt)).limit(500);
    const critical = records.filter((r) => r.sandRisk === "CRITICAL").length;
    const high = records.filter((r) => r.sandRisk === "HIGH").length;
    const withSand = records.filter((r) => r.sandRateMgL != null);
    const avgSandRate = withSand.reduce((s, r) => s + (r.sandRateMgL ?? 0), 0) / (withSand.length || 1);
    return { totalRecords: records.length, criticalWells: critical, highRiskWells: high, avgSandRateMgL: avgSandRate };
  }),
});

// ─── 4. Produced Water Router ────────────────────────────────────────────────

export const producedWaterRouter = router({
  list: protectedProcedure
    .input(z.object({ fieldId: z.string().optional(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const since = new Date(Date.now() - input.days * 86400000);
      if (input.fieldId) {
        return db.select().from(producedWaterRecords)
          .where(and(eq(producedWaterRecords.fieldId, input.fieldId), gte(producedWaterRecords.recordDate, since)))
          .orderBy(desc(producedWaterRecords.recordDate));
      }
      return db.select().from(producedWaterRecords)
        .where(gte(producedWaterRecords.recordDate, since))
        .orderBy(desc(producedWaterRecords.recordDate));
    }),

  record: protectedProcedure
    .input(z.object({
      fieldId: z.string(),
      recordDate: z.date().optional(),
      producedWaterBbl: z.number(),
      injectedWaterBbl: z.number().default(0),
      disposedWaterBbl: z.number().default(0),
      recycledWaterBbl: z.number().default(0),
      evaporatedWaterBbl: z.number().default(0),
      oilInWaterMgL: z.number().optional(),
      tssMgL: z.number().optional(),
      bacteriaCountCfuMl: z.number().optional(),
      phValue: z.number().optional(),
      chlorideMgL: z.number().optional(),
      treatmentCostUsd: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const balance = input.producedWaterBbl - input.injectedWaterBbl - input.disposedWaterBbl - input.recycledWaterBbl - input.evaporatedWaterBbl;
      let waterQualityStatus: "COMPLIANT" | "MARGINAL" | "NON_COMPLIANT" = "COMPLIANT";
      if (input.oilInWaterMgL && input.oilInWaterMgL > 29) waterQualityStatus = "NON_COMPLIANT";
      else if (input.oilInWaterMgL && input.oilInWaterMgL > 15) waterQualityStatus = "MARGINAL";
      const injectionEfficiency = input.producedWaterBbl > 0 ? (input.injectedWaterBbl / input.producedWaterBbl) * 100 : 0;
      const recyclingRate = input.producedWaterBbl > 0 ? (input.recycledWaterBbl / input.producedWaterBbl) * 100 : 0;
      let environmentalRisk = "LOW";
      if (waterQualityStatus === "NON_COMPLIANT" || Math.abs(balance) > 500) environmentalRisk = "HIGH";
      else if (waterQualityStatus === "MARGINAL") environmentalRisk = "MEDIUM";

      const [record] = await db.insert(producedWaterRecords).values({
        ...input,
        recordDate: input.recordDate ?? new Date(),
        waterBalanceBbl: balance,
        balanceStatus: balance > 50 ? "SURPLUS" : balance < -50 ? "DEFICIT" : "BALANCED",
        waterQualityStatus,
        injectionEfficiencyPct: injectionEfficiency,
        recyclingRatePct: recyclingRate,
        environmentalRisk,
      }).returning();

      return record;
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const since = new Date(Date.now() - 30 * 86400000);
    const records = await db.select().from(producedWaterRecords)
      .where(gte(producedWaterRecords.recordDate, since));
    const totalProduced = records.reduce((s, r) => s + (r.producedWaterBbl ?? 0), 0);
    const totalInjected = records.reduce((s, r) => s + (r.injectedWaterBbl ?? 0), 0);
    const totalRecycled = records.reduce((s, r) => s + (r.recycledWaterBbl ?? 0), 0);
    const nonCompliant = records.filter((r) => r.waterQualityStatus === "NON_COMPLIANT").length;
    const avgRecyclingRate = records.reduce((s, r) => s + (r.recyclingRatePct ?? 0), 0) / (records.length || 1);
    return {
      totalProducedBbl: totalProduced,
      totalInjectedBbl: totalInjected,
      totalRecycledBbl: totalRecycled,
      injectionEfficiencyPct: totalProduced > 0 ? (totalInjected / totalProduced) * 100 : 0,
      avgRecyclingRatePct: avgRecyclingRate,
      nonCompliantDays: nonCompliant,
      recordCount: records.length,
    };
  }),
});

// ─── 5. Heavy Oil Router ─────────────────────────────────────────────────────

export const heavyOilRouter = router({
  list: protectedProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.wellId) {
        return db.select().from(heavyOilParameters)
          .where(eq(heavyOilParameters.wellId, input.wellId))
          .orderBy(desc(heavyOilParameters.updatedAt));
      }
      return db.select().from(heavyOilParameters).orderBy(desc(heavyOilParameters.updatedAt));
    }),

  analyze: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      apiGravity: z.number(),
      reservoirTempF: z.number(),
      currentRateBpd: z.number().optional(),
      waterCut: z.number().default(0),
      steamInjectionCweBpd: z.number().default(0),
      steamQuality: z.number().default(0.8),
      gorScfPerBbl: z.number().default(50),
      netPayFt: z.number().optional(),
      porosityFraction: z.number().optional(),
      eorMethod: z.enum(["PRIMARY_DEPLETION", "WATER_FLOOD", "POLYMER_FLOOD", "STEAM_FLOOD", "CYCLIC_STEAM_STIMULATION", "SAGD", "IN_SITU_COMBUSTION", "SOLVENT_INJECTION"]).default("PRIMARY_DEPLETION"),
      steamCostUsdPerBblCwe: z.number().default(8.0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const viscosityCp = heavyOilViscosity(input.apiGravity, input.reservoirTempF);

      let recommendedEor: "PRIMARY_DEPLETION" | "WATER_FLOOD" | "POLYMER_FLOOD" | "STEAM_FLOOD" | "CYCLIC_STEAM_STIMULATION" | "SAGD" | "IN_SITU_COMBUSTION" | "SOLVENT_INJECTION";
      let projectedUpliftPct: number;
      let sor: number;
      let thermalEfficiency: number;

      if (input.apiGravity < 10) {
        recommendedEor = "SAGD"; projectedUpliftPct = 120; sor = 3.5; thermalEfficiency = 55;
      } else if (input.apiGravity < 15) {
        recommendedEor = "CYCLIC_STEAM_STIMULATION"; projectedUpliftPct = 80; sor = 5.0; thermalEfficiency = 45;
      } else if (input.apiGravity < 20) {
        recommendedEor = "STEAM_FLOOD"; projectedUpliftPct = 60; sor = 6.5; thermalEfficiency = 40;
      } else {
        recommendedEor = "POLYMER_FLOOD"; projectedUpliftPct = 25; sor = 0; thermalEfficiency = 0;
      }

      const currentRate = input.currentRateBpd ?? 100;
      const upliftRate = currentRate * (projectedUpliftPct / 100);
      const steamCost = sor * upliftRate * 365 * input.steamCostUsdPerBblCwe;
      const oilRevenue = upliftRate * 365 * 60;
      const netBenefit = oilRevenue - steamCost;

      const [saved] = await db.insert(heavyOilParameters).values({
        ...input,
        currentViscosityCp: viscosityCp,
        recommendedEorMethod: recommendedEor,
        projectedRateUpliftPct: projectedUpliftPct,
        steamToOilRatio: sor,
        thermalEfficiencyPct: thermalEfficiency,
        netBenefitUsdPerYear: netBenefit,
        computedAt: new Date(),
      }).returning();

      return saved;
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const params = await db.select().from(heavyOilParameters);
    const sagdCandidates = params.filter((p) => p.recommendedEorMethod === "SAGD").length;
    const cssCandidates = params.filter((p) => p.recommendedEorMethod === "CYCLIC_STEAM_STIMULATION").length;
    const totalNetBenefit = params.reduce((s, p) => s + (p.netBenefitUsdPerYear ?? 0), 0);
    return { totalWells: params.length, sagdCandidates, cssCandidates, totalNetBenefitUsdPerYear: totalNetBenefit };
  }),

  // Butler SAGD Steam Chamber Growth Simulation
  // SAGD Sensitivity Analysis — parameter sweep tornado chart
  sagdSensitivity: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      baseReservoirThicknessM: z.number().default(20),
      baseReservoirLengthM: z.number().default(500),
      basePorosity: z.number().default(0.32),
      baseOilSaturation: z.number().default(0.75),
      baseOilViscosityMpa: z.number().default(100000),
      baseReservoirTempC: z.number().default(10),
      baseSteamTempC: z.number().default(220),
      baseSteamRateTonnesPerDay: z.number().default(200),
      baseOilPriceUsdPerBbl: z.number().default(70),
      baseSteamCostUsdPerTonne: z.number().default(25),
      simulationYears: z.number().int().min(1).max(30).default(10),
    }))
    .query(async ({ input }) => {
      // Run Butler SAGD model for base case and ±20% perturbations on each parameter
      const calcNpv = (h: number, L: number, phi: number, So: number, mu: number, Tr: number, Ts: number, qSteam: number, oilP: number, steamC: number): number => {
        const viscRatio = mu / Math.max(1, 0.5 * Math.exp(-0.03 * (Ts - Tr)));
        const alpha = 0.0864; // thermal diffusivity m2/day
        const latentHeat = 2000; // kJ/kg steam latent heat at ~220C
        const oilDensityKgM3 = 920;
        const m = (phi * So * oilDensityKgM3 * Math.sqrt(alpha)) / (2 * Math.sqrt(Math.PI) * oilDensityKgM3);
        const peakRateM3Day = m * L * Math.sqrt(Math.max(0, Ts - Tr)) / Math.sqrt(365);
        const peakRateBpd = peakRateM3Day * 6.2898;
        let totalOilBbl = 0; let totalSteamT = 0; let npv = 0;
        const discountRate = 0.10 / 365;
        for (let day = 1; day <= input.simulationYears * 365; day++) {
          const rateDecline = Math.exp(-0.001 * day);
          const dailyOil = peakRateBpd * rateDecline;
          const dailySteam = qSteam * (1 + 0.3 * rateDecline);
          const dailyCashflow = dailyOil * oilP - dailySteam * steamC;
          npv += dailyCashflow / Math.pow(1 + discountRate, day);
          totalOilBbl += dailyOil; totalSteamT += dailySteam;
        }
        return npv;
      };

      const base = calcNpv(
        input.baseReservoirThicknessM, input.baseReservoirLengthM,
        input.basePorosity, input.baseOilSaturation, input.baseOilViscosityMpa,
        input.baseReservoirTempC, input.baseSteamTempC, input.baseSteamRateTonnesPerDay,
        input.baseOilPriceUsdPerBbl, input.baseSteamCostUsdPerTonne
      );

      const params = [
        { name: "Reservoir Thickness (m)", key: "h", baseVal: input.baseReservoirThicknessM, unit: "m" },
        { name: "Well Pair Length (m)", key: "L", baseVal: input.baseReservoirLengthM, unit: "m" },
        { name: "Porosity", key: "phi", baseVal: input.basePorosity, unit: "" },
        { name: "Oil Saturation", key: "So", baseVal: input.baseOilSaturation, unit: "" },
        { name: "Oil Viscosity (mPa.s)", key: "mu", baseVal: input.baseOilViscosityMpa, unit: "mPa.s" },
        { name: "Steam Temp (°C)", key: "Ts", baseVal: input.baseSteamTempC, unit: "°C" },
        { name: "Steam Rate (t/day)", key: "qSteam", baseVal: input.baseSteamRateTonnesPerDay, unit: "t/d" },
        { name: "Oil Price ($/bbl)", key: "oilP", baseVal: input.baseOilPriceUsdPerBbl, unit: "$/bbl" },
        { name: "Steam Cost ($/t)", key: "steamC", baseVal: input.baseSteamCostUsdPerTonne, unit: "$/t" },
      ];

      const tornado = params.map((p) => {
        const lo = p.baseVal * 0.80; const hi = p.baseVal * 1.20;
        const args = (v: number) => [
          p.key === "h" ? v : input.baseReservoirThicknessM,
          p.key === "L" ? v : input.baseReservoirLengthM,
          p.key === "phi" ? v : input.basePorosity,
          p.key === "So" ? v : input.baseOilSaturation,
          p.key === "mu" ? v : input.baseOilViscosityMpa,
          input.baseReservoirTempC,
          p.key === "Ts" ? v : input.baseSteamTempC,
          p.key === "qSteam" ? v : input.baseSteamRateTonnesPerDay,
          p.key === "oilP" ? v : input.baseOilPriceUsdPerBbl,
          p.key === "steamC" ? v : input.baseSteamCostUsdPerTonne,
        ] as [number, number, number, number, number, number, number, number, number, number];
        const npvLo = calcNpv(...args(lo));
        const npvHi = calcNpv(...args(hi));
        return {
          parameter: p.name,
          baseValue: p.baseVal,
          lowValue: Math.round(lo * 100) / 100,
          highValue: Math.round(hi * 100) / 100,
          unit: p.unit,
          npvLow: Math.round(npvLo / 1e6 * 10) / 10,
          npvHigh: Math.round(npvHi / 1e6 * 10) / 10,
          npvSwing: Math.round(Math.abs(npvHi - npvLo) / 1e6 * 10) / 10,
          sensitivity: Math.round(Math.abs(npvHi - npvLo) / Math.max(Math.abs(base), 1) * 100 * 10) / 10,
        };
      }).sort((a, b) => b.npvSwing - a.npvSwing);

      return {
        wellId: input.wellId,
        baseNpv10M: Math.round(base / 1e6 * 10) / 10,
        tornado,
        topDriver: tornado[0]?.parameter ?? "Unknown",
        model: "Butler (1985) SAGD sensitivity ±20% parameter sweep",
      };
    }),

  sagdSimulation: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      reservoirThicknessM: z.number().default(20).describe("Net pay thickness (m)"),
      reservoirLengthM: z.number().default(500).describe("Well pair length (m)"),
      porosity: z.number().default(0.32).describe("Effective porosity (fraction)"),
      oilSaturation: z.number().default(0.75).describe("Initial oil saturation (fraction)"),
      oilViscosityMpa: z.number().default(100000).describe("Cold oil viscosity (mPa.s)"),
      reservoirTempC: z.number().default(10).describe("Initial reservoir temperature (°C)"),
      steamTempC: z.number().default(220).describe("Steam temperature (°C)"),
      thermalDiffusivityM2Day: z.number().default(0.0864).describe("Thermal diffusivity (m²/day)"),
      steamInjectionRateTonnesPerDay: z.number().default(200).describe("Steam injection rate (tonnes/day)"),
      oilPriceUsdPerBbl: z.number().default(70),
      steamCostUsdPerTonne: z.number().default(25),
      simulationYears: z.number().int().min(1).max(30).default(10),
    }))
    .mutation(async ({ input }) => {
      // Butler SAGD model (Butler 1985, "Rise of interfacial area")
      // Reference: Butler R.M. (1985) A new approach to the modelling of steam-assisted gravity drainage.
      // JCPT 24(3): 42-51.

      const {
        reservoirThicknessM: h, reservoirLengthM: L, porosity: phi, oilSaturation: So,
        oilViscosityMpa: muCold, reservoirTempC: Ti, steamTempC: Ts,
        thermalDiffusivityM2Day: alpha, steamInjectionRateTonnesPerDay: qSteam,
        oilPriceUsdPerBbl, steamCostUsdPerTonne, simulationYears,
      } = input;

      // Viscosity at steam temperature (Beggs-Robinson)
      const x = Math.pow(10, 3.0324 - 0.02023 * 10) * Math.pow(Ts * 9/5 + 32, -1.163);
      const muSteam = Math.max(0.5, Math.pow(10, x) - 1);

      // Kinematic viscosity ratio
      const nuRatio = muCold / muSteam;

      // Butler drainage rate (m³/day per meter of well pair)
      // q = k * h * g * phi * So * sqrt(alpha / (nuSteam * m))
      // Simplified: use Butler's empirical constant m = 3 (triangular steam chamber)
      const m = 3;
      const g = 9.81 * 86400; // m/day² → m/day
      const k = 2e-12; // permeability ~2 Darcy in heavy oil sands (m²)
      const qButlerM3PerDayPerM = k * h * g * phi * So * Math.sqrt(alpha / (muSteam * 1e-3 * m));
      const qOilM3PerDay = qButlerM3PerDayPerM * L;
      const qOilBpdPerWellPair = qOilM3PerDay * 6.2898; // m³ → bbl

      // Steam-to-oil ratio (SOR)
      const steamDensityTonnesPerM3 = 0.85; // at ~220°C
      const qSteamM3PerDay = qSteam / steamDensityTonnesPerM3;
      const sor = qSteamM3PerDay / Math.max(qOilM3PerDay, 0.001);

      // Annual production profile (steam chamber growth over time)
      const yearlyProfile = Array.from({ length: simulationYears }, (_, yr) => {
        const year = yr + 1;
        // Steam chamber grows as sqrt(time) — Butler's parabolic growth
        const chamberGrowthFactor = Math.min(1.0, Math.sqrt(year / 3));
        // Production peaks at year 3-5, then declines as chamber reaches boundaries
        const declineFactor = year <= 3 ? chamberGrowthFactor : Math.pow(0.92, year - 3);
        const annualOilBbl = qOilBpdPerWellPair * 365 * declineFactor;
        const annualSteamTonnes = qSteam * 365 * declineFactor;
        const oilRevenue = annualOilBbl * oilPriceUsdPerBbl;
        const steamCost = annualSteamTonnes * steamCostUsdPerTonne;
        const netCashflow = oilRevenue - steamCost;
        return {
          year,
          oilRateBpd: Math.round(qOilBpdPerWellPair * declineFactor),
          cumulativeOilBbl: Math.round(annualOilBbl * year * 0.7), // approximate cumulative
          steamInjectionTpd: Math.round(qSteam * declineFactor),
          sor: Math.round(sor * 10) / 10,
          oilRevenueUsd: Math.round(oilRevenue),
          steamCostUsd: Math.round(steamCost),
          netCashflowUsd: Math.round(netCashflow),
        };
      });

      const totalOilBbl = yearlyProfile.reduce((s, y) => s + y.oilRateBpd * 365, 0);
      const totalRevenue = yearlyProfile.reduce((s, y) => s + y.oilRevenueUsd, 0);
      const totalSteamCost = yearlyProfile.reduce((s, y) => s + y.steamCostUsd, 0);
      const npv10 = yearlyProfile.reduce((s, y, i) => s + y.netCashflowUsd / Math.pow(1.1, i + 1), 0);

      return {
        wellId: input.wellId,
        model: "Butler SAGD (1985)",
        peakOilRateBpd: Math.round(qOilBpdPerWellPair),
        steamToOilRatio: Math.round(sor * 10) / 10,
        viscosityRatio: Math.round(nuRatio),
        steamChamberGrowthModel: "Parabolic (sqrt-time)",
        totalOilBbl10yr: Math.round(totalOilBbl),
        totalRevenueUsd: Math.round(totalRevenue),
        totalSteamCostUsd: Math.round(totalSteamCost),
        npv10Usd: Math.round(npv10),
        yearlyProfile,
        recommendation: sor < 3 ? "Excellent SAGD candidate — low SOR indicates efficient steam utilization"
          : sor < 5 ? "Good SAGD candidate — moderate SOR, consider steam quality optimization"
          : "High SOR — evaluate CSS or solvent co-injection to improve thermal efficiency",
      };
    }),
});
// ─── 6. Liquid Loading Routerr ────────────────────────────────────────────────

export const liquidLoadingRouter = router({
  list: protectedProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.wellId) {
        return db.select().from(liquidLoadingEvents)
          .where(eq(liquidLoadingEvents.wellId, input.wellId))
          .orderBy(desc(liquidLoadingEvents.detectedAt));
      }
      return db.select().from(liquidLoadingEvents)
        .orderBy(desc(liquidLoadingEvents.detectedAt)).limit(100);
    }),

  analyze: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      wellheadPressurePsia: z.number(),
      wellheadTempF: z.number(),
      gasRateMscfd: z.number(),
      tubingIdIn: z.number().default(2.441),
      declineRateMscfdPerDay: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { criticalVelocityFps, criticalRateMscfd } = turnerCriticalVelocity(
        input.wellheadPressurePsia, input.wellheadTempF, input.tubingIdIn
      );

      const tempR = input.wellheadTempF + 459.67;
      const zFactor = 0.9;
      const tubingAreaFt2 = Math.PI * Math.pow(input.tubingIdIn / 24, 2);
      const actualVelocityFps = (input.gasRateMscfd * 1000 * zFactor * tempR * 14.7) /
        (input.wellheadPressurePsia * 86400 * tubingAreaFt2);
      const velocityRatio = actualVelocityFps / criticalVelocityFps;

      let loadingStatus: "UNLOADED" | "AT_RISK" | "LOADING" | "SEVERE_LOADING";
      let urgency: string;
      let remediationMethod: "PLUNGER_LIFT" | "VELOCITY_STRING" | "FOAM_INJECTION" | "GAS_LIFT" | "COMPRESSION" | "WELLBORE_CLEANOUT" | undefined;

      if (velocityRatio >= 1.0) {
        loadingStatus = "UNLOADED"; urgency = "NONE"; remediationMethod = undefined;
      } else if (velocityRatio >= 0.75) {
        loadingStatus = "AT_RISK"; urgency = "MONITOR"; remediationMethod = "FOAM_INJECTION";
      } else if (velocityRatio >= 0.5) {
        loadingStatus = "LOADING"; urgency = "HIGH"; remediationMethod = "PLUNGER_LIFT";
      } else {
        loadingStatus = "SEVERE_LOADING"; urgency = "CRITICAL"; remediationMethod = "VELOCITY_STRING";
      }

      const daysToLoading = (input.declineRateMscfdPerDay && input.declineRateMscfdPerDay > 0)
        ? (input.gasRateMscfd - criticalRateMscfd) / input.declineRateMscfdPerDay
        : undefined;

      const [event] = await db.insert(liquidLoadingEvents).values({
        wellId: input.wellId,
        detectedAt: new Date(),
        wellheadPressurePsia: input.wellheadPressurePsia,
        wellheadTempF: input.wellheadTempF,
        gasRateMscfd: input.gasRateMscfd,
        tubingIdIn: input.tubingIdIn,
        criticalVelocityFps,
        actualVelocityFps,
        criticalRateMscfd,
        velocityRatio,
        loadingStatus,
        daysToLoading,
        declineRateMscfdPerDay: input.declineRateMscfdPerDay,
        remediationMethod,
        urgency,
        notes: input.notes,
      }).returning();

      return event;
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    const events = await db.select().from(liquidLoadingEvents)
      .orderBy(desc(liquidLoadingEvents.detectedAt)).limit(500);
    const latestByWell = new Map<string, typeof events[0]>();
    for (const e of events) {
      if (!latestByWell.has(e.wellId)) latestByWell.set(e.wellId, e);
    }
    const latest = Array.from(latestByWell.values());
    const critical = latest.filter((e) => e.loadingStatus === "SEVERE_LOADING").length;
    const loading = latest.filter((e) => e.loadingStatus === "LOADING").length;
    const atRisk = latest.filter((e) => e.loadingStatus === "AT_RISK").length;
    const avgVelocityRatio = latest.reduce((s, e) => s + (e.velocityRatio ?? 0), 0) / (latest.length || 1);
    return { totalWellsMonitored: latest.length, severeLoading: critical, loading, atRisk, avgVelocityRatio };
  }),

  // Plunger Lift Sizing (Foss & Gaul model)
  plungerLiftSizing: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      casingPressurePsia: z.number(),
      tubingPressurePsia: z.number(),
      tubingIdIn: z.number().default(2.441),
      wellDepthFt: z.number(),
      liquidColumnHeightFt: z.number(),
      gasRateMscfd: z.number(),
      liquidRateBpd: z.number(),
      plungerWeightLbs: z.number().default(0.5),
    }))
    .mutation(async ({ input }) => {
      const tubingAreaIn2 = Math.PI * Math.pow(input.tubingIdIn / 2, 2);
      const liquidGradientPsiPerFt = 0.433;
      const liquidSlugPressure = input.liquidColumnHeightFt * liquidGradientPsiPerFt;
      const plungerPressure = input.plungerWeightLbs / tubingAreaIn2;
      const minCasingPressure = liquidSlugPressure + plungerPressure + input.tubingPressurePsia;
      const availableDifferential = input.casingPressurePsia - input.tubingPressurePsia;
      const riseVelocityFtMin = availableDifferential > 0 ? Math.min(1000, 200 + availableDifferential * 0.5) : 0;
      const riseTimeMins = input.wellDepthFt / Math.max(riseVelocityFtMin, 1);
      const fallTimeMins = input.wellDepthFt / 300;
      const cycleTimeMins = riseTimeMins + fallTimeMins + 5;
      const liquidPerCycleBbl = (input.liquidRateBpd / 1440) * cycleTimeMins;
      const cyclesPerDay = 1440 / cycleTimeMins;
      const isFeasible = input.casingPressurePsia >= minCasingPressure * 0.9;
      let plungerType = "Solid Bar";
      if (input.liquidRateBpd > 50) plungerType = "Pad Plunger";
      if (input.gasRateMscfd < 100) plungerType = "Bypass Plunger";
      return {
        wellId: input.wellId,
        isFeasible,
        minCasingPressurePsia: Math.round(minCasingPressure),
        availableDifferentialPsia: Math.round(availableDifferential),
        riseVelocityFtMin: Math.round(riseVelocityFtMin),
        riseTimeMins: Math.round(riseTimeMins * 10) / 10,
        fallTimeMins: Math.round(fallTimeMins * 10) / 10,
        cycleTimeMins: Math.round(cycleTimeMins * 10) / 10,
        cyclesPerDay: Math.round(cyclesPerDay * 10) / 10,
        liquidPerCycleBbl: Math.round(liquidPerCycleBbl * 100) / 100,
        recommendedPlungerType: plungerType,
        recommendation: isFeasible
          ? `Install ${plungerType} plunger. Target ${Math.round(cyclesPerDay)} cycles/day at ${Math.round(riseVelocityFtMin)} ft/min rise velocity.`
          : `Insufficient casing pressure. Need ${Math.round(minCasingPressure)} psia, have ${Math.round(input.casingPressurePsia)} psia. Consider foam injection or compression first.`,
        model: "Foss & Gaul (1965)",
      };
    }),

  // Velocity String Design (Turner critical velocity comparison)
  velocityStringDesign: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      currentTubingIdIn: z.number(),
      gasRateMscfd: z.number(),
      wellheadPressurePsia: z.number(),
      wellheadTempF: z.number(),
      wellDepthFt: z.number(),
    }))
    .query(async ({ input }) => {
      const tubingSizes = [
        { label: '1" (1.049" ID)', idIn: 1.049 },
        { label: '1-1/4" (1.380" ID)', idIn: 1.380 },
        { label: '1-1/2" (1.610" ID)', idIn: 1.610 },
        { label: '2" (1.995" ID)', idIn: 1.995 },
        { label: '2-3/8" (2.441" ID)', idIn: 2.441 },
      ];
      const results = tubingSizes.map((size) => {
        const areaFt2 = Math.PI * Math.pow(size.idIn / 24, 2);
        const tempR = input.wellheadTempF + 459.67;
        const zFactor = 0.9;
        const critVelFps = 5.62 * Math.pow(input.wellheadPressurePsia, 0.5) / Math.pow(zFactor * tempR, 0.25);
        const critRateMscfd = (critVelFps * areaFt2 * input.wellheadPressurePsia * 86400) / (zFactor * tempR * 14.7 * 1000);
        const velocityRatio = input.gasRateMscfd / Math.max(critRateMscfd, 0.001);
        return {
          tubingSize: size.label, idIn: size.idIn,
          criticalVelocityFps: Math.round(critVelFps * 100) / 100,
          criticalRateMscfd: Math.round(critRateMscfd * 10) / 10,
          velocityRatio: Math.round(velocityRatio * 100) / 100,
          status: velocityRatio >= 1.0 ? "UNLOADED" : velocityRatio >= 0.75 ? "AT_RISK" : "LOADING",
          pressureDropPsi: Math.round((0.001 * input.wellDepthFt * 0.433 * (size.idIn / input.currentTubingIdIn)) * 10) / 10,
        };
      });
      const optimal = results.find((r) => r.status === "UNLOADED") || results[results.length - 1];
      return {
        wellId: input.wellId,
        currentTubingIdIn: input.currentTubingIdIn,
        currentGasRateMscfd: input.gasRateMscfd,
        tubingSizeComparison: results,
        recommendedSize: optimal.tubingSize,
        recommendedIdIn: optimal.idIn,
        expectedVelocityRatio: optimal.velocityRatio,
        installationNote: optimal.idIn < input.currentTubingIdIn
          ? `Install ${optimal.tubingSize} velocity string inside existing ${input.currentTubingIdIn}" tubing. This reduces flow area and increases gas velocity above Turner critical threshold.`
          : `Current tubing size is optimal. Consider foam injection or plunger lift instead.`,
        model: "Turner et al. (1969) critical velocity",
      };
    }),

  // Plunger Lift Cycle Optimizer — Foss & Gaul afterflow + buildup periods
  plungerLiftCycleOptimizer: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      wellDepthFt: z.number(),
      casingPressurePsia: z.number(),
      tubingPressurePsia: z.number(),
      linePressurePsia: z.number().default(100),
      liquidRateBpd: z.number(),
      gasRateMscfd: z.number(),
      tubingIdIn: z.number().default(2.441),
      plungerWeightLbs: z.number().default(0.5),
      targetCyclesPerDay: z.number().int().min(1).max(48).default(6),
    }))
    .query(async ({ input }) => {
      // Foss & Gaul (1965) plunger lift cycle time model
      // Reference: Foss D.L. & Gaul R.B. (1965) "Plunger-lift performance criteria with operating experience"
      const tubingAreaIn2 = Math.PI * Math.pow(input.tubingIdIn / 2, 2);
      const liquidGradPsiPerFt = 0.433;

      // Rise phase: plunger travels from bottom to surface
      const availableDiff = Math.max(0, input.casingPressurePsia - input.linePressurePsia);
      const riseVelocityFtMin = availableDiff > 0 ? Math.min(1200, 150 + availableDiff * 0.6) : 0;
      const riseTimeMins = riseVelocityFtMin > 0 ? input.wellDepthFt / riseVelocityFtMin : 999;

      // Afterflow phase: gas production after plunger surfaces
      const afterflowTimeMins = Math.max(2, (input.gasRateMscfd * 1000) / (input.casingPressurePsia * 0.5));

      // Buildup phase: casing pressure rebuilds
      const pressureDeficit = Math.max(0, input.tubingPressurePsia * 1.2 - input.casingPressurePsia);
      const buildupTimeMins = pressureDeficit > 0 ? pressureDeficit / (input.gasRateMscfd * 0.1 + 1) : 5;

      // Fall phase: plunger falls back to bottom
      const fallVelocityFtMin = 300; // typical fall velocity
      const fallTimeMins = input.wellDepthFt / fallVelocityFtMin;

      const totalCycleTimeMins = riseTimeMins + afterflowTimeMins + buildupTimeMins + fallTimeMins;
      const actualCyclesPerDay = 1440 / Math.max(totalCycleTimeMins, 1);
      const liquidPerCycleBbl = (input.liquidRateBpd / 1440) * totalCycleTimeMins;
      const gasPerCycleMscf = (input.gasRateMscfd / 1440) * totalCycleTimeMins;

      // Optimize: find optimal afterflow time to maximize gas while clearing liquid
      const minCasingPressure = (input.liquidRateBpd / 1440) * totalCycleTimeMins * liquidGradPsiPerFt * 0.1
        + input.plungerWeightLbs / tubingAreaIn2
        + input.linePressurePsia;

      const isFeasible = input.casingPressurePsia >= minCasingPressure * 0.85;

      // Build hourly cycle schedule for 24h
      const schedule: { hour: number; cycleStart: boolean; phase: string }[] = [];
      let minuteAccum = 0;
      for (let h = 0; h < 24; h++) {
        const minInHour = h * 60;
        const cycleNum = Math.floor(minInHour / totalCycleTimeMins);
        const posInCycle = minInHour % totalCycleTimeMins;
        let phase = "BUILDUP";
        if (posInCycle < riseTimeMins) phase = "RISE";
        else if (posInCycle < riseTimeMins + afterflowTimeMins) phase = "AFTERFLOW";
        else if (posInCycle < riseTimeMins + afterflowTimeMins + buildupTimeMins) phase = "BUILDUP";
        else phase = "FALL";
        schedule.push({ hour: h, cycleStart: posInCycle < 1, phase });
      }

      return {
        wellId: input.wellId,
        isFeasible,
        cycleBreakdown: {
          riseTimeMins: Math.round(riseTimeMins * 10) / 10,
          afterflowTimeMins: Math.round(afterflowTimeMins * 10) / 10,
          buildupTimeMins: Math.round(buildupTimeMins * 10) / 10,
          fallTimeMins: Math.round(fallTimeMins * 10) / 10,
          totalCycleTimeMins: Math.round(totalCycleTimeMins * 10) / 10,
        },
        performance: {
          actualCyclesPerDay: Math.round(actualCyclesPerDay * 10) / 10,
          liquidPerCycleBbl: Math.round(liquidPerCycleBbl * 100) / 100,
          gasPerCycleMscf: Math.round(gasPerCycleMscf * 100) / 100,
          riseVelocityFtMin: Math.round(riseVelocityFtMin),
          minCasingPressurePsia: Math.round(minCasingPressure),
        },
        dailySchedule: schedule,
        recommendation: isFeasible
          ? `Optimal: ${Math.round(actualCyclesPerDay)} cycles/day. Rise: ${Math.round(riseTimeMins)}min, Afterflow: ${Math.round(afterflowTimeMins)}min, Buildup: ${Math.round(buildupTimeMins)}min, Fall: ${Math.round(fallTimeMins)}min.`
          : `Insufficient casing pressure (${Math.round(input.casingPressurePsia)} psia < ${Math.round(minCasingPressure)} psia required). Increase compression or reduce liquid rate first.`,
        model: "Foss & Gaul (1965) cycle time model",
      };
    }),
});
