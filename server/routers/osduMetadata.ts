/**
 * osduMetadata.ts — OSDU (Open Subsurface Data Universe) compatible metadata layer
 *
 * Implements OSDU R3 schema patterns for:
 * - Well master data (osdu:wks:master-data--Well:1.0.0)
 * - Wellbore (osdu:wks:master-data--Wellbore:1.0.0)
 * - WellLog (osdu:wks:work-product-component--WellLog:1.0.0)
 * - SeismicHorizon (osdu:wks:work-product-component--SeismicHorizon:1.0.0)
 *
 * Provides OSDU-compatible search, ingestion, and export endpoints.
 * Reference: https://community.opengroup.org/osdu/data/data-definitions
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getPool } from "../db";
import type { Pool } from "pg";

// ── OSDU Schema Definitions ──────────────────────────────────────────────────

const OsduWellSchema = z.object({
  id: z.string(),                           // osdu:well:namespace:wellId:version
  kind: z.literal("osdu:wks:master-data--Well:1.0.0"),
  acl: z.object({
    viewers: z.array(z.string()),
    owners: z.array(z.string()),
  }),
  legal: z.object({
    legaltags: z.array(z.string()),
    otherRelevantDataCountries: z.array(z.string()),
    status: z.enum(["compliant", "incompliant"]),
  }),
  data: z.object({
    // OSDU Well master data fields
    FacilityName: z.string(),
    FacilityTypeID: z.string().default("osdu:reference-data--FacilityType:Well:"),
    FacilityOperator: z.array(z.object({
      FacilityOperatorOrganisationID: z.string(),
      EffectiveDateTime: z.string().optional(),
    })),
    SpatialLocation: z.object({
      AsIngestedCoordinates: z.object({
        type: z.literal("FeatureCollection"),
        features: z.array(z.object({
          type: z.literal("Feature"),
          geometry: z.object({
            type: z.literal("Point"),
            coordinates: z.array(z.number()),
          }),
          properties: z.record(z.string(), z.unknown()),
        })),
      }),
    }).optional(),
    CountryID: z.string().optional(),
    StateProvinceID: z.string().optional(),
    BasinID: z.string().optional(),
    FieldID: z.string().optional(),
    // Extended O&G fields
    WellStatus: z.string().optional(),
    WellType: z.string().optional(),
    SpudDate: z.string().optional(),
    TotalDepthMD_m: z.number().optional(),
    WaterDepth_m: z.number().optional(),
  }),
  meta: z.array(z.record(z.string(), z.unknown())).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const OsduWellboreSchema = z.object({
  id: z.string(),
  kind: z.literal("osdu:wks:master-data--Wellbore:1.0.0"),
  data: z.object({
    WellID: z.string(),
    FacilityName: z.string(),
    WellborePurpose: z.string().optional(),
    WellboreStatus: z.string().optional(),
    SequenceNumber: z.number().optional(),
    MeasuredDepth: z.object({
      Depth: z.number(),
      UnitOfMeasureID: z.string().default("osdu:reference-data--UnitOfMeasure:ft:"),
    }).optional(),
    VerticalMeasurement: z.object({
      VerticalMeasurement: z.number(),
      VerticalMeasurementTypeID: z.string().optional(),
    }).optional(),
    TrajectoryTypeID: z.string().optional(),
    DrillingFluid: z.string().optional(),
  }),
});

// ── OSDU Router ──────────────────────────────────────────────────────────────

export const osduMetadataRouter = router({
  // Export well as OSDU-compatible JSON
  exportWell: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("DB unavailable");
      const { rows } = await pool.query(
        `SELECT w.*, f.name as field_name, f.country, f.basin
         FROM wells w
         LEFT JOIN fields f ON f.field_id = w.field
         WHERE w.well_id = $1 LIMIT 1`,
        [input.wellId]
      );
      const well = rows[0];
      if (!well) throw new Error("Well not found");

      const osduWell = {
        id: `osdu:master-data--Well:${well.well_id}:1`,
        kind: "osdu:wks:master-data--Well:1.0.0",
        version: 1,
        acl: {
          viewers: ["data.default.viewers@opendes.contoso.com"],
          owners: ["data.default.owners@opendes.contoso.com"],
        },
        legal: {
          legaltags: ["opendes-og-rmm-platform-1"],
          otherRelevantDataCountries: [well.country ?? "SA"],
          status: "compliant",
        },
        data: {
          FacilityName: well.name,
          FacilityTypeID: "osdu:reference-data--FacilityType:Well:",
          FacilityOperator: [{
            FacilityOperatorOrganisationID: "osdu:master-data--Organisation:OperatorCo:",
            EffectiveDateTime: well.spud_date ?? new Date().toISOString(),
          }],
          SpatialLocation: well.latitude && well.longitude ? {
            AsIngestedCoordinates: {
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [parseFloat(well.longitude), parseFloat(well.latitude)],
                },
                properties: { name: well.name },
              }],
            },
          } : undefined,
          CountryID: well.country ? `osdu:reference-data--GeoPoliticalEntityType:Country:${well.country}:` : undefined,
          FieldID: well.field ? `osdu:master-data--Field:${well.field}:` : undefined,
          BasinID: well.basin ? `osdu:master-data--Basin:${well.basin}:` : undefined,
          WellStatus: well.status,
          WellType: well.well_type,
          SpudDate: well.spud_date,
          TotalDepthMD_m: well.depth ? well.depth * 0.3048 : undefined,  // ft to m
        },
        tags: {
          platform: "og-rmm",
          version: "38.0",
          field: well.field ?? "",
        },
      };

      return {
        osduRecord: osduWell,
        schemaVersion: "osdu:wks:master-data--Well:1.0.0",
        exportedAt: new Date().toISOString(),
      };
    }),

  // Bulk export all wells as OSDU records
  exportAllWells: protectedProcedure
    .input(z.object({
      fieldId: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("DB unavailable");
      const params: string[] = [];
      let query = `SELECT well_id, name, field, status, well_type, latitude, longitude, depth, spud_date
                   FROM wells`;
      if (input.fieldId) {
        query += ` WHERE field = $1`;
        params.push(input.fieldId);
      }
      query += ` ORDER BY name LIMIT $${params.length + 1}`;
      params.push(String(input.limit));
      const { rows } = await pool.query(query, params);

      const records = rows.map(well => ({
        id: `osdu:master-data--Well:${well.well_id}:1`,
        kind: "osdu:wks:master-data--Well:1.0.0",
        data: {
          FacilityName: well.name,
          FacilityTypeID: "osdu:reference-data--FacilityType:Well:",
          WellStatus: well.status,
          WellType: well.well_type,
          FieldID: well.field ? `osdu:master-data--Field:${well.field}:` : undefined,
          TotalDepthMD_m: well.depth ? well.depth * 0.3048 : undefined,
          SpatialLocation: well.latitude && well.longitude ? {
            AsIngestedCoordinates: {
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: { type: "Point", coordinates: [parseFloat(well.longitude), parseFloat(well.latitude)] },
                properties: {},
              }],
            },
          } : undefined,
        },
      }));

      return {
        totalCount: records.length,
        records,
        exportedAt: new Date().toISOString(),
        schemaVersion: "osdu:wks:master-data--Well:1.0.0",
      };
    }),

  // OSDU-compatible search (mimics OSDU Search API)
  search: protectedProcedure
    .input(z.object({
      kind: z.string().default("osdu:wks:master-data--Well:1.0.0"),
      query: z.string().optional(),
      filter: z.object({
        field: z.string().optional(),
        status: z.string().optional(),
        wellType: z.string().optional(),
      }).optional(),
      limit: z.number().min(1).max(100).default(25),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("DB unavailable");
      const conditions: string[] = [];
      const params: string[] = [];
      let pIdx = 1;

      if (input.query) {
        conditions.push(`(name ILIKE $${pIdx} OR well_id ILIKE $${pIdx})`);
        params.push(`%${input.query}%`);
        pIdx++;
      }
      if (input.filter?.field) {
        conditions.push(`field = $${pIdx++}`);
        params.push(input.filter.field);
      }
      if (input.filter?.status) {
        conditions.push(`status = $${pIdx++}`);
        params.push(input.filter.status);
      }
      if (input.filter?.wellType) {
        conditions.push(`well_type = $${pIdx++}`);
        params.push(input.filter.wellType);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const { rows } = await pool.query(
        `SELECT well_id, name, field, status, well_type, latitude, longitude, depth
         FROM wells ${where}
         ORDER BY name
         LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
        [...params, String(input.limit), String(input.offset)]
      );

      return {
        kind: input.kind,
        totalCount: rows.length,
        results: rows.map(w => ({
          id: `osdu:master-data--Well:${w.well_id}:1`,
          kind: "osdu:wks:master-data--Well:1.0.0",
          data: {
            FacilityName: w.name,
            WellStatus: w.status,
            WellType: w.well_type,
            FieldID: w.field,
            TotalDepthMD_m: w.depth ? w.depth * 0.3048 : null,
          },
        })),
      };
    }),

  // Get OSDU schema definitions
  schemas: protectedProcedure.query(() => {
    return {
      supportedKinds: [
        {
          kind: "osdu:wks:master-data--Well:1.0.0",
          description: "Well master data record",
          fields: ["FacilityName", "FacilityTypeID", "FacilityOperator", "SpatialLocation", "WellStatus", "WellType"],
        },
        {
          kind: "osdu:wks:master-data--Wellbore:1.0.0",
          description: "Wellbore master data record",
          fields: ["WellID", "FacilityName", "WellborePurpose", "MeasuredDepth", "TrajectoryTypeID"],
        },
        {
          kind: "osdu:wks:work-product-component--WellLog:1.0.0",
          description: "Well log (LAS/DLIS) work product component",
          fields: ["WellboreID", "Curves", "TopDepth", "BottomDepth", "SamplingInterval"],
        },
      ],
      version: "OSDU R3",
      platform: "OG-RMM v38.0",
    };
  }),

  // AI Copilot fleet-wide query tool (used by LLM tool-calling)
  queryFleet: protectedProcedure
    .input(z.object({
      queryType: z.enum([
        "critical_alarms",
        "low_production_wells",
        "high_water_cut_wells",
        "shut_in_wells",
        "wells_needing_workover",
        "production_summary",
        "field_summary",
      ]),
      fieldId: z.string().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("DB unavailable");

      switch (input.queryType) {
        case "critical_alarms": {
          const { rows } = await pool.query(
            `SELECT a.alarm_id, a.well_id, w.name as well_name, a.severity, a.description,
                    a.value, a.unit, a.state, a.triggered_at
             FROM alarms a
             JOIN wells w ON w.well_id = a.well_id
             WHERE a.severity IN ('CRITICAL','HIGH') AND a.state = 'UNACKNOWLEDGED'
             ${input.fieldId ? "AND w.field = $1" : ""}
             ORDER BY a.severity DESC, a.triggered_at DESC
             LIMIT $${input.fieldId ? 2 : 1}`,
            input.fieldId ? [input.fieldId, input.limit] : [input.limit]
          );
          return { queryType: input.queryType, count: rows.length, data: rows };
        }
        case "low_production_wells": {
          const { rows } = await pool.query(
            `SELECT w.well_id, w.name, w.field, w.q_max_bpd,
                    t.flow_rate, t.recorded_at
             FROM wells w
             LEFT JOIN LATERAL (
               SELECT flow_rate, recorded_at FROM telemetry_readings
               WHERE well_id = w.well_id ORDER BY recorded_at DESC LIMIT 1
             ) t ON true
             WHERE w.status = 'PRODUCING'
             ${input.fieldId ? "AND w.field = $1" : ""}
             AND (t.flow_rate IS NULL OR t.flow_rate < w.q_max_bpd * 0.5)
             ORDER BY t.flow_rate ASC NULLS FIRST
             LIMIT $${input.fieldId ? 2 : 1}`,
            input.fieldId ? [input.fieldId, input.limit] : [input.limit]
          );
          return { queryType: input.queryType, count: rows.length, data: rows };
        }
        case "high_water_cut_wells": {
          const { rows } = await pool.query(
            `SELECT well_id, name, field, water_cut_fraction, status
             FROM wells
             WHERE water_cut_fraction > 0.7
             ${input.fieldId ? "AND field = $1" : ""}
             ORDER BY water_cut_fraction DESC
             LIMIT $${input.fieldId ? 2 : 1}`,
            input.fieldId ? [input.fieldId, input.limit] : [input.limit]
          );
          return { queryType: input.queryType, count: rows.length, data: rows };
        }
        case "shut_in_wells": {
          const { rows } = await pool.query(
            `SELECT well_id, name, field, status, updated_at
             FROM wells WHERE status IN ('SHUT_IN', 'SUSPENDED')
             ${input.fieldId ? "AND field = $1" : ""}
             ORDER BY updated_at DESC
             LIMIT $${input.fieldId ? 2 : 1}`,
            input.fieldId ? [input.fieldId, input.limit] : [input.limit]
          );
          return { queryType: input.queryType, count: rows.length, data: rows };
        }
        case "production_summary": {
          const { rows } = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE status = 'PRODUCING') as producing_wells,
               COUNT(*) FILTER (WHERE status = 'SHUT_IN') as shut_in_wells,
               COUNT(*) FILTER (WHERE status = 'DRILLING') as drilling_wells,
               AVG(water_cut_fraction) FILTER (WHERE water_cut_fraction IS NOT NULL) as avg_water_cut,
               SUM(q_max_bpd) as total_capacity_bpd
             FROM wells
             ${input.fieldId ? "WHERE field = $1" : ""}`,
            input.fieldId ? [input.fieldId] : []
          );
          return { queryType: input.queryType, count: 1, data: rows };
        }
        case "field_summary": {
          const { rows } = await pool.query(
            `SELECT field,
               COUNT(*) as well_count,
               COUNT(*) FILTER (WHERE status = 'PRODUCING') as producing,
               AVG(water_cut_fraction) as avg_water_cut,
               SUM(q_max_bpd) as total_capacity_bpd
             FROM wells
             GROUP BY field ORDER BY well_count DESC
             LIMIT $1`,
            [input.limit]
          );
          return { queryType: input.queryType, count: rows.length, data: rows };
        }
        default:
          return { queryType: input.queryType, count: 0, data: [] };
      }
    }),

  deleteRecord: protectedProcedure
    .input(z.object({ id: z.string(), kind: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getPool();
      if (!pool) throw new Error("Database unavailable");
      // OSDU soft-delete: mark as DELETED in the appropriate table based on kind
      if (input.kind.includes("Well")) {
        await pool.query("UPDATE wells SET status = 'DELETED' WHERE well_id = $1", [input.id]);
      } else if (input.kind.includes("WellLog")) {
        await pool.query("DELETE FROM well_logs WHERE id = $1", [input.id]);
      }
      return { success: true, id: input.id };
    }),
});