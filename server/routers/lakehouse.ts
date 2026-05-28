/**
 * server/routers/lakehouse.ts — tRPC router for RTDIP Delta Lakehouse queries
 *
 * Provides time-series analytics via the Python RTDIP REST API:
 * - TWA (time-weighted average) for regulatory compliance
 * - Resample for trend analysis
 * - Latest values for real-time monitoring
 * - Tag browser for OPC-UA tag discovery
 *
 * Requires the RTDIP API to be running. Throws SERVICE_UNAVAILABLE if not.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { withCache, cacheKey, TTL } from "../cache";

const RTDIP_URL = process.env.RTDIP_API_URL ?? "http://localhost:8000";

// ─── HTTP helper ───────────────────────────────────────────────────────────────

function rtdipError(message: string): TRPCError {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: `RTDIP Lakehouse service unavailable: ${message}. Ensure RTDIP API is running at ${RTDIP_URL}`,
  });
}

async function rtdipFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${RTDIP_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`RTDIP ${path} returned ${res.status}`);
    return await res.json() as T;
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw rtdipError(err instanceof Error ? err.message : "connection failed");
  }
}

// ─── Exported helpers for testing ───────────────────────────────────────────

export async function getRtdipStatus() {
  try {
    const data = await rtdipFetch<Record<string, unknown>>("/health");
    return { healthy: true, mode: "rtdip", ...data } as { healthy: boolean; mode: string; ingestionRate: number; tagCount: number; deltaTablePath: string };
  } catch {
    return { healthy: false, mode: "unavailable", ingestionRate: 0, tagCount: 0, deltaTablePath: "N/A" };
  }
}

export async function getRtdipTags(input: { wellId?: string; search?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (input.wellId) params.set("wellId", input.wellId);
  if (input.search) params.set("search", input.search);
  if (input.limit) params.set("limit", String(input.limit));
  return rtdipFetch<{ tags: Array<{ tag: string; description: string; unit: string; dataType: string }>; source: string }>(`/rtdip/tags?${params}`);
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const lakehouseRouter = router({
  queryTWA: protectedProcedure
    .input(
      z.object({
        tag: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        unit: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const key = cacheKey("lakehouse", "twa", { tag: input.tag, start: input.startTime, end: input.endTime });
      return withCache(key, TTL.LAKEHOUSE, async () => {
        return rtdipFetch<{
          tag: string;
          twa: number;
          unit: string;
          startTime: string;
          endTime: string;
          source: string;
        }>("/rtdip/twa", {
          method: "POST",
          body: JSON.stringify(input),
        });
      });
    }),

  resample: protectedProcedure
    .input(
      z.object({
        tag: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        resolution: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).default("1h"),
      })
    )
    .query(async ({ input }) => {
      return rtdipFetch<{
        tag: string;
        resolution: string;
        timeSeries: Array<{ timestamp: string; value: number }>;
        source: string;
      }>("/rtdip/resample", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }),

  latestValues: protectedProcedure
    .input(
      z.object({
        tags: z.array(z.string()).min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      return rtdipFetch<{
        values: Array<{ tag: string; value: number; timestamp: string; unit: string; quality: string }>;
        source: string;
      }>("/rtdip/latest", {
        method: "POST",
        body: JSON.stringify({ tags: input.tags }),
      });
    }),

  tags: protectedProcedure
    .input(
      z.object({
        wellId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(50),
      })
    )
    .query(async ({ input }) => {
      return getRtdipTags(input);
    }),

  health: protectedProcedure.query(async () => {
    return getRtdipStatus();
  }),

  sqlQuery: protectedProcedure
    .input(
      z.object({
        sql: z.string().min(1).max(5000),
        limit: z.number().min(1).max(10000).default(1000),
      })
    )
    .query(async ({ input }) => {
      return rtdipFetch<{
        rows: Array<Record<string, unknown>>;
        rowCount: number;
        executionMs: number;
        source: string;
      }>("/rtdip/query", {
        method: "POST",
        body: JSON.stringify({ sql: input.sql, limit: input.limit }),
      });
    }),

  geospatial: protectedProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
        radiusKm: z.number().min(0.1).max(100).default(10),
        assetType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return rtdipFetch<{
        features: Array<Record<string, unknown>>;
        totalFound: number;
        radiusKm: number;
        source: string;
      }>("/rtdip/geospatial", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }),

  datafusionQuery: protectedProcedure
    .input(z.object({ sql: z.string().min(1), limit: z.number().int().min(1).max(10000).default(500) }))
    .mutation(async ({ input }) => {
      return rtdipFetch<{
        columns: string[];
        rows: unknown[][];
        rowCount: number;
        executionMs: number;
        source: string;
      }>("/rtdip/datafusion/query", { method: "POST", body: JSON.stringify(input) });
    }),

  duckdbQuery: protectedProcedure
    .input(z.object({ sql: z.string().min(1), limit: z.number().int().min(1).max(10000).default(500) }))
    .mutation(async ({ input }) => {
      return rtdipFetch<{
        columns: string[];
        rows: unknown[][];
        rowCount: number;
        executionMs: number;
        source: string;
      }>("/rtdip/duckdb/query", { method: "POST", body: JSON.stringify(input) });
    }),

  icebergCatalog: protectedProcedure.query(async () => {
    return rtdipFetch<{
      tables: Array<{ namespace: string; name: string; format: string; location: string; snapshotCount: number }>;
      source: string;
    }>("/rtdip/iceberg/catalog");
  }),

  analyticsHealth: protectedProcedure.query(async () => {
    return rtdipFetch<{ healthy: boolean; engine: string; version: string; source: string }>("/rtdip/analytics/health");
  }),

  datafusionHealth: protectedProcedure.query(async () => {
    return rtdipFetch<{ healthy: boolean; engine: string; version: string; source: string }>("/rtdip/datafusion/health");
  }),

  sedonaProximityQuery: protectedProcedure
    .input(z.object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      radiusKm: z.number().min(0.1).max(500).default(25),
    }).optional())
    .query(async ({ input }) => {
      return rtdipFetch<{
        features: Array<Record<string, unknown>>;
        totalFound: number;
        source: string;
      }>("/rtdip/sedona/proximity", { method: "POST", body: JSON.stringify(input ?? {}) });
    }),

  sedonaDamageHeatmap: protectedProcedure
    .input(z.object({}).optional())
    .query(async () => {
      return rtdipFetch<{
        heatmap: Array<{ lat: number; lng: number; intensity: number; assetId: string }>;
        source: string;
      }>("/rtdip/sedona/damage-heatmap");
    }),
});
