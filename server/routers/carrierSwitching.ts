// @ts-nocheck
/**
 * Carrier Switching Router — Sprint 75
 * Manages carrier signal monitoring, ranking, auto-switch recommendations,
 * and switch history for POSShell agents
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

// ── Types ────────────────────────────────────────────────────────────────────

interface CarrierMetrics {
  name: string;
  mccMnc: string;
  country: string;
  technology: string;
  signalDbm: number;
  signalBars: number;
  latencyMs: number;
  bandwidthKbps: number;
  packetLossPct: number;
  jitterMs: number;
  qualityScore: number;
  available: boolean;
  lastUpdated: number;
  sampleCount: number;
}

interface SignalHistoryPoint {
  timestamp: number;
  signalDbm: number;
  latencyMs: number;
  bandwidthKbps: number;
  qualityScore: number;
  agentCode: string;
  region: string;
}

interface SwitchEvent {
  id: string;
  fromCarrier: string;
  toCarrier: string;
  agentCode: string;
  reason: string;
  timestamp: number;
  autoTriggered: boolean;
  improvement: number;
}

interface SwitchThresholds {
  minImprovementPct: number;
  minSignalDbm: number;
  maxLatencyMs: number;
  minBandwidthKbps: number;
  maxPacketLossPct: number;
  cooldownSecs: number;
  hysteresisPct: number;
}

// ── State ────────────────────────────────────────────────────────────────────

const carriers = new Map<string, CarrierMetrics>();
const signalHistory = new Map<string, SignalHistoryPoint[]>();
const switchHistory: SwitchEvent[] = [];
const MAX_HISTORY = 10000;
let switchCounter = 0;

const thresholds: SwitchThresholds = {
  minImprovementPct: 15,
  minSignalDbm: -100,
  maxLatencyMs: 500,
  minBandwidthKbps: 50,
  maxPacketLossPct: 10,
  cooldownSecs: 300,
  hysteresisPct: 5,
};

// Initialize known carriers
const KNOWN_CARRIERS: Array<{ name: string; mccMnc: string; country: string; tech: string }> = [
  { name: "Safaricom", mccMnc: "639-02", country: "KE", tech: "4G" },
  { name: "MTN", mccMnc: "621-30", country: "NG", tech: "4G" },
  { name: "Airtel", mccMnc: "621-20", country: "NG", tech: "4G" },
  { name: "Glo", mccMnc: "621-50", country: "NG", tech: "3G" },
  { name: "9mobile", mccMnc: "621-60", country: "NG", tech: "3G" },
  { name: "MTN_GH", mccMnc: "620-01", country: "GH", tech: "4G" },
  { name: "Vodafone_GH", mccMnc: "620-02", country: "GH", tech: "4G" },
  { name: "Orange_SN", mccMnc: "608-01", country: "SN", tech: "4G" },
  { name: "MTN_ZA", mccMnc: "655-10", country: "ZA", tech: "4G" },
  { name: "Vodacom_ZA", mccMnc: "655-01", country: "ZA", tech: "4G" },
];

for (const c of KNOWN_CARRIERS) {
  carriers.set(c.name, {
    name: c.name,
    mccMnc: c.mccMnc,
    country: c.country,
    technology: c.tech,
    signalDbm: -75,
    signalBars: 3,
    latencyMs: 150,
    bandwidthKbps: 2000,
    packetLossPct: 2,
    jitterMs: 20,
    qualityScore: 50,
    available: true,
    lastUpdated: 0,
    sampleCount: 0,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function signalToBar(dbm: number): number {
  if (dbm >= -50) return 5;
  if (dbm >= -65) return 4;
  if (dbm >= -80) return 3;
  if (dbm >= -95) return 2;
  if (dbm >= -110) return 1;
  return 0;
}

function computeQuality(signal: number, latency: number, bandwidth: number, loss: number): number {
  const sigScore = Math.max(0, Math.min(100, (signal + 120) * (100 / 70)));
  const latScore = Math.max(0, Math.min(100, 100 - latency / 10));
  const bwScore = Math.max(0, Math.min(100, bandwidth / 100));
  const lossScore = Math.max(0, Math.min(100, 100 - loss * 10));
  return sigScore * 0.2 + latScore * 0.3 + bwScore * 0.25 + lossScore * 0.15 + 10; // 10 base
}

function generateSwitchId(): string {
  switchCounter++;
  return `SW-${Date.now().toString(36)}-${switchCounter.toString(36)}`;
}

// ── Router ───────────────────────────────────────────────────────────────────

export const carrierSwitchingRouter = router({
  /** List all carriers with current metrics */
  listCarriers: protectedProcedure
    .input(z.object({ country: z.string().optional() }).optional())
    .query(({ input }) => {
      if (input?.country) {
        return list.filter((c: any) => c.country === input.country).sort((a: any, b: any) => b.qualityScore - a.qualityScore);
      }
      return list.sort((a: any, b: any) => b.qualityScore - a.qualityScore);
    }),

  /** Get carrier rankings */
  getRankings: protectedProcedure.query(() => {
    const list = Array.from(carrierMetrics.values())
      .filter((c: any) => c.sampleCount > 0)
      .sort((a: any, b: any) => b.qualityScore - a.qualityScore)
      .map((c, i) => ({
        rank: i + 1,
        ...c,
        grade: c.qualityScore >= 90 ? "A+" : c.qualityScore >= 80 ? "A" : c.qualityScore >= 70 ? "B" : c.qualityScore >= 60 ? "C" : c.qualityScore >= 50 ? "D" : "F",
      }));
    return list;
  }),

  /** Report signal measurement from a device */
  reportSignal: protectedProcedure
    .input(z.object({
      carrier: z.string(),
      agentCode: z.string().optional(),
      region: z.string().optional(),
      signalDbm: z.number(),
      latencyMs: z.number(),
      bandwidthKbps: z.number(),
      packetLossPct: z.number().optional(),
      jitterMs: z.number().optional(),
      technology: z.string().optional(),
    }))
    .mutation(({ input }) => {
      let c = carriers.get(input.carrier);
      if (!c) {
        c = {
          name: input.carrier,
          mccMnc: "",
          country: "NG",
          technology: input.technology || "4G",
          signalDbm: input.signalDbm,
          signalBars: signalToBar(input.signalDbm),
          latencyMs: input.latencyMs,
          bandwidthKbps: input.bandwidthKbps,
          packetLossPct: input.packetLossPct || 0,
          jitterMs: input.jitterMs || 0,
          qualityScore: 50,
          available: true,
          lastUpdated: Date.now(),
          sampleCount: 0,
        };
        carriers.set(input.carrier, c);
      }

      // EMA update
      const alpha = 0.3;
      if (c.sampleCount === 0) {
        c.signalDbm = input.signalDbm;
        c.latencyMs = input.latencyMs;
        c.bandwidthKbps = input.bandwidthKbps;
        c.packetLossPct = input.packetLossPct || 0;
        c.jitterMs = input.jitterMs || 0;
      } else {
        c.signalDbm = c.signalDbm * (1 - alpha) + input.signalDbm * alpha;
        c.latencyMs = c.latencyMs * (1 - alpha) + input.latencyMs * alpha;
        c.bandwidthKbps = c.bandwidthKbps * (1 - alpha) + input.bandwidthKbps * alpha;
        c.packetLossPct = c.packetLossPct * (1 - alpha) + (input.packetLossPct || 0) * alpha;
        c.jitterMs = c.jitterMs * (1 - alpha) + (input.jitterMs || 0) * alpha;
      }
      c.signalBars = signalToBar(c.signalDbm);
      c.qualityScore = computeQuality(c.signalDbm, c.latencyMs, c.bandwidthKbps, c.packetLossPct);
      c.technology = input.technology || c.technology;
      c.lastUpdated = Date.now();
      c.sampleCount++;

      // Record history
      const hist = signalHistory.get(input.carrier) || [];
      hist.push({
        timestamp: Date.now(),
        signalDbm: input.signalDbm,
        latencyMs: input.latencyMs,
        bandwidthKbps: input.bandwidthKbps,
        qualityScore: c.qualityScore,
        agentCode: input.agentCode || "",
        region: input.region || "",
      });
      if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
      signalHistory.set(input.carrier, hist);

      return { carrier: input.carrier, qualityScore: c.qualityScore, signalBars: c.signalBars, sampleCount: c.sampleCount };
    }),

  /** Get signal history for a carrier */
  getSignalHistory: protectedProcedure
    .input(z.object({
      carrier: z.string(),
      limit: z.number().min(1).max(500).optional(),
    }))
    .query(({ input }) => {
      const hist = signalHistory.get(input.carrier) || [];
      const limit = input.limit || 100;
      return hist.slice(-limit);
    }),

  /** Get auto-switch recommendation */
  getRecommendation: protectedProcedure
    .input(z.object({ currentCarrier: z.string() }))
    .query(({ input }) => {
      const current = carriers.get(input.currentCarrier);
      if (!current) return { shouldSwitch: false, reason: "Current carrier not found" };

      let best: CarrierMetrics | null = null;
      for (const c of carriers.values()) {
        if (c.available && c.sampleCount > 0) {
          if (!best || c.qualityScore > best.qualityScore) best = c;
        }
      }

      if (!best) return { shouldSwitch: false, currentCarrier: input.currentCarrier, reason: "No alternatives available" };

      const improvement = best.qualityScore - current.qualityScore;
      const shouldSwitch = improvement > thresholds.minImprovementPct && best.name !== input.currentCarrier;

      return {
        shouldSwitch,
        currentCarrier: input.currentCarrier,
        bestCarrier: best.name,
        currentScore: Math.round(current.qualityScore * 10) / 10,
        bestScore: Math.round(best.qualityScore * 10) / 10,
        improvement: Math.round(improvement * 10) / 10,
        reason: shouldSwitch
          ? `${best.name} has ${improvement.toFixed(1)}% better quality than ${input.currentCarrier}`
          : best.name === input.currentCarrier
            ? "Current carrier is already the best"
            : `Improvement of ${improvement.toFixed(1)}% is below ${thresholds.minImprovementPct}% threshold`,
      };
    }),

  /** Record a carrier switch */
  recordSwitch: protectedProcedure
    .input(z.object({
      fromCarrier: z.string(),
      toCarrier: z.string(),
      agentCode: z.string(),
      reason: z.string().optional(),
      autoTriggered: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const fromC = carriers.get(input.fromCarrier);
      const toC = carriers.get(input.toCarrier);
      const improvement = fromC && toC ? toC.qualityScore - fromC.qualityScore : 0;

      const event: SwitchEvent = {
        id: generateSwitchId(),
        fromCarrier: input.fromCarrier,
        toCarrier: input.toCarrier,
        agentCode: input.agentCode,
        reason: input.reason || "Manual switch",
        timestamp: Date.now(),
        autoTriggered: input.autoTriggered || false,
        improvement: Math.round(improvement * 10) / 10,
      };

      switchHistory.push(event);
      if (switchHistory.length > 1000) switchHistory.splice(0, switchHistory.length - 1000);

      return event;
    }),

  /** Get switch history */
  getSwitchHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional(),
      agentCode: z.string().optional(),
    }))
    .query(({ input }) => {
      let filtered = switchHistory;
      if (input.agentCode) {
        filtered = filtered.filter((e: any) => e.agentCode === input.agentCode);
      }
      return filtered.slice(-(input.limit || 50)).reverse();
    }),

  /** Get switch thresholds */
  getThresholds: protectedProcedure.query(() => thresholds),

  /** Update switch thresholds */
  updateThresholds: protectedProcedure
    .input(z.object({
      minImprovementPct: z.number().optional(),
      minSignalDbm: z.number().optional(),
      maxLatencyMs: z.number().optional(),
      minBandwidthKbps: z.number().optional(),
      maxPacketLossPct: z.number().optional(),
      cooldownSecs: z.number().optional(),
      hysteresisPct: z.number().optional(),
    }))
    .mutation(({ input }) => {
      if (input.minImprovementPct !== undefined) thresholds.minImprovementPct = input.minImprovementPct;
      if (input.minSignalDbm !== undefined) thresholds.minSignalDbm = input.minSignalDbm;
      if (input.maxLatencyMs !== undefined) thresholds.maxLatencyMs = input.maxLatencyMs;
      if (input.minBandwidthKbps !== undefined) thresholds.minBandwidthKbps = input.minBandwidthKbps;
      if (input.maxPacketLossPct !== undefined) thresholds.maxPacketLossPct = input.maxPacketLossPct;
      if (input.cooldownSecs !== undefined) thresholds.cooldownSecs = input.cooldownSecs;
      if (input.hysteresisPct !== undefined) thresholds.hysteresisPct = input.hysteresisPct;
      return thresholds;
    }),

  /** Compare two carriers */
  compareCarriers: protectedProcedure
    .input(z.object({ carrierA: z.string(), carrierB: z.string() }))
    .query(({ input }) => {
      const a = carriers.get(input.carrierA);
      const b = carriers.get(input.carrierB);
      if (!a || !b) return null;

      const factors = [
        { name: "Signal", aValue: a.signalDbm, bValue: b.signalDbm, winner: a.signalDbm >= b.signalDbm ? a.name : b.name },
        { name: "Latency", aValue: a.latencyMs, bValue: b.latencyMs, winner: a.latencyMs <= b.latencyMs ? a.name : b.name },
        { name: "Bandwidth", aValue: a.bandwidthKbps, bValue: b.bandwidthKbps, winner: a.bandwidthKbps >= b.bandwidthKbps ? a.name : b.name },
        { name: "Packet Loss", aValue: a.packetLossPct, bValue: b.packetLossPct, winner: a.packetLossPct <= b.packetLossPct ? a.name : b.name },
        { name: "Quality Score", aValue: a.qualityScore, bValue: b.qualityScore, winner: a.qualityScore >= b.qualityScore ? a.name : b.name },
      ];

      return {
        carrierA: a,
        carrierB: b,
        winner: a.qualityScore >= b.qualityScore ? a.name : b.name,
        advantagePct: Math.round(Math.abs(a.qualityScore - b.qualityScore) * 10) / 10,
        factors,
      };
    }),

  /** Get carrier switching statistics */
  getSwitchStats: protectedProcedure.query(() => {
    const totalSwitches = switchHistory.length;
    const autoSwitches = switchHistory.filter((e: any) => e.autoTriggered).length;
    const manualSwitches = totalSwitches - autoSwitches;
    const avgImprovement = totalSwitches > 0
      ? switchHistory.reduce((sum: any, e: any) => sum + e.improvement, 0) / totalSwitches
      : 0;

    const byCarrier: Record<string, { switchedTo: number; switchedFrom: number }> = {};
    for (const e of switchHistory) {
      if (!byCarrier[e.fromCarrier]) byCarrier[e.fromCarrier] = { switchedTo: 0, switchedFrom: 0 };
      if (!byCarrier[e.toCarrier]) byCarrier[e.toCarrier] = { switchedTo: 0, switchedFrom: 0 };
      byCarrier[e.fromCarrier].switchedFrom++;
      byCarrier[e.toCarrier].switchedTo++;
    }

    return {
      totalSwitches,
      autoSwitches,
      manualSwitches,
      avgImprovement: Math.round(avgImprovement * 10) / 10,
      byCarrier,
      recentSwitches: switchHistory.slice(-5).reverse(),
    };
  }),
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
