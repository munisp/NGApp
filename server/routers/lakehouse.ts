/**
 * server/routers/lakehouse.ts — tRPC router for RTDIP Delta Lakehouse queries
 *
 * Provides time-series analytics via the Python RTDIP REST API:
 * - TWA (time-weighted average) for regulatory compliance
 * - Resample for trend analysis
 * - Latest values for real-time monitoring
 * - Tag browser for OPC-UA tag discovery
 *
 * Falls back to simulated data when the RTDIP API is unavailable.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const RTDIP_URL = process.env.RTDIP_API_URL ?? "http://localhost:8000";
const RTDIP_ENABLED = process.env.RTDIP_ENABLED !== "false";

// ─── HTTP helper ───────────────────────────────────────────────────────────────

async function rtdipFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${RTDIP_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    signal: AbortSignal.timeout(10000),
  });
}

// ─── Simulation helpers ────────────────────────────────────────────────────────

function simulateTWA(tag: string, startTime: string, endTime: string): number {
  const seed = tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.round((seed % 500 + 100) * 10) / 10;
}

function simulateTimeSeries(tag: string, startTime: string, endTime: string, sampleCount = 24): Array<{ timestamp: string; value: number }> {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const step = (end - start) / sampleCount;
  const seed = tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = (seed % 500) + 100;

  return Array.from({ length: sampleCount }, (_, i) => ({
    timestamp: new Date(start + i * step).toISOString(),
    value: Math.round((base + Math.sin(i * 0.5) * 20 + Math.random() * 5) * 10) / 10,
  }));
}

// ─── Exported helpers for testing ───────────────────────────────────────────

export async function getRtdipStatus() {
  if (!RTDIP_ENABLED) {
    return { healthy: false, mode: "simulated", ingestionRate: 0, tagCount: 0, deltaTablePath: "N/A" };
  }
  try {
    const res = await rtdipFetch("/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    return { healthy: true, mode: "rtdip", ...data } as { healthy: boolean; mode: string; ingestionRate: number; tagCount: number; deltaTablePath: string };
  } catch {
    return { healthy: false, mode: "simulated", ingestionRate: 0, tagCount: 0, deltaTablePath: "N/A" };
  }
}

export async function getRtdipTags(input: { wellId?: string; search?: string; limit?: number }) {
  if (!RTDIP_ENABLED) {
    const wellPrefix = input.wellId ? `${input.wellId}.` : "W-001.";
    const tagNames = ["WELLHEAD_PRESSURE", "TUBING_TEMP", "CASING_PRESSURE", "CHOKE_POSITION", "GAS_RATE", "OIL_RATE", "WATER_RATE", "BOTTOM_HOLE_PRESSURE", "FLOW_RATE", "SEPARATOR_PRESSURE"];
    const tags = tagNames.map((t) => ({
      tag: `${wellPrefix}${t}`,
      description: t.replace(/_/g, " ").toLowerCase(),
      unit: t.includes("PRESSURE") ? "psi" : t.includes("TEMP") ? "°F" : t.includes("RATE") ? "bbl/d" : "%",
      dataType: "float64",
    }));
    return { tags: tags.slice(0, input.limit ?? 50), source: "simulated" };
  }
  try {
    const params = new URLSearchParams();
    if (input.wellId) params.set("wellId", input.wellId);
    if (input.search) params.set("search", input.search);
    if (input.limit) params.set("limit", String(input.limit));
    const res = await rtdipFetch(`/rtdip/tags?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as { tags: Array<{ tag: string; description: string; unit: string; dataType: string }>; source: string };
  } catch {
    return { tags: [], source: "simulated" };
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

export const lakehouseRouter = router({
  /**
   * Query time-weighted average for a tag over a time range.
   * Used by regulatory PDF templates for KOC/ARAMCO compliance.
   */
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
      if (!RTDIP_ENABLED) {
        return {
          tag: input.tag,
          twa: simulateTWA(input.tag, input.startTime, input.endTime),
          unit: input.unit ?? "psi",
          startTime: input.startTime,
          endTime: input.endTime,
          source: "simulated",
        };
      }
      try {
        const res = await rtdipFetch("/rtdip/twa", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        return {
          tag: input.tag,
          twa: simulateTWA(input.tag, input.startTime, input.endTime),
          unit: input.unit ?? "psi",
          startTime: input.startTime,
          endTime: input.endTime,
          source: "simulated",
        };
      }
    }),

  /**
   * Resample a tag's time series to a fixed interval.
   */
  queryResample: protectedProcedure
    .input(
      z.object({
        tag: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        interval: z.string().default("1h"),
        method: z.enum(["mean", "max", "min", "sum", "last"]).default("mean"),
      })
    )
    .query(async ({ input }) => {
      if (!RTDIP_ENABLED) {
        return {
          tag: input.tag,
          interval: input.interval,
          method: input.method,
          data: simulateTimeSeries(input.tag, input.startTime, input.endTime, 24),
          source: "simulated",
        };
      }
      try {
        const res = await rtdipFetch("/rtdip/resample", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        return {
          tag: input.tag,
          interval: input.interval,
          method: input.method,
          data: simulateTimeSeries(input.tag, input.startTime, input.endTime, 24),
          source: "simulated",
        };
      }
    }),

  /**
   * Get the latest value for one or more tags.
   */
  getLatest: protectedProcedure
    .input(
      z.object({
        tags: z.array(z.string()).min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      if (!RTDIP_ENABLED) {
        return {
          values: input.tags.map((tag) => ({
            tag,
            value: simulateTWA(tag, new Date().toISOString(), new Date().toISOString()),
            timestamp: new Date().toISOString(),
            quality: 192,
          })),
          source: "simulated",
        };
      }
      try {
        const res = await rtdipFetch("/rtdip/latest", {
          method: "POST",
          body: JSON.stringify({ tags: input.tags }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        return {
          values: input.tags.map((tag) => ({
            tag,
            value: simulateTWA(tag, new Date().toISOString(), new Date().toISOString()),
            timestamp: new Date().toISOString(),
            quality: 192,
          })),
          source: "simulated",
        };
      }
    }),

  /**
   * Browse available OPC-UA tags in the Delta Lakehouse.
   */
  getTags: protectedProcedure
    .input(
      z.object({
        wellId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
      })
    )
    .query(async ({ input }) => {
      if (!RTDIP_ENABLED) {
        const wellPrefix = input.wellId ? `${input.wellId}.` : "W-001.";
        const tags = [
          "WELLHEAD_PRESSURE", "TUBING_TEMP", "CASING_PRESSURE",
          "CHOKE_POSITION", "GAS_RATE", "OIL_RATE", "WATER_RATE",
          "BOTTOM_HOLE_PRESSURE", "FLOW_RATE", "SEPARATOR_PRESSURE",
        ].map((t) => ({
          tag: `${wellPrefix}${t}`,
          description: t.replace(/_/g, " ").toLowerCase(),
          unit: t.includes("PRESSURE") ? "psi" : t.includes("TEMP") ? "°F" : t.includes("RATE") ? "bbl/d" : "%",
          dataType: "float64",
        }));
        const filtered = input.search
          ? tags.filter((t) => t.tag.toLowerCase().includes(input.search!.toLowerCase()))
          : tags;
        return { tags: filtered.slice(0, input.limit), total: filtered.length, source: "simulated" };
      }
      try {
        const params = new URLSearchParams();
        if (input.wellId) params.set("wellId", input.wellId);
        if (input.search) params.set("search", input.search);
        params.set("limit", String(input.limit));
        const res = await rtdipFetch(`/rtdip/tags?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        return { tags: [], total: 0, source: "unavailable" };
      }
    }),

  /**
   * Get RTDIP API health and ingestion stats.
   */
  getStatus: protectedProcedure.query(async () => {
    if (!RTDIP_ENABLED) {
      return {
        healthy: false,
        mode: "disabled",
        ingestionRate: 0,
        tagCount: 0,
        deltaTablePath: "N/A",
      };
    }
    try {
      const res = await rtdipFetch("/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Record<string, unknown>;
      return { healthy: true, mode: "rtdip", ...data };
    } catch {
      return {
        healthy: false,
        mode: "unavailable",
        ingestionRate: 0,
        tagCount: 0,
        deltaTablePath: "N/A",
      };
    }
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// LAKEHOUSE EXTENSION: Rust DataFusion + Python Sedona + DuckDB
// ─────────────────────────────────────────────────────────────────────────────

const DATAFUSION_URL = process.env.DATAFUSION_URL ?? "http://localhost:4004";
const ANALYTICS_URL  = process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:8085";

async function datafusionFetch(path: string, body?: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${DATAFUSION_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`DataFusion HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

async function analyticsFetch(path: string, body?: unknown): Promise<unknown> {
  try {
    const res = await fetch(`${ANALYTICS_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Analytics HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export const lakehouseExtRouter = router({

  /** Rust DataFusion: run an ad-hoc SQL query against the in-process DataFusion engine */
  datafusionQuery: protectedProcedure
    .input(z.object({
      sql: z.string().min(1).max(4000),
      limit: z.number().int().min(1).max(10_000).default(500),
    }))
    .mutation(async ({ input }) => {
      const result = await datafusionFetch("/query", { sql: input.sql, limit: input.limit });
      if (!result) {
        return {
          columns: ["well_id", "avg_pressure_psi", "avg_temp_f", "record_count"],
          rows: [["W-001", 2847.3, 185.2, 1440], ["W-002", 3102.8, 192.7, 1440], ["W-003", 2654.1, 178.9, 1438]],
          rowCount: 3, executionMs: 0, source: "simulated",
        };
      }
      return { ...(result as Record<string, unknown>), source: "datafusion" };
    }),

  /** Rust DataFusion: list available Iceberg tables in the catalog */
  icebergCatalog: protectedProcedure
    .query(async () => {
      const result = await datafusionFetch("/catalog");
      if (!result) {
        return {
          tables: [
            { name: "well_telemetry",     rowCount: 8_640_000, sizeBytes: 524_288_000, partitionedBy: "well_id, date",   lastUpdated: new Date().toISOString() },
            { name: "production_daily",   rowCount: 365_000,   sizeBytes:  12_582_912, partitionedBy: "field_id, year",  lastUpdated: new Date().toISOString() },
            { name: "alarm_events",       rowCount: 250_000,   sizeBytes:   8_388_608, partitionedBy: "severity, date",  lastUpdated: new Date().toISOString() },
            { name: "damage_assessments", rowCount: 1_200,     sizeBytes:     524_288, partitionedBy: "country",         lastUpdated: new Date().toISOString() },
            { name: "regulatory_reports", rowCount: 4_800,     sizeBytes:   2_097_152, partitionedBy: "authority, year", lastUpdated: new Date().toISOString() },
          ],
          source: "simulated",
        };
      }
      return { ...(result as Record<string, unknown>), source: "iceberg" };
    }),

  /** Python analytics-service: run a DuckDB SQL query against the lakehouse */
  duckdbQuery: protectedProcedure
    .input(z.object({ sql: z.string().min(1).max(4000) }))
    .mutation(async ({ input }) => {
      const result = await analyticsFetch("/duckdb/query", { sql: input.sql });
      if (!result) {
        return {
          columns: ["metric", "value"],
          rows: [["total_wells", 42], ["active_alarms", 7], ["avg_production_bpd", 3240]],
          rowCount: 3, executionMs: 0, source: "simulated",
        };
      }
      return { ...(result as Record<string, unknown>), source: "duckdb" };
    }),

  /** Python analytics-service (Apache Sedona): spatial proximity query */
  sedonaProximityQuery: protectedProcedure
    .input(z.object({
      lat: z.number(),
      lng: z.number(),
      radiusKm: z.number().min(0.1).max(500).default(50),
      assetType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const result = await analyticsFetch("/geospatial/proximity", {
        lat: input.lat, lng: input.lng, radius_km: input.radiusKm, asset_type: input.assetType,
      });
      if (!result) return { features: [], totalFound: 0, radiusKm: input.radiusKm, source: "simulated" };
      return { ...(result as Record<string, unknown>), source: "sedona" };
    }),

  /** Python analytics-service (Apache Sedona): damage heat-map data */
  sedonaDamageHeatmap: protectedProcedure
    .input(z.object({
      country: z.string().optional(),
      classification: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const result = await analyticsFetch("/geospatial/damage-heatmap", {
        country: input.country, classification: input.classification,
      });
      if (!result) {
        return {
          points: [
            { lat: 33.3, lng: 44.4, weight: 5, label: "Rumaila Field, Iraq" },
            { lat: 30.5, lng: 47.8, weight: 4, label: "Zubair Field, Iraq" },
            { lat: 29.9, lng: 48.1, weight: 3, label: "West Qurna, Iraq" },
          ],
          source: "simulated",
        };
      }
      return { ...(result as Record<string, unknown>), source: "sedona" };
    }),

  /** Analytics service health */
  analyticsHealth: protectedProcedure.query(async () => {
    const result = await analyticsFetch("/health");
    if (!result) return { healthy: false, mode: "offline", services: { duckdb: false, sedona: false } };
    return { healthy: true, mode: "live", ...(result as Record<string, unknown>) };
  }),

  /** DataFusion service health */
  datafusionHealth: protectedProcedure.query(async () => {
    const result = await datafusionFetch("/health");
    if (!result) return { healthy: false, mode: "offline", version: "N/A" };
    return { healthy: true, mode: "live", ...(result as Record<string, unknown>) };
  }),
});
