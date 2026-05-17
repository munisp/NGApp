import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

export const dataQualityRouter = router({
  dashboard: protectedProcedure.query(() => {
    return {
      overallScore: 94.2,
      dimensions: [
        { name: "Completeness", score: 97.5, trend: "up", issues: 12 },
        { name: "Accuracy", score: 95.8, trend: "stable", issues: 8 },
        { name: "Consistency", score: 92.1, trend: "up", issues: 22 },
        { name: "Timeliness", score: 96.0, trend: "down", issues: 5 },
        { name: "Uniqueness", score: 98.2, trend: "stable", issues: 3 },
        { name: "Validity", score: 91.5, trend: "up", issues: 18 },
      ],
      recentIssues: [
        { id: "dq-001", table: "transactions", column: "agent_id", type: "missing_value", count: 12, severity: "medium", detectedAt: new Date().toISOString() },
        { id: "dq-002", table: "agents", column: "phone_number", type: "format_violation", count: 8, severity: "low", detectedAt: new Date().toISOString() },
        { id: "dq-003", table: "settlements", column: "amount", type: "anomaly", count: 3, severity: "high", detectedAt: new Date().toISOString() },
        { id: "dq-004", table: "customers", column: "bvn", type: "duplicate", count: 5, severity: "critical", detectedAt: new Date().toISOString() },
      ],
      validationRules: 156,
      activeProfiles: 24,
    };
  }),

  runProfile: protectedProcedure.input(z.object({ table: z.string() })).mutation(({ input }) => {
    return {
      table: input.table,
      rowCount: 1_250_000,
      columnProfiles: [
        { column: "id", type: "integer", nullRate: 0, uniqueRate: 100, min: 1, max: 1250000 },
        { column: "amount", type: "decimal", nullRate: 0.1, uniqueRate: 85, min: 100, max: 5000000, mean: 12500, stdDev: 8500 },
        { column: "agent_id", type: "varchar", nullRate: 0.05, uniqueRate: 1.2, topValues: ["AGT001", "AGT002", "AGT003"] },
        { column: "status", type: "enum", nullRate: 0, uniqueRate: 0.0004, topValues: ["completed", "pending", "failed"] },
        { column: "created_at", type: "timestamp", nullRate: 0, min: "2024-01-01", max: new Date().toISOString().slice(0, 10) },
      ],
      completedAt: new Date().toISOString(),
    };
  }),

  getValidationRules: protectedProcedure.query(() => {
    return {
      rules: [
        { id: "vr-001", table: "transactions", rule: "amount > 0 AND amount <= 5000000", type: "range_check", status: "active", lastRun: new Date().toISOString(), passRate: 99.8 },
        { id: "vr-002", table: "agents", rule: "phone MATCHES '^\\+234[0-9]{10}$'", type: "format_check", status: "active", lastRun: new Date().toISOString(), passRate: 97.2 },
        { id: "vr-003", table: "customers", rule: "bvn IS UNIQUE", type: "uniqueness_check", status: "active", lastRun: new Date().toISOString(), passRate: 99.96 },
        { id: "vr-004", table: "settlements", rule: "settled_at >= created_at", type: "consistency_check", status: "active", lastRun: new Date().toISOString(), passRate: 100 },
        { id: "vr-005", table: "transactions", rule: "NOT NULL(agent_id, amount, type)", type: "completeness_check", status: "active", lastRun: new Date().toISOString(), passRate: 99.95 },
      ],
    };
  }),

  runCleansing: protectedProcedure.input(z.object({
    table: z.string(),
    rules: z.array(z.string()),
  })).mutation(({ input }) => {
    return { table: input.table, rulesApplied: input.rules.length, recordsCleansed: 45, recordsQuarantined: 3, completedAt: new Date().toISOString() };
  }),
});
