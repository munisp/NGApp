/**
 * wellboreIntegrity.ts — Casing inspection, pressure tests, corrosion monitoring, integrity score
 * References:
 *   - ISO 16530-1:2017 Well integrity — Part 1: Life cycle governance
 *   - API RP 90: Annular Casing Pressure Management for Offshore Wells
 *   - NORSOK D-010: Well integrity in drilling and well operations
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { casingInspections, pressureTests } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Integrity score calculator (0-100) ──────────────────────────────────────
function calcIntegrityScore(params: {
  corrosionPct: number;
  ovalityPct: number;
  wallThicknessIn: number;
  nominalWallIn: number;
  anomaliesFound: number;
  passedPressureTest: boolean;
  daysSinceLastInspection: number;
}): number {
  let score = 100;
  // Corrosion penalty: -1 point per % corrosion, accelerating above 20%
  score -= Math.min(40, params.corrosionPct * (params.corrosionPct > 20 ? 2 : 1));
  // Ovality penalty: -2 points per % ovality
  score -= Math.min(20, params.ovalityPct * 2);
  // Wall thickness loss
  const wallLossPct = params.nominalWallIn > 0
    ? (1 - params.wallThicknessIn / params.nominalWallIn) * 100
    : 0;
  score -= Math.min(20, wallLossPct * 1.5);
  // Anomalies: -5 per anomaly, max -20
  score -= Math.min(20, params.anomaliesFound * 5);
  // Failed pressure test: -25
  if (!params.passedPressureTest) score -= 25;
  // Inspection age: -5 per year overdue (>2 years)
  const yearsOld = params.daysSinceLastInspection / 365;
  if (yearsOld > 2) score -= Math.min(15, (yearsOld - 2) * 5);
  return Math.max(0, Math.round(score));
}

export const wellboreIntegrityRouter = router({
  // Get integrity summary for a well
  summary: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const inspections = await db.select().from(casingInspections)
        .where(eq(casingInspections.wellId, input.wellId))
        .orderBy(desc(casingInspections.inspectionDate));

      const tests = await db.select().from(pressureTests)
        .where(eq(pressureTests.wellId, input.wellId))
        .orderBy(desc(pressureTests.testDate));

      const latestInspection = inspections[0] ?? null;
      const latestTest = tests[0] ?? null;

      // Compute overall integrity score from latest data
      let overallScore = 85; // default when no data
      if (latestInspection) {
        const daysSince = latestInspection.inspectionDate
          ? Math.floor((Date.now() - new Date(latestInspection.inspectionDate).getTime()) / 86400000)
          : 730;
        overallScore = calcIntegrityScore({
          corrosionPct: latestInspection.corrosionPct ?? 5,
          ovalityPct: latestInspection.ovalityPct ?? 1,
          wallThicknessIn: latestInspection.wallThicknessIn ?? 0.35,
          nominalWallIn: 0.415, // typical 5.5" 17 lb/ft casing
          anomaliesFound: latestInspection.anomaliesFound ?? 0,
          passedPressureTest: latestTest?.passed ?? true,
          daysSinceLastInspection: daysSince,
        });
      }

      const riskLevel = overallScore >= 80 ? "LOW" : overallScore >= 60 ? "MEDIUM" : overallScore >= 40 ? "HIGH" : "CRITICAL";

      return {
        wellId: input.wellId,
        overallScore,
        riskLevel,
        inspectionCount: inspections.length,
        pressureTestCount: tests.length,
        latestInspection,
        latestTest,
        casingStrings: Array.from(new Set(inspections.map(i => i.casingString))),
        nextInspectionDue: latestInspection?.nextInspectionDue ?? null,
        recommendation: overallScore >= 80
          ? "Well integrity is satisfactory. Continue routine monitoring."
          : overallScore >= 60
          ? "Minor integrity concerns detected. Schedule inspection within 6 months."
          : overallScore >= 40
          ? "Significant integrity issues. Immediate inspection and remediation required."
          : "CRITICAL: Well integrity compromised. Shut-in and emergency workover required.",
      };
    }),

  // List casing inspections
  listInspections: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(casingInspections)
        .where(eq(casingInspections.wellId, input.wellId))
        .orderBy(desc(casingInspections.inspectionDate));
    }),

  // Add casing inspection
  addInspection: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      inspectionDate: z.string(),
      inspectionType: z.enum(["MLIT", "ELTF", "CAST", "USIT", "VISUAL"]),
      casingString: z.enum(["SURFACE", "INTERMEDIATE", "PRODUCTION", "LINER"]),
      topDepthFt: z.number(),
      bottomDepthFt: z.number(),
      wallThicknessIn: z.number().optional(),
      corrosionPct: z.number().min(0).max(100).optional(),
      ovalityPct: z.number().min(0).max(100).optional(),
      anomaliesFound: z.number().int().min(0).default(0),
      passedTest: z.boolean().default(true),
      nextInspectionDue: z.string().optional(),
      notes: z.string().optional(),
      inspectedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Auto-calculate integrity score
      const score = calcIntegrityScore({
        corrosionPct: input.corrosionPct ?? 5,
        ovalityPct: input.ovalityPct ?? 1,
        wallThicknessIn: input.wallThicknessIn ?? 0.35,
        nominalWallIn: 0.415,
        anomaliesFound: input.anomaliesFound,
        passedPressureTest: input.passedTest,
        daysSinceLastInspection: 0,
      });

      const [record] = await db.insert(casingInspections).values({
        wellId: input.wellId,
        inspectionDate: new Date(input.inspectionDate),
        inspectionType: input.inspectionType,
        casingString: input.casingString,
        topDepthFt: input.topDepthFt,
        bottomDepthFt: input.bottomDepthFt,
        wallThicknessIn: input.wallThicknessIn,
        corrosionPct: input.corrosionPct,
        ovalityPct: input.ovalityPct,
        integrityScore: score,
        anomaliesFound: input.anomaliesFound,
        passedTest: input.passedTest,
        nextInspectionDue: input.nextInspectionDue ? new Date(input.nextInspectionDue) : undefined,
        notes: input.notes,
        inspectedBy: input.inspectedBy ?? ctx.user.name ?? ctx.user.openId,
      }).returning();
      return record;
    }),

  // List pressure tests
  listPressureTests: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(pressureTests)
        .where(eq(pressureTests.wellId, input.wellId))
        .orderBy(desc(pressureTests.testDate));
    }),

  // Add pressure test
  addPressureTest: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      testDate: z.string(),
      testType: z.enum(["MAASP", "MASP", "SITP", "CITHP", "INFLOW", "LEAKOFF", "FIT"]),
      testPressurePsi: z.number().positive(),
      holdTimeMins: z.number().int().positive(),
      pressureDropPsi: z.number().min(0).optional(),
      acceptanceCriteriaPsi: z.number().optional(),
      passed: z.boolean().default(true),
      testFluid: z.string().default("water"),
      notes: z.string().optional(),
      testedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [record] = await db.insert(pressureTests).values({
        wellId: input.wellId,
        testDate: new Date(input.testDate),
        testType: input.testType,
        testPressurePsi: input.testPressurePsi,
        holdTimeMins: input.holdTimeMins,
        pressureDropPsi: input.pressureDropPsi,
        acceptanceCriteriaPsi: input.acceptanceCriteriaPsi,
        passed: input.passed,
        testFluid: input.testFluid,
        notes: input.notes,
        testedBy: input.testedBy ?? ctx.user.name ?? ctx.user.openId,
      }).returning();
      return record;
    }),

  // Integrity score history (trend over time)
  scoreHistory: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const inspections = await db.select().from(casingInspections)
        .where(eq(casingInspections.wellId, input.wellId))
        .orderBy(casingInspections.inspectionDate);
      return inspections.map(i => ({
        date: i.inspectionDate,
        score: i.integrityScore ?? 85,
        casingString: i.casingString,
        inspectionType: i.inspectionType,
        passed: i.passedTest,
      }));
    }),

  deleteInspection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(casingInspections).where(eq(casingInspections.id, input.id));
      return { success: true };
    }),

  deletePressureTest: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(pressureTests).where(eq(pressureTests.id, input.id));
      return { success: true };
    }),
});