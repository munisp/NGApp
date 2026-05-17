import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const incidents = [
  { id: "INC-001", title: "NIBSS Gateway Latency Spike", severity: "P2", status: "investigating", startedAt: "2026-04-21T10:30:00Z", affectedServices: ["Payment Processing", "Settlement"], assignee: "Platform Engineering", impactedAgents: 120, estimatedResolution: "1 hour" },
  { id: "INC-002", title: "Agent Portal Login Failures", severity: "P3", status: "resolved", startedAt: "2026-04-21T08:00:00Z", resolvedAt: "2026-04-21T08:45:00Z", affectedServices: ["Agent Portal"], assignee: "Auth Team", impactedAgents: 45, rootCause: "Expired OAuth certificate" },
  { id: "INC-003", title: "Settlement Batch Delay", severity: "P1", status: "monitoring", startedAt: "2026-04-20T23:00:00Z", affectedServices: ["Settlement Engine", "Agent Float"], assignee: "Settlement Team", impactedAgents: 850, estimatedResolution: "30 minutes" },
];
const metrics = { tps: 2450, errorRate: 0.12, p99Latency: 245, activeAgents: 1180, activeTerminals: 1050, uptimePercent: 99.97, openIncidents: 2, mttr: "32 minutes" };
export const operationalCommandBridgeRouter = router({
  getStats: protectedProcedure.query(() => ({ ...metrics, totalIncidentsToday: incidents.length, resolvedToday: incidents.filter(i => i.status === "resolved").length, criticalIncidents: incidents.filter(i => i.severity === "P1").length })),
  listIncidents: protectedProcedure.query(() => ({ incidents, total: incidents.length })),
  getIncident: protectedProcedure.input(z.object({ incidentId: z.string() })).query(({ input }) => incidents.find(i => i.id === input.incidentId) || null),
  createIncident: protectedProcedure.input(z.object({ title: z.string(), severity: z.string(), affectedServices: z.array(z.string()) })).mutation(({ input }) => ({ incidentId: `INC-${Date.now()}`, status: "open", ...input, createdAt: new Date().toISOString() })),
  updateStatus: protectedProcedure.input(z.object({ incidentId: z.string(), status: z.string(), notes: z.string().optional() })).mutation(({ input }) => ({ ...input, updatedAt: new Date().toISOString() })),
  getLiveMetrics: protectedProcedure.query(() => metrics),
});
