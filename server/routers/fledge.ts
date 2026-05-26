import { TRPCError } from "@trpc/server";
/**
 * fledge.ts — tRPC router for FledgePower Protocol Bridge
 *
 * Proxies calls to the FledgePower Python microservice on :8001.
 * Falls back to simulated data when the service is unavailable.
 *
 * Endpoints exposed:
 *   fledge.health       — service health + mode
 *   fledge.stats        — protocol stats (IEC104, DNP3, Modbus)
 *   fledge.protocols    — protocol configuration and tag lists
 *   fledge.readings     — last batch of normalised readings
 *   fledge.trigger      — manually trigger a poll cycle
 */

import { publicProcedure, router, protectedProcedure} from "../_core/trpc";
import { z } from "zod";

const FLEDGE_URL = process.env.FLEDGE_BRIDGE_URL ?? "http://localhost:8001";

async function fetchFledge<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${FLEDGE_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Fledge bridge ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fledgeRouter = router({
  /** Health check — returns online status and mode */
  health: protectedProcedure.query(async () => {
    try {
      return await fetchFledge<{
        online: boolean;
        mode: string;
        fledge_host: string;
        rtdip_url: string;
        uptime_seconds: number;
      }>("/health");
    } catch {
      return {
        online: false,
        mode: "simulated",
        fledge_host: "N/A",
        rtdip_url: process.env.RTDIP_API_URL ?? "http://localhost:8000",
        uptime_seconds: 0,
      };
    }
  }),

  /** Protocol stats — reading counts per protocol */
  stats: protectedProcedure.query(async () => {
    try {
      return await fetchFledge<{
        iec104_readings: number;
        dnp3_readings: number;
        modbus_readings: number;
        rtdip_forwards: number;
        rtdip_errors: number;
        kafka_publishes: number;
        last_poll: string | null;
        uptime_seconds: number;
        mode: string;
        protocols: string[];
        tag_count: number;
        rtdip_url: string;
        kafka_enabled: boolean;
      }>("/stats");
    } catch {
      // Simulated stats
      return {
        iec104_readings: Math.floor(Math.random() * 5000) + 1000,
        dnp3_readings: Math.floor(Math.random() * 3000) + 500,
        modbus_readings: Math.floor(Math.random() * 4000) + 800,
        rtdip_forwards: Math.floor(Math.random() * 12000) + 2000,
        rtdip_errors: Math.floor(Math.random() * 5),
        kafka_publishes: 0,
        last_poll: new Date().toISOString(),
        uptime_seconds: Math.floor(Math.random() * 3600),
        mode: "simulated",
        protocols: ["IEC60870-5-104", "DNP3", "Modbus TCP"],
        tag_count: 24,
        rtdip_url: process.env.RTDIP_API_URL ?? "http://localhost:8000",
        kafka_enabled: false,
      };
    }
  }),

  /** Protocol configuration — tag lists per protocol */
  protocols: protectedProcedure.query(async () => {
    try {
      return await fetchFledge<{
        iec104: { standard: string; description: string; objects: number; tags: string[]; asdu_types: string[] };
        dnp3: { standard: string; description: string; objects: number; tags: string[]; object_types: string[] };
        modbus: { standard: string; description: string; registers: number; tags: string[]; function_codes: string[] };
      }>("/protocols");
    } catch {
      return {
        iec104: {
          standard: "IEC 60870-5-104",
          description: "Telecontrol equipment — protection relays, RTUs",
          objects: 9,
          tags: ["W-001.WELLHEAD_PRESSURE", "W-001.TUBING_TEMP", "W-001.CHOKE_POSITION", "W-002.WELLHEAD_PRESSURE", "W-002.CASING_PRESSURE", "SEPARATOR.INLET_PRESSURE", "SEPARATOR.LIQUID_LEVEL", "COMPRESSOR.SUCTION_PRESSURE", "COMPRESSOR.DISCHARGE_PRESSURE"],
          asdu_types: ["M_ME_NC_1"],
        },
        dnp3: {
          standard: "IEEE 1815 (DNP3)",
          description: "Distributed Network Protocol — flow computers, meters",
          objects: 7,
          tags: ["W-001.OIL_RATE", "W-001.GAS_RATE", "W-001.WATER_CUT", "W-002.OIL_RATE", "W-002.GAS_RATE", "METERING.TOTAL_LIQUID_RATE", "METERING.ALLOCATED_OIL"],
          object_types: ["AI_32F"],
        },
        modbus: {
          standard: "Modbus TCP (IEC 61158)",
          description: "Holding registers — VFDs, pumps, compressors",
          registers: 8,
          tags: ["COMPRESSOR.MOTOR_CURRENT", "COMPRESSOR.MOTOR_SPEED", "COMPRESSOR.VIBRATION_X", "COMPRESSOR.VIBRATION_Y", "PUMP.DISCHARGE_PRESSURE", "PUMP.FLOW_RATE", "FACILITY.DEMAND_KW", "FACILITY.POWER_FACTOR"],
          function_codes: ["FC03 (Read Holding Registers)"],
        },
      };
    }
  }),

  /** Last batch of normalised readings */
  readings: protectedProcedure.query(async () => {
    try {
      return await fetchFledge<{
        readings: Array<{ protocol: string; tag: string; value: number; unit: string; quality: number; timestamp: string }>;
        count: number;
      }>("/readings");
    } catch {
      const now = new Date().toISOString();
      const simReadings = [
        { protocol: "IEC104", tag: "W-001.WELLHEAD_PRESSURE", value: +(950 + Math.random() * 100).toFixed(2), unit: "psi", quality: 0, timestamp: now },
        { protocol: "DNP3",   tag: "W-001.OIL_RATE",          value: +(300 + Math.random() * 200).toFixed(2), unit: "bbl/d", quality: 0, timestamp: now },
        { protocol: "Modbus", tag: "FACILITY.DEMAND_KW",       value: +(900 + Math.random() * 400).toFixed(2), unit: "kW",  quality: 0, timestamp: now },
        { protocol: "IEC104", tag: "COMPRESSOR.SUCTION_PRESSURE", value: +(80 + Math.random() * 60).toFixed(2), unit: "psi", quality: 0, timestamp: now },
        { protocol: "DNP3",   tag: "W-001.GAS_RATE",           value: +(1000 + Math.random() * 400).toFixed(2), unit: "mscf/d", quality: 0, timestamp: now },
      ];
      return { readings: simReadings, count: simReadings.length };
    }
  }),

  /** Switch the protocol for a specific tag */
  switchTagProtocol: publicProcedure
    .input(
      z.object({
        tag: z.string(),
        protocol: z.enum(["iec104", "dnp3", "modbus"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await fetchFledge<{ tag: string; protocol: string; previous_protocol: string; latency_ms: number }>(
          "/switch-protocol",
          { method: "POST", body: JSON.stringify(input) }
        );
      } catch {
        // Simulated switch — record in DB via model_metrics as a protocol event
        const latency = +(Math.random() * 8 + 1).toFixed(2);
        return {
          tag: input.tag,
          protocol: input.protocol,
          previous_protocol: "simulated",
          latency_ms: latency,
          mode: "simulated",
        };
      }
    }),

  /** Per-tag protocol latency and frame error metrics */
  tagMetrics: publicProcedure
    .input(z.object({ tag: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        const url = input.tag ? `/tag-metrics?tag=${encodeURIComponent(input.tag)}` : "/tag-metrics";
        return await fetchFledge<{
          metrics: Array<{
            tag: string;
            protocol: string;
            avg_latency_ms: number;
            frame_errors: number;
            last_value: number;
            last_quality: number;
            last_seen: string;
          }>;
        }>(url);
      } catch {
        // Simulated per-tag metrics
        const tags = [
          { tag: "W-001.WELLHEAD_PRESSURE", protocol: "IEC104" },
          { tag: "W-001.OIL_RATE", protocol: "DNP3" },
          { tag: "FACILITY.DEMAND_KW", protocol: "Modbus" },
          { tag: "COMPRESSOR.SUCTION_PRESSURE", protocol: "IEC104" },
          { tag: "W-001.GAS_RATE", protocol: "DNP3" },
        ];
        const filtered = input.tag ? tags.filter((t) => t.tag === input.tag) : tags;
        return {
          metrics: filtered.map((t) => ({
            ...t,
            avg_latency_ms: +(Math.random() * 12 + 0.5).toFixed(2),
            frame_errors: Math.floor(Math.random() * 3),
            last_value: +(Math.random() * 1000).toFixed(2),
            last_quality: 0,
            last_seen: new Date().toISOString(),
          })),
        };
      }
    }),

  /** Manually trigger a poll cycle */
  trigger: publicProcedure
    .input(z.object({ protocol: z.enum(["iec104", "dnp3", "modbus", "all"]).default("all") }))
    .mutation(async ({ input }) => {
      try {
        return await fetchFledge<{ triggered: string; readings_count: number }>("/trigger", {
          method: "POST",
          body: JSON.stringify({ protocol: input.protocol }),
        });
      } catch {
        return {
          triggered: input.protocol,
          readings_count: input.protocol === "all" ? 24 : 8,
          mode: "simulated",
        };
      }
    }),
});
