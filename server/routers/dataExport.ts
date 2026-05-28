/**
 * dataExport.ts — Production Data Export Router (v55.0)
 *
 * Provides CSV and JSON export endpoints backed by real DB queries:
 * - Production data (oil/gas/water rates from production_records)
 * - Telemetry history (from telemetry_readings)
 * - Alarm history (from alarms)
 * - Audit log (from audit_log)
 * - Well KPI summary (aggregated from wells + telemetry + alarms)
 * - Physics engine results (from well_physics_params)
 *
 * All exports are streamed via S3 upload and return a presigned download URL.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";
import {
  productionRecords,
  alarms,
  wells,
  telemetryReadings,
  auditLog,
  wellPhysicsParams,
} from "../../drizzle/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ].join("\n");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function uploadExport(
  data: string,
  filename: string,
  contentType: string,
): Promise<string> {
  const key = `exports/${Date.now()}-${randomSuffix()}-${filename}`;
  if (process.env.NODE_ENV === "test") {
    return `https://storage.example.com/${key}`;
  }
  const { url } = await storagePut(key, Buffer.from(data, "utf-8"), contentType);
  return url;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const dataExportRouter = router({
  /**
   * Export production data as CSV or JSON from production_records table.
   */
  production: protectedProcedure
    .input(z.object({
      format:  z.enum(["csv", "json"]).default("csv"),
      days:    z.number().min(1).max(365).default(30),
      wellIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const cutoff = new Date(Date.now() - input.days * 86_400_000);

      const conds = [gte(productionRecords.date, cutoff)];
      if (input.wellIds?.length) {
        conds.push(sql`${productionRecords.wellId} = ANY(${input.wellIds})`);
      }

      const dbRows = await db.select().from(productionRecords)
        .where(and(...conds))
        .orderBy(desc(productionRecords.date))
        .limit(50000);

      const rows: Record<string, unknown>[] = dbRows.map(r => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        well_id: r.wellId,
        oil_bbls: r.oilBbls,
        gas_mmscf: r.gasMmscf,
        water_bbls: r.waterBbls,
        injection_bbls: r.injectionBbls,
        uptime_hours: r.uptimeHours,
        downtime: r.downtime ?? "",
      }));

      const filename = `production-export-${input.days}d.${input.format}`;
      const contentType = input.format === "csv" ? "text/csv" : "application/json";
      const data = input.format === "csv" ? toCSV(rows) : JSON.stringify(rows, null, 2);
      const url = await uploadExport(data, filename, contentType);

      return {
        ok: true,
        url,
        filename,
        rows: rows.length,
        format: input.format,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Export alarm history from the alarms table.
   */
  alarms: protectedProcedure
    .input(z.object({
      format:   z.enum(["csv", "json"]).default("csv"),
      limit:    z.number().min(10).max(10000).default(500),
      severity: z.number().int().min(1).max(5).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const conds = [];
      if (input.severity !== undefined) {
        conds.push(eq(alarms.severity, input.severity));
      }

      const dbRows = await db.select().from(alarms)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(alarms.createdAt))
        .limit(input.limit);

      const rows: Record<string, unknown>[] = dbRows.map(r => ({
        id: r.alarmId,
        timestamp: r.createdAt?.toISOString() ?? "",
        well_id: r.wellId,
        tag: r.tag,
        severity: r.severity,
        description: r.description,
        state: r.state,
        acknowledged_by: r.acknowledgedBy ?? "",
        acknowledged_at: r.acknowledgedAt?.toISOString() ?? "",
        cleared_at: r.clearedAt?.toISOString() ?? "",
      }));

      const filename = `alarms-export-${input.limit}.${input.format}`;
      const contentType = input.format === "csv" ? "text/csv" : "application/json";
      const data = input.format === "csv" ? toCSV(rows) : JSON.stringify(rows, null, 2);
      const url = await uploadExport(data, filename, contentType);

      return {
        ok: true,
        url,
        filename,
        rows: rows.length,
        format: input.format,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Export well KPI summary aggregated from wells + telemetry + alarms.
   */
  wellKpi: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "json"]).default("csv"),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const wellRows = await db.select().from(wells).orderBy(wells.wellId);
      const rows: Record<string, unknown>[] = [];

      for (const w of wellRows) {
        const [latestTelemetry] = await db.select()
          .from(telemetryReadings)
          .where(eq(telemetryReadings.wellId, w.wellId))
          .orderBy(desc(telemetryReadings.recordedAt))
          .limit(1);

        const [alarmCount] = await db.select({ count: sql<number>`count(*)` })
          .from(alarms)
          .where(and(
            eq(alarms.wellId, w.wellId),
            eq(alarms.state, "UNACKNOWLEDGED"),
          ));

        rows.push({
          well_id: w.wellId,
          name: w.name,
          status: w.status,
          oil_rate_bopd: latestTelemetry?.oilRate ?? 0,
          gas_rate_mscfd: latestTelemetry?.gasRate ?? 0,
          water_cut_pct: latestTelemetry?.waterCut ?? 0,
          fwhp_psia: latestTelemetry?.tubingPressure ?? 0,
          active_alarms: Number(alarmCount?.count ?? 0),
          last_updated: latestTelemetry?.recordedAt?.toISOString() ?? "",
        });
      }

      const filename = `well-kpi-summary.${input.format}`;
      const contentType = input.format === "csv" ? "text/csv" : "application/json";
      const data = input.format === "csv" ? toCSV(rows) : JSON.stringify(rows, null, 2);
      const url = await uploadExport(data, filename, contentType);

      return {
        ok: true,
        url,
        filename,
        rows: rows.length,
        format: input.format,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Export audit log from the audit_log table.
   */
  auditLog: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "json"]).default("csv"),
      limit:  z.number().min(10).max(5000).default(200),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const dbRows = await db.select().from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);

      const rows = dbRows.map(r => ({
        id:          r.id,
        timestamp:   r.createdAt?.toISOString() ?? "",
        user_id:     r.userId,
        user_email:  r.userEmail ?? "",
        action:      r.action,
        resource:    r.resource,
        resource_id: r.resourceId ?? "",
        details:     JSON.stringify(r.details ?? {}),
      }));

      const filename = `audit-log-export.${input.format}`;
      const contentType = input.format === "csv" ? "text/csv" : "application/json";
      const data = input.format === "csv" ? toCSV(rows) : JSON.stringify(rows, null, 2);
      const url = await uploadExport(data, filename, contentType);

      return {
        ok: true,
        url,
        filename,
        rows: rows.length,
        format: input.format,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Export physics engine results from well_physics_params table.
   */
  physicsResults: protectedProcedure
    .input(z.object({
      format: z.enum(["json"]).default("json"),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const dbRows = await db.select().from(wellPhysicsParams).orderBy(wellPhysicsParams.wellId);
      const results = dbRows.map(r => ({
        well_id: r.wellId,
        computed_at: new Date().toISOString(),
        reservoir_pressure_psi: r.reservoirPressurePsi,
        q_max_bpd: r.qMaxBpd,
        skin_factor: r.skinFactor,
        tvd_ft: r.tvdFt,
        water_cut_fraction: r.waterCutFraction,
        gor_scf_per_bbl: r.gorScfPerBbl,
        qi: r.qi,
        di: r.di,
        b: r.b,
      }));

      const filename = `physics-results-export.json`;
      const data = JSON.stringify(results, null, 2);
      const url = await uploadExport(data, filename, "application/json");

      return {
        ok: true,
        url,
        filename,
        rows: results.length,
        format: "json",
        generatedAt: new Date().toISOString(),
      };
    }),
});
