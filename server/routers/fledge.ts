/**
 * fledge.ts — tRPC router for FledgePower Protocol Bridge
 *
 * Proxies calls to the FledgePower Python microservice on :8001.
 * Requires the Fledge bridge service to be running.
 *
 * Endpoints exposed:
 *   fledge.health       — service health + mode
 *   fledge.stats        — protocol stats (IEC104, DNP3, Modbus)
 *   fledge.protocols    — protocol configuration and tag lists
 *   fledge.readings     — last batch of normalised readings
 *   fledge.trigger      — manually trigger a poll cycle
 */

import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const FLEDGE_URL = process.env.FLEDGE_BRIDGE_URL ?? "http://localhost:8001";

function serviceError(message: string): TRPCError {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: `Fledge bridge service unavailable: ${message}. Ensure service is running at ${FLEDGE_URL}`,
  });
}

async function fetchFledge<T>(path: string, opts?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${FLEDGE_URL}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Fledge bridge ${path} returned ${res.status}`);
    return res.json() as Promise<T>;
  } catch (err) {
    throw serviceError(err instanceof Error ? err.message : "connection failed");
  }
}

export const fledgeRouter = router({
  health: protectedProcedure.query(async () => {
    return fetchFledge<{
      online: boolean;
      mode: string;
      fledge_host: string;
      rtdip_url: string;
      uptime_seconds: number;
    }>("/health");
  }),

  stats: protectedProcedure.query(async () => {
    return fetchFledge<{
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
  }),

  protocols: protectedProcedure.query(async () => {
    return fetchFledge<{
      iec104: { standard: string; description: string; objects: number; tags: string[]; asdu_types: string[] };
      dnp3: { standard: string; description: string; objects: number; tags: string[]; object_types: string[] };
      modbus: { standard: string; description: string; registers: number; tags: string[]; function_codes: string[] };
    }>("/protocols");
  }),

  readings: protectedProcedure.query(async () => {
    return fetchFledge<{
      readings: Array<{
        protocol: string;
        tag: string;
        value: number;
        unit: string;
        quality: number;
        timestamp: string;
      }>;
      count: number;
      timestamp: string;
    }>("/readings/latest");
  }),

  trigger: protectedProcedure.mutation(async () => {
    return fetchFledge<{ triggered: boolean; message: string }>("/trigger", {
      method: "POST",
    });
  }),

  tagSearch: protectedProcedure
    .input(z.object({
      query: z.string().default(""),
      protocol: z.enum(["IEC104", "DNP3", "Modbus", "ALL"]).default("ALL"),
      limit: z.number().min(1).max(500).default(50),
    }))
    .query(async ({ input }) => {
      const params = new URLSearchParams();
      if (input.query) params.set("q", input.query);
      if (input.protocol !== "ALL") params.set("protocol", input.protocol);
      params.set("limit", String(input.limit));
      return fetchFledge<{
        tags: Array<{ tag: string; protocol: string; description: string; unit: string; lastValue: number | null }>;
        total: number;
      }>(`/tags?${params}`);
    }),

  historicalReadings: protectedProcedure
    .input(z.object({
      tag: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      limit: z.number().min(1).max(10000).default(1000),
    }))
    .query(async ({ input }) => {
      return fetchFledge<{
        tag: string;
        readings: Array<{ timestamp: string; value: number; quality: number }>;
        count: number;
      }>("/readings/history", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }),
});
