import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const costCenters = [
  { id: "CC-001", name: "POS Operations", budget: 50000000, spent: 42000000, allocated: 48000000, utilization: 87.5, category: "operations", owner: "Operations Team" },
  { id: "CC-002", name: "Agent Support", budget: 25000000, spent: 21000000, allocated: 23000000, utilization: 91.3, category: "support", owner: "Support Team" },
  { id: "CC-003", name: "Infrastructure", budget: 80000000, spent: 65000000, allocated: 75000000, utilization: 86.7, category: "technology", owner: "Engineering Team" },
  { id: "CC-004", name: "Compliance & Legal", budget: 15000000, spent: 12500000, allocated: 14000000, utilization: 89.3, category: "compliance", owner: "Legal Team" },
  { id: "CC-005", name: "Marketing & Growth", budget: 35000000, spent: 28000000, allocated: 32000000, utilization: 87.5, category: "marketing", owner: "Growth Team" },
];
export const platformCostAllocatorRouter = router({
  getStats: protectedProcedure.query(() => ({ totalBudget: costCenters.reduce((s: any, c: any) => s + c.budget, 0), totalSpent: costCenters.reduce((s: any, c: any) => s + c.spent, 0), totalAllocated: costCenters.reduce((s: any, c: any) => s + c.allocated, 0), avgUtilization: costCenters.reduce((s: any, c: any) => s + c.utilization, 0) / costCenters.length, costCenterCount: costCenters.length, overBudgetAlerts: 0, forecastVariance: "3.2%" })),
  listCostCenters: protectedProcedure.query(() => ({ costCenters, total: costCenters.length })),
  getCostCenter: protectedProcedure.input(z.object({ centerId: z.string() })).query(({ input }) => costCenters.find(c => c.id === input.centerId) || null),
  allocateBudget: protectedProcedure.input(z.object({ centerId: z.string(), amount: z.number(), reason: z.string() })).mutation(({ input }) => ({ allocationId: `ALLOC-${Date.now()}`, ...input, status: "approved", approvedAt: new Date().toISOString() })),
  generateReport: protectedProcedure.input(z.object({ period: z.string().default("2026-04") })).mutation(({ input }) => ({ reportId: `COST-RPT-${Date.now()}`, period: input.period, totalCost: 168500000, breakdown: costCenters.map(c => ({ name: c.name, amount: c.spent })) })),
});
