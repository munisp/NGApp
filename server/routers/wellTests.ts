/**
 * wellTests.ts — Well test scheduling and results management
 * Manages periodic well tests (production tests, pressure buildup tests, injectivity tests)
 * Reference: API RP 19G1 — Measurement of Multiphase Flow
 */
import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getPool } from "../db";
import { notifyOwner } from "../_core/notification";

const WellTestTypeEnum = z.enum(["PRODUCTION", "PRESSURE_BUILDUP", "INJECTIVITY", "FALLOFF", "INTERFERENCE", "TRACER"]);

export const wellTestsRouter = router({
  list: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const pool = await getPool();
      if (!pool) return [];
      try {
        const conds: string[] = [];
        const params: any[] = [];
        let i = 1;
        if (input.wellId) { conds.push(`well_id = $${i++}`); params.push(input.wellId); }
        if (input.status) { conds.push(`status = $${i++}`); params.push(input.status); }
        params.push(input.limit);
        const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
        const result = await pool.query(
          `SELECT * FROM well_tests ${where} ORDER BY scheduled_at DESC LIMIT $${i}`,
          params
        );
        return result.rows;
      } catch { return []; }
    }),

  schedule: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      testType: WellTestTypeEnum,
      scheduledAt: z.string(),
      durationHours: z.number().default(24),
      assignedTo: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      const testId = `WT-${Date.now()}`;
      await pool.query(`
        INSERT INTO well_tests (test_id, well_id, test_type, scheduled_at, duration_hours, assigned_to, notes, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED', $8)
      `, [testId, input.wellId, input.testType, new Date(input.scheduledAt), input.durationHours, input.assignedTo, input.notes, ctx.user.openId]);

      await notifyOwner({
        title: `Well Test Scheduled: ${input.testType} on ${input.wellId}`,
        content: `Test ID: ${testId}\nScheduled: ${input.scheduledAt}\nDuration: ${input.durationHours}h\nAssigned to: ${input.assignedTo || "Unassigned"}`,
      });

      return { testId, success: true };
    }),

  updateResult: protectedProcedure
    .input(z.object({
      testId: z.string(),
      status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      oilRateBpd: z.number().optional(),
      gasRateMmscfd: z.number().optional(),
      waterRateBwpd: z.number().optional(),
      bhpPsi: z.number().optional(),
      bhtDegF: z.number().optional(),
      skinFactor: z.number().optional(),
      permeabilityMd: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query(`
        UPDATE well_tests SET
          status = $2,
          oil_rate_bpd = COALESCE($3, oil_rate_bpd),
          gas_rate_mmscfd = COALESCE($4, gas_rate_mmscfd),
          water_rate_bwpd = COALESCE($5, water_rate_bwpd),
          bhp_psi = COALESCE($6, bhp_psi),
          bht_deg_f = COALESCE($7, bht_deg_f),
          skin_factor = COALESCE($8, skin_factor),
          permeability_md = COALESCE($9, permeability_md),
          notes = COALESCE($10, notes),
          completed_at = CASE WHEN $2 = 'COMPLETED' THEN NOW() ELSE completed_at END
        WHERE test_id = $1
      `, [input.testId, input.status, input.oilRateBpd, input.gasRateMmscfd, input.waterRateBwpd, input.bhpPsi, input.bhtDegF, input.skinFactor, input.permeabilityMd, input.notes]);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ testId: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      await pool.query("DELETE FROM well_tests WHERE test_id = $1 AND status = 'SCHEDULED'", [input.testId]);
      return { success: true };
    }),

  // Get upcoming tests in the next 7 days
  upcoming: protectedProcedure.query(async () => {
    const pool = await getPool();
    if (!pool) return [];
    try {
      const result = await pool.query(`
        SELECT wt.*, w.name AS well_name, w.field
        FROM well_tests wt
        JOIN wells w ON w.well_id = wt.well_id
        WHERE wt.status = 'SCHEDULED'
          AND wt.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY wt.scheduled_at ASC
      `);
      return result.rows;
    } catch { return []; }
  }),
});
