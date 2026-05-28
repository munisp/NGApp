import { TRPCError } from "@trpc/server";
/**
 * server/routers/streaming.ts — tRPC router for Kafka/Fluvio streaming
 *
 * Exposes Kafka broker health, topic stats, consumer lag, and the ability
 * to publish sensor readings from the Node.js layer to Kafka.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getKafkaStats,
  isWorkerHealthy,
  getWorkerStatus,
  publishSensorReading,
  publishAlarmEvent,
} from "../kafkaClient";
import { ENV } from "../_core/env";

// ─── Exported helpers for testing ───────────────────────────────────────────

export function getKafkaTopics() {
  return [
    { name: "og.telemetry.raw", partitions: 6, retention: "7d", description: "Well sensor telemetry (raw OPC-UA)" },
    { name: "og.alarms.events", partitions: 3, retention: "30d", description: "All alarm events" },
    { name: "og.alarms.critical", partitions: 3, retention: "90d", description: "Critical alarm events (sev ≥ 4)" },
    { name: "og.ptw.events", partitions: 2, retention: "365d", description: "Permit-to-Work lifecycle events" },
    { name: "og.production.records", partitions: 4, retention: "30d", description: "Production allocation records" },
    { name: "og.regulatory.submissions", partitions: 2, retention: "365d", description: "Regulatory submission events" },
    { name: "og.ota.status", partitions: 2, retention: "30d", description: "OTA firmware update status" },
  ];
}

export const streamingRouter = router({
  /**
   * Returns Kafka consumer statistics: messages processed, error count, mode.
   */
  getKafkaStats: protectedProcedure.query(async () => {
    return getKafkaStats();
  }),

  /**
   * Returns full Go worker status including all middleware service health.
   * Used by the Infrastructure page.
   */
  getWorkerStatus: protectedProcedure.query(async () => {
    try {
      const [healthy, status] = await Promise.all([
        isWorkerHealthy(),
        getWorkerStatus(),
      ]);
      return { healthy, ...status };
    } catch (err: unknown) {
      if (err instanceof TRPCError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),

  /**
   * Publish a sensor reading to Kafka from the Node.js layer.
   * Useful for testing and for edge devices that call the tRPC API directly.
   */
  publishSensorReading: protectedProcedure
    .input(
      z.object({
        wellId: z.string(),
        tag: z.string(),
        value: z.number(),
        unit: z.string().default("psi"),
        quality: z.number().int().min(0).max(255).default(192),
      })
    )
    .mutation(async ({ input }) => {
      await publishSensorReading({
        ...input,
        timestamp: new Date(),
      });
      return { published: true, timestamp: new Date() };
    }),

  /**
   * Publish an alarm event to Kafka.
   * Called by the alarms router when a new critical alarm is created.
   */
  publishAlarm: protectedProcedure
    .input(
      z.object({
        alarmId: z.number().int(),
        wellId: z.string(),
        severity: z.number().int().min(1).max(5),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await publishAlarmEvent({
          ...input,
          timestamp: new Date(),
        });
        return { published: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  /**
   * Returns a list of known Kafka topics with simulated partition/offset info.
   * In production this would query the Kafka Admin API via the Go worker.
   */
  getTopics: protectedProcedure.query(async () => {
    const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
    try {
      const res = await fetch(`${WORKER_URL}/v1/kafka/topics`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { topics: Array<{ name: string; partitions: number; retention: string; description: string }>; brokerHealthy: boolean };
      return data;
    } catch (err) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: `Kafka Admin API unavailable: ${err instanceof Error ? err.message : "connection failed"}. Ensure Go worker is running at ${WORKER_URL}`,
      });
    }
  }),

  /**
   * Returns Fluvio streaming status and dual-publish configuration.
   * Shows whether FLUVIO_DUAL_PUBLISH is active and lists all 6 Fluvio topics.
   */
  getFluvioStatus: protectedProcedure.query(async () => {
    try {
      const dualPublish = ENV.fluvioDualPublish;
      const endpoint = ENV.fluvioEndpoint;
  
      // Fluvio topics mirroring Kafka for dual-publish
      const fluvioTopics = [
        { name: "og.field.telemetry.raw", description: "Raw SCADA telemetry from Rust edge agent", producers: ["rust-edge-agent", "emqx-bridge"] },
        { name: "og.field.alarms", description: "Anomaly detection alarms from Rust stream processor", producers: ["rust-stream-processor"] },
        { name: "og.fledge.raw", description: "IEC 104 / DNP3 readings from FledgePOWER bridge", producers: ["fledge-bridge"] },
        { name: "og.emqx.mqtt", description: "MQTT messages from EMQX broker (IoT devices)", producers: ["emqx-bridge"] },
        { name: "og.financial.transactions", description: "TigerBeetle ledger events", producers: ["tigerbeetle-worker"] },
        { name: "og.security.events", description: "Wazuh security events and triage results", producers: ["wazuh-agent", "incident-triage"] },
      ];
  
      let reachable = false;
      let stats = { messagesRouted: 0, topicCount: fluvioTopics.length, producerCount: 0, consumerCount: 0, lagMs: 0 };

      if (dualPublish && endpoint) {
        try {
          const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
          const res = await fetch(`${WORKER_URL}/v1/fluvio/status`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json() as { reachable: boolean; messagesRouted: number; producerCount: number; consumerCount: number; lagMs: number };
            reachable = data.reachable;
            stats = { ...stats, messagesRouted: data.messagesRouted, producerCount: data.producerCount, consumerCount: data.consumerCount, lagMs: data.lagMs };
          }
        } catch { /* Fluvio status unavailable */ }
      }

      return {
        dualPublishEnabled: dualPublish,
        endpoint,
        reachable,
        mode: dualPublish ? (reachable ? "live" : "degraded") : "disabled",
        topics: fluvioTopics,
        stats,
      };
    } catch (err: unknown) {
      if (err instanceof TRPCError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),

  /**
   * Toggle Fluvio dual-publish at runtime (admin only).
   * In production this would update the Go middleware config via its REST API.
   */
  toggleFluvioDualPublish: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const WORKER_URL = process.env.GO_WORKER_URL ?? "http://localhost:8090";
      try {
        const res = await fetch(`${WORKER_URL}/v1/fluvio/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: input.enabled }),
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { success: boolean; dualPublishEnabled: boolean; message: string };
        return data;
      } catch (err) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: `Failed to toggle Fluvio dual-publish: ${err instanceof Error ? err.message : "connection failed"}`,
        });
      }
    }),
});
