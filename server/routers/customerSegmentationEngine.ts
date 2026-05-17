import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const segments = [
  { id: "SEG-1", name: "High-Value Frequent", size: 2500, avgTransactionValue: 85000, frequency: 45, churnRisk: "low", ltv: 15000000, growth: 12 },
  { id: "SEG-2", name: "Regular Transactors", size: 8500, avgTransactionValue: 25000, frequency: 20, churnRisk: "medium", ltv: 3000000, growth: 5 },
  { id: "SEG-3", name: "Occasional Users", size: 5000, avgTransactionValue: 10000, frequency: 5, churnRisk: "high", ltv: 600000, growth: -3 },
  { id: "SEG-4", name: "New Customers", size: 3000, avgTransactionValue: 15000, frequency: 8, churnRisk: "medium", ltv: 1200000, growth: 25 },
  { id: "SEG-5", name: "Dormant Accounts", size: 2000, avgTransactionValue: 0, frequency: 0, churnRisk: "critical", ltv: 100000, growth: -15 },
  { id: "SEG-6", name: "Business Accounts", size: 1500, avgTransactionValue: 250000, frequency: 60, churnRisk: "low", ltv: 45000000, growth: 18 },
];
export const customerSegmentationEngineRouter = router({
  getStats: protectedProcedure.query(async () => ({
    totalCustomers: 22500, segments: 8, avgLTV: 5200000, highValueCustomers: 4000,
    churnRiskHigh: 7000, retentionRate: 88, segmentAccuracy: 94, lastModelRun: Date.now() - 86400000,
  })),
  listSegments: protectedProcedure.query(async () => ({ segments, total: segments.length })),
  getSegmentDetails: protectedProcedure.input(z.object({ segmentId: z.string() }))
    .query(async ({ input }) => ({ ...(segments.find(s => s.id === input.segmentId) || segments[0]), demographics: { ageGroups: { "18-25": 15, "26-35": 35, "36-45": 30, "46+": 20 }, regions: { Lagos: 40, Abuja: 25, Kano: 15, Others: 20 } } })),
  runSegmentation: protectedProcedure.mutation(async () => ({ jobId: `JOB-${Date.now()}`, status: "running", customersProcessed: 22500, estimatedDuration: 300, startedAt: Date.now() })),
  createCampaign: protectedProcedure.input(z.object({ segmentId: z.string(), campaignName: z.string(), channel: z.string() }))
    .mutation(async ({ input }) => ({ campaignId: `CMP-${Date.now()}`, ...input, status: "scheduled", targetSize: 2500, createdAt: Date.now() })),
});
