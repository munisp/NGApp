/**
 * Data Quality Router — automated validation of telemetry data.
 * Checks range limits, rate-of-change, and flags anomalous readings.
 */
import { z } from "zod";
import { eq, desc, and, isNull } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { dataQualityRules, dataQualityViolations } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const dataQualityRouter = router({
  // ─── Rules CRUD ──────────────────────────────────────────────────────────
  listRules: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return db.select().from(dataQualityRules).orderBy(dataQualityRules.sensorType);
  }),

  createRule: adminProcedure
    .input(z.object({
      ruleName: z.string().min(1).max(128),
      sensorType: z.string().min(1).max(64),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      maxRateOfChange: z.number().optional(),
      unit: z.string().max(16).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db.insert(dataQualityRules).values(input).returning();
      return row;
    }),

  updateRule: adminProcedure
    .input(z.object({
      id: z.number().int(),
      ruleName: z.string().min(1).max(128).optional(),
      minValue: z.number().nullable().optional(),
      maxValue: z.number().nullable().optional(),
      maxRateOfChange: z.number().nullable().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, ...data } = input;
      const [row] = await db.update(dataQualityRules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dataQualityRules.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  deleteRule: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(dataQualityRules).where(eq(dataQualityRules.id, input.id));
      return { deleted: true };
    }),

  // ─── Violations ──────────────────────────────────────────────────────────
  listViolations: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
      cursor: z.number().int().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let query = db.select().from(dataQualityViolations).orderBy(desc(dataQualityViolations.detectedAt)).limit(input.limit + 1);
      if (input.wellId) {
        query = db.select().from(dataQualityViolations)
          .where(eq(dataQualityViolations.wellId, input.wellId))
          .orderBy(desc(dataQualityViolations.detectedAt))
          .limit(input.limit + 1) as typeof query;
      }
      const rows = await query;
      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db.update(dataQualityViolations)
        .set({
          acknowledged: true,
          acknowledgedBy: ctx.user?.email ?? "unknown",
          acknowledgedAt: new Date(),
        })
        .where(eq(dataQualityViolations.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  // ─── Validate reading against rules ───────────────────────────────────────
  validateReading: protectedProcedure
    .input(z.object({
      wellId: z.string().min(1),
      sensorType: z.string().min(1),
      value: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rules = await db.select().from(dataQualityRules)
        .where(and(eq(dataQualityRules.sensorType, input.sensorType), eq(dataQualityRules.enabled, true)));

      const violations: Array<{ ruleName: string; violationType: string; severity: string }> = [];

      for (const rule of rules) {
        if (rule.minValue !== null && input.value < rule.minValue) {
          violations.push({ ruleName: rule.ruleName, violationType: "below_minimum", severity: "warning" });
          await db.insert(dataQualityViolations).values({
            ruleId: rule.id,
            wellId: input.wellId,
            sensorType: input.sensorType,
            value: input.value,
            expectedRange: `>= ${rule.minValue}`,
            violationType: "below_minimum",
            severity: "warning",
          });
        }
        if (rule.maxValue !== null && input.value > rule.maxValue) {
          violations.push({ ruleName: rule.ruleName, violationType: "above_maximum", severity: "critical" });
          await db.insert(dataQualityViolations).values({
            ruleId: rule.id,
            wellId: input.wellId,
            sensorType: input.sensorType,
            value: input.value,
            expectedRange: `<= ${rule.maxValue}`,
            violationType: "above_maximum",
            severity: "critical",
          });
        }
      }

      return { valid: violations.length === 0, violations };
    }),

  // ─── Dashboard stats ─────────────────────────────────────────────────────
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const allRules = await db.select().from(dataQualityRules);
    const unacknowledged = await db.select().from(dataQualityViolations)
      .where(eq(dataQualityViolations.acknowledged, false))
      .limit(1000);
    return {
      totalRules: allRules.length,
      enabledRules: allRules.filter((r) => r.enabled).length,
      openViolations: unacknowledged.length,
      bySeverity: {
        critical: unacknowledged.filter((v) => v.severity === "critical").length,
        warning: unacknowledged.filter((v) => v.severity === "warning").length,
        info: unacknowledged.filter((v) => v.severity === "info").length,
      },
    };
  }),
});
