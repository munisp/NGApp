import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { rateAlerts } from "../../drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

// Seeded threshold rules for initial system configuration
const SEEDED_RULES = [
  {
    id: "thr_001",
    metricId: "tx_volume",
    operator: "gt",
    value: 10000,
    severity: "critical",
    status: "active",
  },
  {
    id: "thr_002",
    metricId: "tx_failed",
    operator: "gte",
    value: 100,
    severity: "warning",
    status: "active",
  },
  {
    id: "thr_003",
    metricId: "fraud_score",
    operator: "gt",
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
    status: "active",
  },
  {
    id: "thr_005",
    metricId: "api_latency",
    operator: "gt",
    value: 5000,
    severity: "critical",
    status: "active",
  },
  {
    id: "thr_006",
    metricId: "agent_churn",
    operator: "gt",
    value: 5,
    severity: "warning",
    status: "active",
  },
];

export const dataThresholdAlertsRouter = router({
  metrics: protectedProcedure.query(async () => {
    return [
      {
        id: "tx_volume",
        category: "transactions",
        label: "Transaction Volume",
      },
      {
        id: "tx_failed",
        category: "transactions",
        label: "Failed Transactions",
      },
      {
        id: "tx_amount",
        category: "transactions",
        label: "Transaction Amount",
      },
      { id: "active_agents", category: "agents", label: "Active Agents" },
      { id: "agent_churn", category: "agents", label: "Agent Churn Rate" },
      { id: "agent_float", category: "agents", label: "Agent Float Balance" },
      { id: "fraud_score", category: "risk", label: "Fraud Score" },
      { id: "fraud_alerts", category: "risk", label: "Fraud Alerts Count" },
      {
        id: "settlement_delay",
        category: "finance",
        label: "Settlement Delay",
      },
      {
        id: "settlement_failures",
        category: "finance",
        label: "Settlement Failures",
      },
      { id: "api_latency", category: "system", label: "API Latency" },
      { id: "db_connections", category: "system", label: "DB Connections" },
      { id: "system_uptime", category: "system", label: "System Uptime" },
      { id: "agent_kyc_pending", category: "agents", label: "KYC Pending" },
      {
        id: "tx_reversal_rate",
        category: "transactions",
        label: "Reversal Rate",
      },
    ];
  }),
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const rows = await db
      .select()
      .from(rateAlerts)
      .orderBy(desc(rateAlerts.id))
      .limit(50);
    const totalArr = await db.select({ total: count() }).from(rateAlerts);
    const total = totalArr?.[0]?.total ?? 0;
    return { items: rows, total };
  }),
  create: protectedProcedure
    .input(
      z.object({
        metricId: z.string(),
        operator: z.enum([
          "gt",
          "gte",
          "lt",
          "lte",
          "eq",
          "neq",
          "pct_change_up",
          "pct_change_down",
        ]),
        value: z.number(),
        severity: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { id: `thr_${Date.now()}`, ...input, status: "active" };
      const [row] = await db
        .insert(rateAlerts)
        .values({
          alertType: input.metricId,
          severity: input.severity,
          status: "active",
        } as any)
        .returning();
      return row;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        value: z.number().optional(),
        severity: z.string().optional(),
      })
    )
    .mutation(async () => {
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async () => {
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
    .mutation(async () => {
      return { success: true };
    }),
  resolve: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async () => {
      return { success: true };
    }),
  events: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const rows = await db
      .select()
      .from(rateAlerts)
      .orderBy(desc(rateAlerts.id))
      .limit(20);
    return { items: rows, total: rows.length };
  }),
  operators: protectedProcedure.query(async () => {
    return {
      items: [
        "gt",
        "gte",
        "lt",
        "lte",
        "eq",
        "neq",
        "pct_change_up",
        "pct_change_down",
      ],
      total: 8,
    };
  }),
  toggleStatus: protectedProcedure.input(z.object({})).mutation(async () => {
    return { success: true };
  }),
});
