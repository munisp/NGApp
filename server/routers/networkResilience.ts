// @ts-nocheck
// Network Resilience Router — Sprint 76
// Connection quality monitoring, adaptive protocol switching, offline queue management
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

type ConnectionMode = "websocket" | "sse" | "long-poll" | "offline";
type BandwidthTier = "high" | "medium" | "low" | "minimal";

interface AgentConnection {
  agentId: string;
  mode: ConnectionMode;
  bandwidthTier: BandwidthTier;
  bandwidthKbps: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPct: number;
  lastSeen: number;
  reconnects: number;
  queuedMsgs: number;
  region: string;
  carrier: string;
}

const connections = new Map<string, AgentConnection>();

function determineMode(bw: number, latency: number, _jitter: number, loss: number): ConnectionMode {
  if (bw < 50 || loss > 30) return "offline";
  if (bw < 100 || loss > 15 || latency > 800) return "long-poll";
  if (bw < 500 || loss > 5 || latency > 400) return "sse";
  return "websocket";
}

function determineTier(bw: number): BandwidthTier {
  if (bw >= 2000) return "high";
  if (bw >= 500) return "medium";
  if (bw >= 100) return "low";
  return "minimal";
}

export const networkResilienceRouter = router({
  registerConnection: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      region: z.string(),
      carrier: z.string(),
      bandwidthKbps: z.number(),
      latencyMs: z.number(),
      jitterMs: z.number(),
      packetLossPct: z.number(),
    }))
    .mutation(({ input }) => {
      const mode = determineMode(input.bandwidthKbps, input.latencyMs, input.jitterMs, input.packetLossPct);
      const tier = determineTier(input.bandwidthKbps);
      const existing = connections.get(input.agentId);
      const conn: AgentConnection = {
        agentId: input.agentId,
        mode,
        bandwidthTier: tier,
        bandwidthKbps: input.bandwidthKbps,
        latencyMs: input.latencyMs,
        jitterMs: input.jitterMs,
        packetLossPct: input.packetLossPct,
        lastSeen: Date.now(),
        reconnects: existing ? existing.reconnects + 1 : 0,
        queuedMsgs: existing ? existing.queuedMsgs : 0,
        region: input.region,
        carrier: input.carrier,
      };
      connections.set(input.agentId, conn);
      return conn;
    }),

  getMetrics: protectedProcedure.query(() => {
    let ws = 0, sse = 0, lp = 0, offline = 0, totalLat = 0, totalBw = 0;
    connections.forEach(c => {
      switch (c.mode) {
        case "websocket": ws++; break;
        case "sse": sse++; break;
        case "long-poll": lp++; break;
        case "offline": offline++; break;
      }
      totalLat += c.latencyMs;
      totalBw += c.bandwidthKbps;
    });
    const n = connections.size || 1;
    return {
      totalConnections: connections.size,
      activeWebSocket: ws,
      activeSSE: sse,
      activeLongPoll: lp,
      offlineAgents: offline,
      avgLatencyMs: Math.round(totalLat / n),
      avgBandwidthKbps: Math.round(totalBw / n),
    };
  }),

  getConnections: protectedProcedure
    .input(z.object({ region: z.string().optional() }))
    .query(({ input }) => {
      return input.region ? all.filter(c => c.region === input.region) : all;
    }),

  getConfig: protectedProcedure.query(() => ({
    wsTimeoutMs: 30000,
    sseRetryMs: 5000,
    longPollMs: 10000,
    maxReconnects: 10,
    backoffMultiplier: 1.5,
    maxBackoffMs: 60000,
    offlineQueueMax: 500,
    compressionEnabled: true,
    adaptiveBandwidth: true,
  })),
});
