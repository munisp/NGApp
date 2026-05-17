import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const resources = [
  { id: "RES-001", name: "API Gateway", currentUsage: 72, maxCapacity: 100, unit: "k req/s", growthRate: 8.5, exhaustionDate: "2026-09-15", status: "healthy", recommendation: "Scale at 85% threshold" },
  { id: "RES-002", name: "Database Cluster", currentUsage: 65, maxCapacity: 100, unit: "% CPU", growthRate: 5.2, exhaustionDate: "2027-01-20", status: "healthy", recommendation: "Add read replica at 80%" },
  { id: "RES-003", name: "Message Queue", currentUsage: 45, maxCapacity: 100, unit: "k msg/s", growthRate: 12.1, exhaustionDate: "2026-08-01", status: "warning", recommendation: "Upgrade to dedicated cluster" },
  { id: "RES-004", name: "Storage (S3)", currentUsage: 58, maxCapacity: 100, unit: "TB", growthRate: 3.8, exhaustionDate: "2027-06-15", status: "healthy", recommendation: "Implement lifecycle policies" },
  { id: "RES-005", name: "Redis Cache", currentUsage: 82, maxCapacity: 100, unit: "% memory", growthRate: 6.5, exhaustionDate: "2026-07-10", status: "critical", recommendation: "Immediate scale-up needed" },
];
export const platformCapacityPlannerRouter = router({
  getStats: protectedProcedure.query(() => ({ totalResources: resources.length, healthyResources: resources.filter(r => r.status === "healthy").length, criticalResources: resources.filter(r => r.status === "critical").length, avgUtilization: resources.reduce((s: any, r: any) => s + r.currentUsage, 0) / resources.length, nearestExhaustion: "Redis Cache — Jul 2026", projectedGrowth: "15% QoQ" })),
  listResources: protectedProcedure.query(() => ({ resources, total: resources.length })),
  getResource: protectedProcedure.input(z.object({ resourceId: z.string() })).query(({ input }) => resources.find(r => r.id === input.resourceId) || null),
  runProjection: protectedProcedure.input(z.object({ months: z.number().default(6), growthScenario: z.string().default("moderate") })).mutation(({ input }) => ({ projectionId: `PROJ-${Date.now()}`, months: input.months, scenario: input.growthScenario, results: resources.map(r => ({ name: r.name, projectedUsage: Math.min(100, r.currentUsage + r.growthRate * input.months), needsScaling: r.currentUsage + r.growthRate * input.months > 85 })) })),
  createScalingPlan: protectedProcedure.input(z.object({ resourceId: z.string(), targetCapacity: z.number() })).mutation(({ input }) => ({ planId: `SCALE-${Date.now()}`, ...input, estimatedCost: 2500000, timeline: "2 weeks", approvalRequired: true })),
});
