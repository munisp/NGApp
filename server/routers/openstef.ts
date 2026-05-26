/**
 * openstef.ts — tRPC router for OpenSTEF O&G forecasting service
 *
 * Bridges the Node.js tRPC layer to the Python OpenSTEF microservice
 * running on port 8001. Exposes forecast, baseline, and availability
 * endpoints for the Lakehouse trend chart and OpenADR VTN integration.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

const OPENSTEF_URL = process.env.OPENSTEF_API_URL ?? "http://localhost:8001";

// ─── Types ────────────────────────────────────────────────────────────────────

const ForecastPointSchema = z.object({
  timestamp: z.string(),
  p05: z.number(),
  p50: z.number(),
  p95: z.number(),
  is_forecast: z.boolean(),
});

const ForecastResultSchema = z.object({
  tag: z.string(),
  generated_at: z.string(),
  horizon_hours: z.number(),
  resolution_minutes: z.number(),
  forecast: z.array(ForecastPointSchema),
  model_type: z.string(),
  feature_importance: z.record(z.string(), z.number()),
  baseline_kw: z.number(),
  available_headroom_kw: z.number(),
  source: z.string(),
});

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function fetchOpenstef<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${OPENSTEF_URL}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000), ...init });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenSTEF ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If service is down, return simulated data instead of hard error
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("timeout")) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: `OpenSTEF service unavailable (${OPENSTEF_URL}). Is the Python service running?`,
      });
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const openStefRouter = router({
  /**
   * Get service health status
   */
  health: protectedProcedure.query(async () => {
    try {
      const data = await fetchOpenstef<Record<string, unknown>>("/health");
      return { online: true, ...data };
    } catch {
      return {
        online: false,
        status: "unavailable",
        service: "openstef-og",
        openstef_enabled: false,
        message: "OpenSTEF Python service is not running.",
      };
    }
  }),

  /**
   * Get 48h probabilistic forecast for a tag.
   * Falls back to simulation if the Python service is unavailable.
   */
  getForecast: protectedProcedure
    .input(
      z.object({
        tag: z.string().min(1),
        horizonHours: z.number().int().min(1).max(168).default(48),
        resolutionMinutes: z.number().int().min(5).max(60).default(15),
      })
    )
    .query(async ({ input }) => {
      const data = await fetchOpenstef<z.infer<typeof ForecastResultSchema>>(
        `/forecast/${encodeURIComponent(input.tag)}?horizon_hours=${input.horizonHours}&resolution_minutes=${input.resolutionMinutes}`
      );
      return { ...data, online: true };
    }),

  /**
   * Get DR settlement baseline for a tag.
   * Rolling 10-day same-hour-of-day / same-day-of-week average.
   */
  getBaseline: protectedProcedure
    .input(z.object({ tag: z.string().min(1) }))
    .query(async ({ input }) => {
      return fetchOpenstef<{
        tag: string;
        baseline_kw: number;
        min_safe_load_kw: number;
        available_headroom_kw: number;
        calculated_at: string;
        method: string;
      }>(`/baseline/${encodeURIComponent(input.tag)}`);
    }),

  /**
   * Real-time curtailment availability check for OpenADR VTN event dispatch.
   */
  getAvailability: protectedProcedure
    .input(z.object({ tag: z.string().min(1) }))
    .query(async ({ input }) => {
      return fetchOpenstef<{
        tag: string;
        current_demand_kw: number;
        min_safe_load_kw: number;
        available_headroom_kw: number;
        available_for_dr: boolean;
        max_curtailment_kw: number;
        checked_at: string;
      }>(`/availability/${encodeURIComponent(input.tag)}`);
    }),

  /**
   * List all forecastable tags.
   */
  listTags: protectedProcedure.query(async () => {
    return fetchOpenstef<{ tags: unknown[] }>("/tags");
  }),

  /**
   * Save model accuracy metrics to the database after a training/reconciliation run.
   */
  saveModelMetrics: protectedProcedure
    .input(
      z.object({
        tag: z.string(),
        modelType: z.string().default("xgb_quantile"),
        mae: z.number().optional(),
        rmse: z.number().optional(),
        mape: z.number().optional(),
        bias: z.number().optional(),
        r2: z.number().optional(),
        trainingSamples: z.number().int().optional(),
        horizon: z.number().int().default(48),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { modelMetrics } = await import("../../drizzle/schema");
      await db.insert(modelMetrics).values({
        tag: input.tag,
        modelType: input.modelType,
        mae: input.mae,
        rmse: input.rmse,
        mape: input.mape,
        bias: input.bias,
        r2: input.r2,
        trainingSamples: input.trainingSamples,
        horizon: input.horizon,
        trainedAt: new Date(),
      });
      return { saved: true };
    }),

  /**
   * Get model accuracy metrics history for a tag (for trend chart on Infrastructure page).
   */
  getModelMetrics: protectedProcedure
    .input(z.object({ tag: z.string(), limit: z.number().int().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { modelMetrics } = await import("../../drizzle/schema");
      const { desc, eq } = await import("drizzle-orm");
      return db
        .select()
        .from(modelMetrics)
        .where(eq(modelMetrics.tag, input.tag))
        .orderBy(desc(modelMetrics.trainedAt))
        .limit(input.limit);
    }),

  /**
   * Trigger a model retrain for a specific tag.
   * Called from the PTW workflow UI after a Permit-to-Work closes,
   * ensuring the DR baseline reflects the post-maintenance operating envelope.
   */
  triggerRetrain: protectedProcedure
    .input(
      z.object({
        tag: z.string().min(1),
        reason: z.string().default("manual"),
        ptwId: z.number().int().optional(),
        workType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await fetchOpenstef<{
          status: string;
          tag: string;
          algorithm: string;
          data_points: number;
          mae: number;
          rmse: number;
          mape: number;
          trained_at: string;
          trigger: string;
        }>("/retrain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        return { success: true, ...result };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: `OpenSTEF retrain failed: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    }),

  /**
   * Get model training status.
   */
  modelStatus: protectedProcedure.query(async () => {
    return fetchOpenstef<{
      model_count: number;
      model_dir: string;
      models: unknown[];
      openstef_enabled: boolean;
    }>("/model/status");
  }),
});
