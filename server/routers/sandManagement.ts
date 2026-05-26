/**
 * sandManagement.ts — Sand production monitoring and ML-based risk assessment
 * References:
 *   - API RP 14E: Erosional velocity limits
 *   - SPE-174269: Sand Management in Oil and Gas Production
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getPool } from "../db";
import { invokeLLM } from "../_core/llm";

// Erosional velocity calculation (API RP 14E)
function calcErosionalVelocity(fluidDensityLbFt3: number, cFactor: number = 100): number {
  return cFactor / Math.sqrt(fluidDensityLbFt3);
}

// Sand risk score (0-100) based on production parameters
function calcSandRisk(params: {
  drawdownPsi: number;
  formationStrengthPsi: number;
  waterCutFraction: number;
  productionRateBpd: number;
  wellAge_years: number;
}): number {
  const drawdownRatio = params.drawdownPsi / Math.max(params.formationStrengthPsi, 1);
  const waterCutFactor = params.waterCutFraction * 20;
  const ageFactor = Math.min(params.wellAge_years * 2, 20);
  const rateFactor = Math.min(params.productionRateBpd / 500, 20);

  return Math.min(100, Math.round(
    drawdownRatio * 40 + waterCutFactor + ageFactor + rateFactor
  ));
}

export const sandManagementRouter = router({
  // Get sand risk assessment for all active wells
  riskAssessment: protectedProcedure.query(async () => {
    const pool = await getPool();
    if (!pool) return [];

    try {
      const result = await pool.query(`
        SELECT
          w.well_id, w.name, w.field,
          w.oil_bpd, w.water_cut_fraction,
          w.reservoir_pressure_psi,
          w.flowing_bhp_psi,
          EXTRACT(YEAR FROM AGE(NOW(), w.first_production_date)) AS well_age_years,
          COALESCE(sm.sand_concentration_ppm, 0) AS sand_concentration_ppm,
          COALESCE(sm.last_sand_event, NULL) AS last_sand_event,
          COALESCE(sm.choke_size_64ths, 32) AS choke_size_64ths
        FROM wells w
        LEFT JOIN sand_monitoring sm ON sm.well_id = w.well_id
        WHERE w.status = 'active'
        ORDER BY w.field, w.name
      `);

      return result.rows.map((row: any) => {
        const drawdown = (row.reservoir_pressure_psi || 3000) - (row.flowing_bhp_psi || 2000);
        const risk = calcSandRisk({
          drawdownPsi: drawdown,
          formationStrengthPsi: 5000,
          waterCutFraction: Number(row.water_cut_fraction || 0),
          productionRateBpd: Number(row.oil_bpd || 0),
          wellAge_years: Number(row.well_age_years || 5),
        });
        return {
          ...row,
          drawdownPsi: drawdown,
          sandRiskScore: risk,
          riskLevel: risk >= 70 ? "HIGH" : risk >= 40 ? "MEDIUM" : "LOW",
          erosionalVelocityFtS: calcErosionalVelocity(52.0), // ~52 lb/ft3 for mixed fluid
        };
      });
    } catch { return []; }
  }),

  // Log a sand event
  logEvent: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      sandConcentrationPpm: z.number(),
      productionRateAtEvent: z.number(),
      chokeSetting: z.number().optional(),
      action: z.enum(["CHOKE_BACK", "SHUT_IN", "MONITOR", "SAND_TRAP_CLEANED"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");

      await pool.query(`
        INSERT INTO sand_events (well_id, occurred_at, sand_concentration_ppm, production_rate_bpd, choke_setting, action_taken, notes, logged_by)
        VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
      `, [input.wellId, input.sandConcentrationPpm, input.productionRateAtEvent, input.chokeSetting, input.action, input.notes, ctx.user.openId]);

      return { success: true };
    }),

  // AI-powered sand management recommendation
  aiRecommendation: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      sandConcentrationPpm: z.number(),
      drawdownPsi: z.number(),
      waterCutFraction: z.number(),
      currentChoke: z.number(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a petroleum engineer specializing in sand management. Provide concise, actionable recommendations based on API RP 14E and SPE best practices. Respond in 3-4 sentences.",
          },
          {
            role: "user",
            content: `Well ${input.wellId}: Sand concentration ${input.sandConcentrationPpm} ppm, drawdown ${input.drawdownPsi} psi, water cut ${(input.waterCutFraction * 100).toFixed(0)}%, choke ${input.currentChoke}/64". What action do you recommend?`,
          },
        ],
      });
      return { recommendation: response.choices[0]?.message?.content ?? "Unable to generate recommendation." };
    }),
});
