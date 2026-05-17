// Carrier SLA Monitor Router — Sprint 76
// Track uptime/availability per carrier per region, SLA compliance scoring
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

const SLA_TARGETS: Record<string, { uptime: number; latencyMs: number; packetLoss: number }> = {
  MTN: { uptime: 99.5, latencyMs: 200, packetLoss: 2.0 },
  Airtel: { uptime: 99.0, latencyMs: 250, packetLoss: 3.0 },
  Safaricom: { uptime: 99.5, latencyMs: 150, packetLoss: 1.5 },
  Glo: { uptime: 98.0, latencyMs: 300, packetLoss: 5.0 },
  "9mobile": { uptime: 97.5, latencyMs: 350, packetLoss: 5.0 },
  MTN_GH: { uptime: 99.0, latencyMs: 200, packetLoss: 2.5 },
  Vodafone_GH: { uptime: 99.0, latencyMs: 220, packetLoss: 3.0 },
  Orange_SN: { uptime: 98.5, latencyMs: 250, packetLoss: 3.0 },
  MTN_ZA: { uptime: 99.5, latencyMs: 180, packetLoss: 2.0 },
  Vodacom_ZA: { uptime: 99.5, latencyMs: 180, packetLoss: 2.0 },
};

interface SLACheck { timestamp: number; up: boolean; latencyMs: number; packetLossPct: number }
const checks = new Map<string, SLACheck[]>();
const violations: Array<{ timestamp: number; carrier: string; region: string; violation: string; severity: string }> = [];

export const carrierSlaRouter = router({
  recordCheck: protectedProcedure
    .input(z.object({
      carrier: z.string(),
      region: z.string(),
      up: z.boolean().default(true),
      latencyMs: z.number(),
      packetLossPct: z.number(),
    }))
    .mutation(({ input }) => {
      const key = `${input.carrier}:${input.region}`;
      if (!checks.has(key)) checks.set(key, []);
      checks.get(key)!.push({ timestamp: Date.now(), up: input.up, latencyMs: input.latencyMs, packetLossPct: input.packetLossPct });
      const target = SLA_TARGETS[input.carrier] || { uptime: 99.0, latencyMs: 300, packetLoss: 5.0 };
      if (!input.up) violations.push({ timestamp: Date.now(), carrier: input.carrier, region: input.region, violation: "Downtime detected", severity: "critical" });
      if (input.latencyMs > target.latencyMs) violations.push({ timestamp: Date.now(), carrier: input.carrier, region: input.region, violation: `Latency ${input.latencyMs}ms exceeds SLA ${target.latencyMs}ms`, severity: "warning" });
      if (input.packetLossPct > target.packetLoss) violations.push({ timestamp: Date.now(), carrier: input.carrier, region: input.region, violation: `Packet loss ${input.packetLossPct}% exceeds SLA ${target.packetLoss}%`, severity: "warning" });
      return { status: "recorded" };
    }),

  getSummary: protectedProcedure.query(() => {
    const summary: Record<string, any> = {};
    checks.forEach((checkList, key) => {
      const [carrier, region] = key.split(":");
      const total = checkList.length;
      const upCount = checkList.filter(c => c.up).length;
      const avgLatency = checkList.reduce((s: any, c: any) => s + c.latencyMs, 0) / (total || 1);
      const avgLoss = checkList.reduce((s: any, c: any) => s + c.packetLossPct, 0) / (total || 1);
      const uptimePct = total > 0 ? (upCount / total) * 100 : 100;
      const target = SLA_TARGETS[carrier] || { uptime: 99.0, latencyMs: 300, packetLoss: 5.0 };
      summary[key] = {
        carrier, region, totalChecks: total,
        uptimePct: Math.round(uptimePct * 100) / 100,
        avgLatencyMs: Math.round(avgLatency * 10) / 10,
        avgPacketLossPct: Math.round(avgLoss * 100) / 100,
        slaCompliant: uptimePct >= target.uptime && avgLatency <= target.latencyMs && avgLoss <= target.packetLoss,
        slaTarget: target,
      };
    });
    return summary;
  }),

  getViolations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(100) }))
    .query(({ input }) => violations.slice(-input.limit)),

  getTargets: protectedProcedure.query(() => SLA_TARGETS),
});
