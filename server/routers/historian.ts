import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { historianStreams, telemetryReadings, type HistorianStream } from "../../drizzle/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Map tag suffix → telemetry_readings column name
const TAG_COLUMN_MAP: Record<string, string> = {
  TUBING_PRESSURE: "tubing_pressure",
  CASING_PRESSURE: "casing_pressure",
  FLOW_RATE: "flow_rate",
  WATER_CUT: "water_cut",
  GAS_OIL_RATIO: "gas_oil_ratio",
  ESP_CURRENT: "esp_current",
  ESP_FREQUENCY: "esp_frequency",
  ESP_VIBRATION: "esp_vibration",
  ESP_MOTOR_TEMP: "esp_motor_temp",
  ESP_INLET_PRESSURE: "esp_inlet_pressure",
  ESP_DISCHARGE_PRESSURE: "esp_discharge_pressure",
  WELLHEAD_TEMP: "wellhead_temp",
  CHOKE_POSITION: "choke_position",
  OIL_RATE: "oil_rate",
  GAS_RATE: "gas_rate",
  WATER_RATE: "water_rate",
  GOR: "gor",
  BHP: "bhp",
  DOWNHOLE_TEMP: "bht",
};



export const historianRouter = router({
  // ── Stream Registry ───────────────────────────────────────────────────
  listStreams: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      isActive: z.boolean().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(historianStreams).orderBy(historianStreams.tagName);
      let filtered: HistorianStream[] = rows;
      if (input?.wellId) { const w = input.wellId; filtered = filtered.filter((r: HistorianStream) => r.wellId === w); }
      if (input?.isActive !== undefined) { const a = input.isActive; filtered = filtered.filter((r: HistorianStream) => r.isActive === a); }
      if (input?.search) { const q = input.search.toLowerCase(); filtered = filtered.filter((r: HistorianStream) => r.tagName.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)); }
      return filtered;
    }),

  getStream: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(historianStreams).where(eq(historianStreams.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createStream: adminProcedure
    .input(z.object({
      tagName: z.string().min(1),
      wellId: z.string().optional(),
      deviceId: z.string().optional(),
      description: z.string().optional(),
      engineeringUnit: z.string().optional(),
      dataType: z.string().default("float"),
      sampleRateHz: z.number().positive().default(1.0),
      compressionEnabled: z.boolean().default(true),
      compressionDeviation: z.number().default(0.1),
      retentionDays: z.number().int().positive().default(730),
      questdbTable: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(historianStreams).values({
        ...input,
        isActive: true,
        createdAt: new Date(),
      }).returning();
      return row;
    }),

  updateStream: adminProcedure
    .input(z.object({
      id: z.number(),
      description: z.string().optional(),
      sampleRateHz: z.number().optional(),
      compressionEnabled: z.boolean().optional(),
      compressionDeviation: z.number().optional(),
      retentionDays: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(historianStreams)
        .set(data)
        .where(eq(historianStreams.id, id))
        .returning();
      return row;
    }),

  deleteStream: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(historianStreams).where(eq(historianStreams.id, input.id));
      return { success: true };
    }),

  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, active: 0, byDataType: {}, totalRetentionDays: 0 };
    const streams = await db.select().from(historianStreams);
    const total = streams.length;
    const active = streams.filter((s: HistorianStream) => s.isActive).length;
    const byDataType: Record<string, number> = {};
    for (const s of streams) {
      byDataType[s.dataType] = (byDataType[s.dataType] || 0) + 1;
    }
    const totalRetentionDays = streams.reduce((sum: number, s: HistorianStream) => sum + s.retentionDays, 0);
    return { total, active, byDataType, totalRetentionDays };
  }),

  // ── Time-series query — backed by telemetry_readings, deterministic fallback ──
  queryTimeSeries: protectedProcedure
    .input(z.object({
      tagName: z.string(),
      fromTs: z.number(),
      toTs: z.number(),
      resolution: z.enum(["raw", "1m", "5m", "1h", "1d"]).default("1h"),
    }))
    .query(async ({ input }) => {
      const { tagName, fromTs, toTs, resolution } = input;
      const db = await getDb();

      // Parse "WELL-001.TUBING_PRESSURE" → wellId="WELL-001", metric="TUBING_PRESSURE"
      const dotIdx = tagName.indexOf(".");
      const wellId = dotIdx > 0 ? tagName.slice(0, dotIdx) : tagName;
      const metric = dotIdx > 0 ? tagName.slice(dotIdx + 1).toUpperCase() : "TUBING_PRESSURE";
      const column = TAG_COLUMN_MAP[metric] ?? "tubing_pressure";

      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db.select({
        ts: telemetryReadings.recordedAt,
        value: sql<number>`${sql.raw(column)}`,
      }).from(telemetryReadings)
        .where(and(
          eq(telemetryReadings.wellId, wellId),
          gte(telemetryReadings.recordedAt, new Date(fromTs)),
          lte(telemetryReadings.recordedAt, new Date(toTs)),
        ))
        .orderBy(telemetryReadings.recordedAt)
        .limit(1000);

      return {
        tagName,
        resolution,
        points: rows.map(r => ({
          ts: new Date(r.ts).getTime(),
          value: Number(r.value ?? 0),
        })),
        source: "db" as const,
      };
    }),

  // ── Seed default streams ───────────────────────────────────────────────
  seedDefaultStreams: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const defaults = [
      { tagName: "WELL-001.TUBING_PRESSURE", wellId: "WELL-001", description: "Tubing Head Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 1.0 },
      { tagName: "WELL-001.CASING_PRESSURE", wellId: "WELL-001", description: "Casing Head Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 1.0 },
      { tagName: "WELL-001.FLOW_RATE", wellId: "WELL-001", description: "Surface Flow Rate", engineeringUnit: "bbl/d", dataType: "float", sampleRateHz: 0.1 },
      { tagName: "WELL-001.DOWNHOLE_TEMP", wellId: "WELL-001", description: "Downhole Temperature", engineeringUnit: "degF", dataType: "float", sampleRateHz: 0.1 },
      { tagName: "WELL-002.TUBING_PRESSURE", wellId: "WELL-002", description: "Tubing Head Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 1.0 },
      { tagName: "WELL-002.CASING_PRESSURE", wellId: "WELL-002", description: "Casing Head Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 1.0 },
      { tagName: "WELL-002.FLOW_RATE", wellId: "WELL-002", description: "Surface Flow Rate", engineeringUnit: "bbl/d", dataType: "float", sampleRateHz: 0.1 },
      { tagName: "WELL-003.TUBING_PRESSURE", wellId: "WELL-003", description: "Tubing Head Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 1.0 },
      { tagName: "WELL-003.FLOW_RATE", wellId: "WELL-003", description: "Surface Flow Rate", engineeringUnit: "bbl/d", dataType: "float", sampleRateHz: 0.1 },
      { tagName: "FACILITY.GAS_FLOW", wellId: undefined, description: "Facility Gas Flow Rate", engineeringUnit: "MMscfd", dataType: "float", sampleRateHz: 0.5 },
      { tagName: "FACILITY.POWER_DEMAND", wellId: undefined, description: "Total Facility Power Demand", engineeringUnit: "kW", dataType: "float", sampleRateHz: 0.1 },
      { tagName: "SEPARATOR.INLET_PRESSURE", wellId: undefined, description: "Separator Inlet Pressure", engineeringUnit: "psi", dataType: "float", sampleRateHz: 1.0 },
    ];
    for (const d of defaults) {
      await db.insert(historianStreams).values({
        ...d,
        compressionEnabled: true,
        compressionDeviation: 0.1,
        retentionDays: 730,
        isActive: true,
        createdAt: new Date(),
      }).onConflictDoNothing();
    }
    return { seeded: defaults.length };
  }),
});
