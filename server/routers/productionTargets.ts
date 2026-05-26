/**
 * productionTargets.ts — Production target tracking and variance analysis
 * Compares actual production vs. targets and generates variance reports
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getPool, getDb } from "../db";
import { wells } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const productionTargetsRouter = router({
  // Get current production vs targets for all wells
  summary: protectedProcedure.query(async () => {
    const pool = await getPool();
    if (!pool) return { wells: [], totalOilActual: 0, totalOilTarget: 0, variance: 0 };

    try {
      const result = await pool.query(`
        SELECT
          w.well_id,
          w.name,
          w.field,
          w.oil_bpd AS actual_oil_bpd,
          w.gas_mmscfd AS actual_gas_mmscfd,
          COALESCE(pt.oil_target_bpd, w.oil_bpd * 1.05) AS oil_target_bpd,
          COALESCE(pt.gas_target_mmscfd, w.gas_mmscfd * 1.05) AS gas_target_mmscfd,
          COALESCE(pt.water_injection_bwpd, 0) AS water_injection_bwpd,
          w.status
        FROM wells w
        LEFT JOIN production_targets pt ON pt.well_id = w.well_id
          AND pt.target_date = CURRENT_DATE
        WHERE w.status = 'active'
        ORDER BY w.field, w.name
      `);

      const wells = result.rows;
      const totalOilActual = wells.reduce((s: number, w: any) => s + Number(w.actual_oil_bpd || 0), 0);
      const totalOilTarget = wells.reduce((s: number, w: any) => s + Number(w.oil_target_bpd || 0), 0);
      const variance = totalOilTarget > 0 ? ((totalOilActual - totalOilTarget) / totalOilTarget) * 100 : 0;

      return { wells, totalOilActual, totalOilTarget, variance: Math.round(variance * 10) / 10 };
    } catch {
      return { wells: [], totalOilActual: 0, totalOilTarget: 0, variance: 0 };
    }
  }),

  // Set production target for a well on a specific date
  setTarget: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      targetDate: z.string(),
      oilTargetBpd: z.number().min(0),
      gasTargetMmscfd: z.number().min(0).optional(),
      waterInjectionBwpd: z.number().min(0).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");

      await pool.query(`
        INSERT INTO production_targets (well_id, target_date, oil_target_bpd, gas_target_mmscfd, water_injection_bwpd, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (well_id, target_date) DO UPDATE SET
          oil_target_bpd = EXCLUDED.oil_target_bpd,
          gas_target_mmscfd = EXCLUDED.gas_target_mmscfd,
          water_injection_bwpd = EXCLUDED.water_injection_bwpd,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `, [input.wellId, input.targetDate, input.oilTargetBpd, input.gasTargetMmscfd ?? 0, input.waterInjectionBwpd ?? 0, input.notes]);

      return { success: true };
    }),

  // Get historical variance for a well
  history: protectedProcedure
    .input(z.object({ wellId: z.string(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const pool = await getPool();
      if (!pool) return [];

      try {
        const result = await pool.query(`
          SELECT
            pt.target_date,
            pt.oil_target_bpd,
            w.oil_bpd AS actual_oil_bpd,
            (w.oil_bpd - pt.oil_target_bpd) AS variance_bpd,
            CASE WHEN pt.oil_target_bpd > 0
              THEN ROUND(((w.oil_bpd - pt.oil_target_bpd) / pt.oil_target_bpd * 100)::numeric, 1)
              ELSE 0 END AS variance_pct
          FROM production_targets pt
          JOIN wells w ON w.well_id = pt.well_id
          WHERE pt.well_id = $1
            AND pt.target_date >= CURRENT_DATE - INTERVAL '1 day' * $2
          ORDER BY pt.target_date DESC
        `, [input.wellId, input.days]);
        return result.rows;
      } catch {
        return [];
      }
    }),

  // Delete a target
  deleteTarget: protectedProcedure
    .input(z.object({ wellId: z.string(), targetDate: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("DELETE FROM production_targets WHERE well_id = $1 AND target_date = $2", [input.wellId, input.targetDate]);
      return { success: true };
    }),
});
