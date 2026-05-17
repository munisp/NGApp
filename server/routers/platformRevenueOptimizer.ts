import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const experiments = [
  { id: "EXP-001", name: "Dynamic Commission Tiers", status: "running", startDate: "2026-04-01", variant: "3-tier vs 5-tier", participants: 500, uplift: 12.5, confidence: 95, revenue: 8500000 },
  { id: "EXP-002", name: "Peak Hour Pricing", status: "running", startDate: "2026-04-10", variant: "Surge vs flat", participants: 300, uplift: 8.2, confidence: 88, revenue: 3200000 },
  { id: "EXP-003", name: "Loyalty Cashback Rate", status: "completed", startDate: "2026-03-01", variant: "1% vs 2% cashback", participants: 1000, uplift: 15.8, confidence: 99, revenue: 12000000 },
  { id: "EXP-004", name: "Transaction Fee Bundle", status: "draft", startDate: null, variant: "Per-tx vs monthly bundle", participants: 0, uplift: 0, confidence: 0, revenue: 0 },
];
export const platformRevenueOptimizerRouter = router({
  getStats: protectedProcedure.query(() => ({ totalExperiments: experiments.length, activeExperiments: experiments.filter(e => e.status === "running").length, totalUplift: experiments.reduce((s: any, e: any) => s + e.revenue, 0), avgUpliftPercent: experiments.filter(e => e.uplift > 0).reduce((s: any, e: any) => s + e.uplift, 0) / experiments.filter(e => e.uplift > 0).length, totalParticipants: experiments.reduce((s: any, e: any) => s + e.participants, 0), revenueTarget: 50000000, revenueActual: 42000000 })),
  listExperiments: protectedProcedure.query(() => ({ experiments, total: experiments.length })),
  getExperiment: protectedProcedure.input(z.object({ experimentId: z.string() })).query(({ input }) => experiments.find(e => e.id === input.experimentId) || null),
  createExperiment: protectedProcedure.input(z.object({ name: z.string(), variant: z.string(), targetParticipants: z.number() })).mutation(({ input }) => ({ experimentId: `EXP-${Date.now()}`, status: "draft", ...input })),
  analyzeResults: protectedProcedure.input(z.object({ experimentId: z.string() })).mutation(({ input }) => ({ experimentId: input.experimentId, winner: "Variant B", uplift: 12.5, confidence: 95, recommendation: "Roll out to all agents", projectedAnnualRevenue: 102000000 })),
});
