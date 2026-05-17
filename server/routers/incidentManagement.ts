import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const incidentManagementRouter = router({
  dashboard: protectedProcedure.query(async () => ({
    openIncidents: 3, resolvedThisMonth: 18, mttrMinutes: 22, p1Count: 1, p2Count: 2,
    incidents: [
      { id: "INC-001", title: "Settlement batch delay — T+1 SLA at risk", severity: "P1", status: "investigating", assignee: "ops-lead", createdAt: Date.now() - 1800000, updatedAt: Date.now() - 300000, affectedServices: ["settlement", "reconciliation"] },
      { id: "INC-002", title: "Airflow DAG failure — daily ETL incomplete", severity: "P2", status: "mitigating", assignee: "data-team", createdAt: Date.now() - 7200000, updatedAt: Date.now() - 600000, affectedServices: ["airflow", "dbt"] },
      { id: "INC-003", title: "Elevated fraud alerts in Lagos region", severity: "P2", status: "monitoring", assignee: "fraud-team", createdAt: Date.now() - 14400000, updatedAt: Date.now() - 900000, affectedServices: ["fraud_detection"] },
    ],
    runbooks: [
      { id: "RB-001", title: "Settlement Batch Failure", steps: 8, lastUsed: Date.now() - 86400000 * 3 },
      { id: "RB-002", title: "Database Failover", steps: 12, lastUsed: Date.now() - 86400000 * 14 },
      { id: "RB-003", title: "Fraud Spike Response", steps: 6, lastUsed: Date.now() - 86400000 },
      { id: "RB-004", title: "NiFi Cluster Recovery", steps: 10, lastUsed: Date.now() - 86400000 * 7 },
    ],
  })),

  createIncident: protectedProcedure
    .input(z.object({ title: z.string(), severity: z.enum(["P1", "P2", "P3", "P4"]), description: z.string(), affectedServices: z.array(z.string()) }))
    .mutation(async ({ input }) => ({
      id: `INC-${Date.now()}`, title: input.title, severity: input.severity, status: "open", createdAt: Date.now(),
    })),

  updateStatus: protectedProcedure
    .input(z.object({ incidentId: z.string(), status: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input }) => ({
      success: true, incidentId: input.incidentId, status: input.status, updatedAt: Date.now(),
    })),

  createPostMortem: protectedProcedure
    .input(z.object({ incidentId: z.string() }))
    .mutation(async ({ input }) => ({
      postMortemId: `PM-${Date.now()}`, incidentId: input.incidentId,
      template: { summary: "", timeline: [], rootCause: "", impact: "", actionItems: [], lessonsLearned: "" },
    })),
});
