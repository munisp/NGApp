import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const METRICS = [
  { id: "tx_volume", category: "transactions", label: "Transaction Volume" },
  { id: "tx_value", category: "transactions", label: "Transaction Value" },
  { id: "tx_failed", category: "transactions", label: "Failed Transactions" },
  { id: "active_agents", category: "agents", label: "Active Agents" },
  { id: "agent_uptime", category: "agents", label: "Agent Uptime" },
  { id: "agent_revenue", category: "agents", label: "Agent Revenue" },
  { id: "fraud_score", category: "risk", label: "Fraud Score" },
  { id: "kyc_pending", category: "risk", label: "KYC Pending" },
  { id: "settlement_delay", category: "finance", label: "Settlement Delay" },
  { id: "commission_total", category: "finance", label: "Commission Total" },
  { id: "revenue_daily", category: "finance", label: "Daily Revenue" },
  { id: "api_latency", category: "system", label: "API Latency" },
  { id: "db_connections", category: "system", label: "DB Connections" },
  { id: "queue_depth", category: "system", label: "Queue Depth" },
  { id: "api_errors", category: "system", label: "API Errors" },
];

const OPERATORS = [
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
  "neq",
  "pct_change_up",
  "pct_change_down",
] as const;

const seedRules = [
  {
    id: "thr_001",
    metricId: "tx_failed",
    operator: "gt",
    value: 100,
    severity: "critical",
    status: "active",
  },
  {
    id: "thr_002",
    metricId: "api_latency",
    operator: "gt",
    value: 500,
    severity: "warning",
    status: "active",
  },
  {
    id: "thr_003",
    metricId: "fraud_score",
    operator: "gte",
    value: 80,
    severity: "critical",
    status: "active",
  },
  {
    id: "thr_004",
    metricId: "settlement_delay",
    operator: "gt",
    value: 3600,
    severity: "warning",
    status: "paused",
  },
  {
    id: "thr_005",
    metricId: "queue_depth",
    operator: "gt",
    value: 10000,
    severity: "critical",
    status: "active",
  },
];

export const dataThresholdAlertsRouter = router({
  metrics: protectedProcedure.query(async () => METRICS),
  list: protectedProcedure.query(async () => ({
    items: seedRules,
    total: seedRules.length,
  })),
  create: protectedProcedure
    .input(
      z.object({
        metricId: z.string(),
        operator: z.enum(OPERATORS),
        value: z.number(),
        severity: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return { id: `thr_${Date.now()}`, ...input, status: "active" };
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        value: z.number().optional(),
        severity: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  simulateCheck: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .query(async ({ input }) => {
      return {
        ruleId: input.ruleId,
        wouldTrigger: true,
        currentValue: 150,
        threshold: 100,
      };
    }),
  acknowledge: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  resolve: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),

  events: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  operators: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  toggleStatus: protectedProcedure.input(z.object({})).mutation(async () => {
    return { success: true };
  }),
});
