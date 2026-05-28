import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { withCache, cacheKey, TTL } from "../cache";
import {
  productionAllocationRules, wellAllocationFactors, allocatedProduction,
  reservoirSimulations, emissionSources, emissionRecords, carbonTargets,
  droneInspections, droneFindings,
  type ProductionAllocationRule, type ReservoirSimulation,
  type EmissionSource, type EmissionRecord, type DroneInspection, type DroneFinding,
} from "../../drizzle/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

export const operationsRouter = router({
  // ════════════════════════════════════════════════════════════════════════
  // Production Allocation Engine
  // ════════════════════════════════════════════════════════════════════════
  listAllocationRules: protectedProcedure
    .input(z.object({ fieldId: z.string().optional(), isActive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const key = cacheKey("operations", "allocationRules", { field: input?.fieldId, active: input?.isActive });
      return withCache(key, TTL.OPERATIONS, async () => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db.select().from(productionAllocationRules).orderBy(desc(productionAllocationRules.createdAt));
        let filtered: ProductionAllocationRule[] = rows;
        if (input?.fieldId) { const f = input.fieldId; filtered = filtered.filter((r: ProductionAllocationRule) => r.fieldId === f); }
        if (input?.isActive !== undefined) { const a = input.isActive; filtered = filtered.filter((r: ProductionAllocationRule) => r.isActive === a); }
        return filtered;
      });
    }),

  createAllocationRule: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      fieldId: z.string().min(1),
      separatorId: z.string().optional(),
      method: z.enum(["well_test_ratio", "meter_based", "simulation", "virtual_flow_meter"]).default("well_test_ratio"),
      oilAllocationBbl: z.number().optional(),
      gasAllocationMcf: z.number().optional(),
      waterAllocationBbl: z.number().optional(),
      effectiveFrom: z.date(),
      effectiveTo: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ruleId = `ALLOC-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(productionAllocationRules).values({
        ...input,
        ruleId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  setWellAllocationFactors: adminProcedure
    .input(z.object({
      ruleId: z.string(),
      factors: z.array(z.object({
        wellId: z.string(),
        oilFactor: z.number().min(0).max(1),
        gasFactor: z.number().min(0).max(1),
        waterFactor: z.number().min(0).max(1),
        basisType: z.string().default("well_test"),
        basisDate: z.date().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (const f of input.factors) {
        await db.insert(wellAllocationFactors).values({
          ruleId: input.ruleId,
          ...f,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return { success: true, count: input.factors.length };
    }),

  runAllocation: adminProcedure
    .input(z.object({
      ruleId: z.string(),
      allocationDate: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [rule] = await db.select().from(productionAllocationRules).where(eq(productionAllocationRules.ruleId, input.ruleId));
      if (!rule) throw new TRPCError({ code: "NOT_FOUND" });
      const factors = await db.select().from(wellAllocationFactors).where(eq(wellAllocationFactors.ruleId, input.ruleId));
      const allocated = [];
      for (const f of factors) {
        const [row] = await db.insert(allocatedProduction).values({
          allocationDate: input.allocationDate,
          wellId: f.wellId,
          ruleId: input.ruleId,
          allocatedOilBbl: (rule.oilAllocationBbl ?? 0) * f.oilFactor,
          allocatedGasMcf: (rule.gasAllocationMcf ?? 0) * f.gasFactor,
          allocatedWaterBbl: (rule.waterAllocationBbl ?? 0) * f.waterFactor,
          allocationMethod: rule.method,
          isFinalized: false,
          createdAt: new Date(),
        }).returning();
        allocated.push(row);
      }
      return { success: true, allocated };
    }),

  listAllocatedProduction: protectedProcedure
    .input(z.object({
      ruleId: z.string().optional(),
      wellId: z.string().optional(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
      limit: z.number().int().max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(allocatedProduction).orderBy(desc(allocatedProduction.allocationDate)).limit(input?.limit ?? 100);
      let filtered = rows;
      if (input?.ruleId) { const r = input.ruleId; filtered = filtered.filter(x => x.ruleId === r); }
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter(x => x.wellId === w); }
      return filtered;
    }),

  // ════════════════════════════════════════════════════════════════════════
  // Reservoir Simulation
  // ════════════════════════════════════════════════════════════════════════
  listSimulations: protectedProcedure
    .input(z.object({ status: z.string().optional(), fieldId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(reservoirSimulations).orderBy(desc(reservoirSimulations.submittedAt));
      let filtered: ReservoirSimulation[] = rows;
      if (input?.status) { const s = input.status; filtered = filtered.filter((r: ReservoirSimulation) => r.status === s); }
      if (input?.fieldId) { const f = input.fieldId; filtered = filtered.filter((r: ReservoirSimulation) => r.fieldId === f); }
      return filtered;
    }),

  submitSimulation: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      simulator: z.enum(["opm_flow", "eclipse", "intersect", "cmg_imex", "nexus"]).default("opm_flow"),
      fieldId: z.string().optional(),
      modelFile: z.string().optional(),
      cpuCores: z.number().int().min(1).max(128).default(4),
      memoryGb: z.number().int().min(1).max(512).default(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const simId = `SIM-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(reservoirSimulations).values({
        ...input,
        simId,
        status: "queued",
        submittedBy: ctx.user.openId,
        submittedAt: new Date(),
      }).returning();
      return row;
    }),

  updateSimulationStatus: adminProcedure
    .input(z.object({
      simId: z.string(),
      status: z.string(),
      startedAt: z.date().optional(),
      completedAt: z.date().optional(),
      durationSec: z.number().int().optional(),
      outputUrl: z.string().optional(),
      summaryStats: z.string().optional(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { simId, ...data } = input;
      const [row] = await db.update(reservoirSimulations)
        .set(data)
        .where(eq(reservoirSimulations.simId, simId))
        .returning();
      return row;
    }),

  // ════════════════════════════════════════════════════════════════════════
  // Emissions & Carbon Accounting
  // ════════════════════════════════════════════════════════════════════════
  listEmissionSources: protectedProcedure
    .input(z.object({ emissionScope: z.string().optional(), wellId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(emissionSources).orderBy(emissionSources.name);
      let filtered: EmissionSource[] = rows;
      if (input?.emissionScope) { const s = input.emissionScope; filtered = filtered.filter((r: EmissionSource) => r.emissionScope === s); }
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter((r: EmissionSource) => r.wellId === w); }
      return filtered;
    }),

  createEmissionSource: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      sourceType: z.string().min(1),
      wellId: z.string().optional(),
      facilityId: z.string().optional(),
      emissionScope: z.enum(["scope1", "scope2", "scope3"]).default("scope1"),
      ghgComponent: z.enum(["co2", "ch4", "n2o", "hfc", "pfc", "sf6"]).default("co2"),
      emissionFactor: z.number().optional(),
      emissionFactorUnit: z.string().optional(),
      emissionFactorSource: z.string().default("EPA_AP42"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const sourceId = `ES-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(emissionSources).values({
        ...input,
        sourceId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  createEmissionRecord: adminProcedure
    .input(z.object({
      sourceId: z.string(),
      reportingPeriodStart: z.date(),
      reportingPeriodEnd: z.date(),
      activityData: z.number(),
      activityUnit: z.string(),
      co2Tonnes: z.number().optional(),
      ch4Tonnes: z.number().optional(),
      n2oTonnes: z.number().optional(),
      co2eTonnes: z.number().optional(),
      calculationMethod: z.string().default("emission_factor"),
      reportingStandard: z.string().default("GHG_Protocol"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Auto-calculate CO2e if not provided
      const co2eTonnes = input.co2eTonnes ??
        ((input.co2Tonnes ?? 0) + (input.ch4Tonnes ?? 0) * 28 + (input.n2oTonnes ?? 0) * 265);
      const [row] = await db.insert(emissionRecords).values({
        ...input,
        co2eTonnes,
        verificationStatus: "unverified",
        createdAt: new Date(),
      }).returning();
      return row;
    }),

  listEmissionRecords: protectedProcedure
    .input(z.object({
      sourceId: z.string().optional(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
      verificationStatus: z.string().optional(),
      limit: z.number().int().max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(emissionRecords).orderBy(desc(emissionRecords.reportingPeriodStart)).limit(input?.limit ?? 100);
      let filtered: EmissionRecord[] = rows;
      if (input?.sourceId) { const s = input.sourceId; filtered = filtered.filter((r: EmissionRecord) => r.sourceId === s); }
      if (input?.verificationStatus) { const v = input.verificationStatus; filtered = filtered.filter((r: EmissionRecord) => r.verificationStatus === v); }
      return filtered;
    }),

  listCarbonTargets: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(carbonTargets).orderBy(carbonTargets.targetYear);
  }),

  createCarbonTarget: adminProcedure
    .input(z.object({
      targetYear: z.number().int().min(2024).max(2050),
      scope: z.string().min(1),
      baselineYear: z.number().int().default(2019),
      baselineCo2eTonnes: z.number().optional(),
      targetCo2eTonnes: z.number().optional(),
      reductionPercent: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(carbonTargets).values({
        ...input,
        status: "on_track",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  getEmissionsSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalCo2e: 0, byScope: {}, byGhg: {}, sourcesCount: 0 };
    const records = await db.select().from(emissionRecords);
    const sources = await db.select().from(emissionSources);
    let totalCo2e = 0;
    const byScope: Record<string, number> = {};
    const byGhg: Record<string, number> = {};
    for (const r of records) {
      totalCo2e += r.co2eTonnes ?? 0;
    }
    for (const s of sources) {
      byScope[s.emissionScope] = (byScope[s.emissionScope] || 0) + 1;
      byGhg[s.ghgComponent] = (byGhg[s.ghgComponent] || 0) + 1;
    }
    return { totalCo2e: Math.round(totalCo2e * 100) / 100, byScope, byGhg, sourcesCount: sources.length };
  }),

  // ════════════════════════════════════════════════════════════════════════
  // Drone Inspection Management
  // ════════════════════════════════════════════════════════════════════════
  listDroneInspections: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      status: z.string().optional(),
      inspectionType: z.string().optional(),
      limit: z.number().int().max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(droneInspections).orderBy(desc(droneInspections.scheduledAt)).limit(input?.limit ?? 100);
      let filtered: DroneInspection[] = rows;
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter((r: DroneInspection) => r.wellId === w); }
      if (input?.status) { const s = input.status; filtered = filtered.filter((r: DroneInspection) => r.status === s); }
      if (input?.inspectionType) { const t = input.inspectionType; filtered = filtered.filter((r: DroneInspection) => r.inspectionType === t); }
      return filtered;
    }),

  scheduleDroneInspection: adminProcedure
    .input(z.object({
      wellId: z.string().optional(),
      facilityId: z.string().optional(),
      droneModel: z.string().optional(),
      pilotName: z.string().optional(),
      inspectionType: z.enum(["visual", "thermal", "lidar", "gas_detection", "corrosion"]).default("visual"),
      scheduledAt: z.date(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const inspectionId = `DRONE-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(droneInspections).values({
        ...input,
        inspectionId,
        imageCount: 0,
        thermalImageCount: 0,
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  updateDroneInspection: adminProcedure
    .input(z.object({
      inspectionId: z.string(),
      status: z.string().optional(),
      startedAt: z.date().optional(),
      completedAt: z.date().optional(),
      flightDurationMin: z.number().int().optional(),
      imageCount: z.number().int().optional(),
      thermalImageCount: z.number().int().optional(),
      flightLogUrl: z.string().optional(),
      weatherConditions: z.string().optional(),
      windSpeedKnots: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { inspectionId, ...data } = input;
      const [row] = await db.update(droneInspections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(droneInspections.inspectionId, inspectionId))
        .returning();
      return row;
    }),

  listDroneFindings: protectedProcedure
    .input(z.object({
      inspectionId: z.string().optional(),
      severity: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().max(500).default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(droneFindings).orderBy(desc(droneFindings.createdAt)).limit(input?.limit ?? 100);
      let filtered: DroneFinding[] = rows;
      if (input?.inspectionId) { const i = input.inspectionId; filtered = filtered.filter((r: DroneFinding) => r.inspectionId === i); }
      if (input?.severity) { const s = input.severity; filtered = filtered.filter((r: DroneFinding) => r.severity === s); }
      if (input?.status) { const st = input.status; filtered = filtered.filter((r: DroneFinding) => r.status === st); }
      return filtered;
    }),

  createDroneFinding: adminProcedure
    .input(z.object({
      inspectionId: z.string(),
      findingType: z.string().min(1),
      severity: z.enum(["critical", "high", "medium", "low"]).default("low"),
      location: z.string().optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      thermalImageUrl: z.string().optional(),
      aiDetectionConfidence: z.number().min(0).max(1).optional(),
      aiModelVersion: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(droneFindings).values({
        ...input,
        status: "open",
        createdAt: new Date(),
      }).returning();
      return row;
    }),

  // ── Drone AI Defect Detection (Ollama/Qwen Vision) ──────────────────────
  analyzeInspectionImage: protectedProcedure
    .input(z.object({
      imageUrl: z.string().url(),
      inspectionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { analyzeDroneImage } = await import("../services/ollamaVision");
      const analysis = await analyzeDroneImage(input.imageUrl);
      // Auto-create finding for critical/high severity
      if (input.inspectionId && (analysis.severity === "critical" || analysis.severity === "high")) {
        const db = await getDb();
        if (db) {
          const [inspection] = await db.select().from(droneInspections)
            .where(eq(droneInspections.inspectionId, input.inspectionId)).limit(1);
          if (inspection) {
            await db.insert(droneFindings).values({
              inspectionId: inspection.inspectionId,
              findingType: analysis.category,
              severity: analysis.severity as "critical" | "high" | "medium" | "low",
              location: analysis.location,
              description: analysis.description,
              imageUrl: input.imageUrl,
              aiDetectionConfidence: analysis.confidence,
              aiModelVersion: analysis.model,
              status: "open",
              createdAt: new Date(),
            });
          }
        }
      }
      return analysis;
    }),

  batchAnalyzeInspectionImages: protectedProcedure
    .input(z.object({
      imageUrls: z.array(z.string().url()).min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      const { batchAnalyzeDroneImages } = await import("../services/ollamaVision");
      return batchAnalyzeDroneImages(input.imageUrls);
    }),

  checkOllamaStatus: protectedProcedure.query(async () => {
    const { isOllamaAvailable } = await import("../services/ollamaVision");
    const available = await isOllamaAvailable();
    return {
      available,
      model: process.env.OLLAMA_MODEL ?? "qwen2.5vl:7b",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      fallback: "manus-llm-vision",
    };
  }),

  getDroneInspectionSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStatus: {}, byType: {}, openFindings: 0, criticalFindings: 0 };
    const inspections = await db.select().from(droneInspections);
    const findings = await db.select().from(droneFindings);
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const i of inspections) {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      byType[i.inspectionType] = (byType[i.inspectionType] || 0) + 1;
    }
    const openFindings = findings.filter((f: DroneFinding) => f.status === "open").length;
    const criticalFindings = findings.filter((f: DroneFinding) => f.severity === "critical").length;
    return { total: inspections.length, byStatus, byType, openFindings, criticalFindings };
  }),
});
