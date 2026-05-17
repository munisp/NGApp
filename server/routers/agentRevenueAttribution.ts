import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const attributions = [
  { agentId: "AGT-001", name: "Adebayo Ogundimu", directRevenue: 8500000, referralRevenue: 2100000, networkRevenue: 1500000, totalAttribution: 12100000, channels: { pos: 65, mobile: 25, qr: 10 }, period: "2026-04" },
  { agentId: "AGT-002", name: "Chioma Eze", directRevenue: 6200000, referralRevenue: 3400000, networkRevenue: 800000, totalAttribution: 10400000, channels: { pos: 72, mobile: 18, qr: 10 }, period: "2026-04" },
  { agentId: "AGT-003", name: "Ibrahim Musa", directRevenue: 9100000, referralRevenue: 1200000, networkRevenue: 2300000, totalAttribution: 12600000, channels: { pos: 80, mobile: 15, qr: 5 }, period: "2026-04" },
  { agentId: "AGT-004", name: "Fatima Bello", directRevenue: 5800000, referralRevenue: 900000, networkRevenue: 600000, totalAttribution: 7300000, channels: { pos: 70, mobile: 20, qr: 10 }, period: "2026-04" },
];
export const agentRevenueAttributionRouter = router({
  getStats: protectedProcedure.query(() => ({ totalRevenue: attributions.reduce((s: any, a: any) => s + a.totalAttribution, 0), directRevenue: attributions.reduce((s: any, a: any) => s + a.directRevenue, 0), referralRevenue: attributions.reduce((s: any, a: any) => s + a.referralRevenue, 0), networkRevenue: attributions.reduce((s: any, a: any) => s + a.networkRevenue, 0), topChannel: "POS (72%)", agentsTracked: attributions.length, attributionModel: "Multi-Touch (Time Decay)" })),
  listAttributions: protectedProcedure.input(z.object({ period: z.string().default("2026-04") })).query(({ input }) => ({ attributions: attributions.filter(a => a.period === input.period), total: attributions.length })),
  getAgentAttribution: protectedProcedure.input(z.object({ agentId: z.string() })).query(({ input }) => attributions.find(a => a.agentId === input.agentId) || null),
  recalculate: protectedProcedure.input(z.object({ period: z.string(), model: z.string().default("time-decay") })).mutation(({ input }) => ({ jobId: `ATTR-${Date.now()}`, status: "processing", period: input.period, model: input.model, estimatedTime: "5 minutes" })),
  exportReport: protectedProcedure.input(z.object({ period: z.string(), format: z.string().default("csv") })).mutation(({ input }) => ({ reportUrl: `/api/reports/attribution-${input.period}.${input.format}`, generatedAt: new Date().toISOString() })),
});
