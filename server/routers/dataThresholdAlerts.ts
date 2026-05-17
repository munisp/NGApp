/**
 * Data Threshold Alert System Router
 * Monitors dashboard metrics and triggers notifications when thresholds are breached
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { dispatchThresholdAlert, getNotificationHistory, getCooldownStatus, clearExpiredCooldowns } from "../lib/thresholdAlertDispatcher";
import type { BreachEvent } from "../lib/thresholdAlertDispatcher";

// ─── Types ───────────────────────────────────────────────────────────────────
type Operator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "pct_change_up" | "pct_change_down";
type Severity = "info" | "warning" | "critical";
type AlertStatus = "active" | "paused" | "triggered" | "resolved" | "expired";
type Channel = "email" | "sms" | "push" | "webhook" | "in-app";

interface ThresholdRule {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  // What to monitor
  metric: string;
  metricLabel: string;
  dataSource: string;
  // Threshold condition
  operator: Operator;
  threshold: number;
  unit: string;
  // Timing
  checkIntervalMinutes: number;
  cooldownMinutes: number; // min time between re-triggers
  // Notification
  severity: Severity;
  channels: Channel[];
  recipients: string[];
  // State
  status: AlertStatus;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  triggerCount: number;
  currentValue: number | null;
  // Metadata
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  operator: Operator;
  threshold: number;
  actualValue: number;
  severity: Severity;
  channels: Channel[];
  message: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ─── Operator Labels ─────────────────────────────────────────────────────────
const OPERATOR_LABELS: Record<Operator, string> = {
  gt: "greater than", gte: "greater than or equal to",
  lt: "less than", lte: "less than or equal to",
  eq: "equal to", neq: "not equal to",
  pct_change_up: "% increase exceeds", pct_change_down: "% decrease exceeds",
};

// ─── Available Metrics ───────────────────────────────────────────────────────
const AVAILABLE_METRICS = [
  { id: "tx_volume_daily", label: "Daily Transaction Volume", dataSource: "analytics.overview", unit: "NGN", category: "transactions" },
  { id: "tx_count_hourly", label: "Hourly Transaction Count", dataSource: "analytics.overview", unit: "count", category: "transactions" },
  { id: "tx_failure_rate", label: "Transaction Failure Rate", dataSource: "analytics.overview", unit: "%", category: "transactions" },
  { id: "active_agents", label: "Active Agents", dataSource: "analytics.agents", unit: "count", category: "agents" },
  { id: "agent_churn_rate", label: "Agent Churn Rate (30d)", dataSource: "analytics.agents", unit: "%", category: "agents" },
  { id: "fraud_score_avg", label: "Average Fraud Score", dataSource: "analytics.fraud", unit: "score", category: "risk" },
  { id: "fraud_alert_count", label: "Fraud Alert Count (24h)", dataSource: "analytics.fraud", unit: "count", category: "risk" },
  { id: "settlement_pending", label: "Pending Settlement Amount", dataSource: "analytics.settlement", unit: "NGN", category: "finance" },
  { id: "commission_payout_due", label: "Commission Payouts Due", dataSource: "analytics.commissions", unit: "NGN", category: "finance" },
  { id: "kyc_pending_count", label: "Pending KYC Reviews", dataSource: "analytics.kyc", unit: "count", category: "compliance" },
  { id: "api_error_rate", label: "API Error Rate (5xx)", dataSource: "analytics.system", unit: "%", category: "system" },
  { id: "api_latency_p99", label: "API Latency P99", dataSource: "analytics.system", unit: "ms", category: "system" },
  { id: "db_connection_pool", label: "DB Connection Pool Usage", dataSource: "analytics.system", unit: "%", category: "system" },
  { id: "queue_depth", label: "Message Queue Depth", dataSource: "analytics.system", unit: "count", category: "system" },
  { id: "revenue_daily", label: "Daily Revenue", dataSource: "analytics.finance", unit: "NGN", category: "finance" },
];

// ─── In-Memory Store ─────────────────────────────────────────────────────────
const rules: ThresholdRule[] = [
  {
    id: "thr_001", name: "High Fraud Alert Volume", description: "Triggers when fraud alerts exceed 50 in 24 hours",
    ownerId: "u1", ownerName: "Admin Fatima",
    metric: "fraud_alert_count", metricLabel: "Fraud Alert Count (24h)", dataSource: "analytics.fraud",
    operator: "gt", threshold: 50, unit: "count",
    checkIntervalMinutes: 15, cooldownMinutes: 60,
    severity: "critical", channels: ["email", "sms", "push"], recipients: ["admin@54link.com", "security@54link.com"],
    status: "active", lastCheckedAt: new Date(Date.now() - 900000).toISOString(), lastTriggeredAt: null,
    triggerCount: 0, currentValue: 23,
    tags: ["fraud", "security"], createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "thr_002", name: "Transaction Failure Spike", description: "Alert when failure rate exceeds 5%",
    ownerId: "u1", ownerName: "Admin Fatima",
    metric: "tx_failure_rate", metricLabel: "Transaction Failure Rate", dataSource: "analytics.overview",
    operator: "gt", threshold: 5, unit: "%",
    checkIntervalMinutes: 5, cooldownMinutes: 30,
    severity: "critical", channels: ["email", "sms", "push", "webhook"], recipients: ["ops@54link.com"],
    status: "triggered", lastCheckedAt: new Date(Date.now() - 300000).toISOString(), lastTriggeredAt: new Date(Date.now() - 1800000).toISOString(),
    triggerCount: 3, currentValue: 7.2,
    tags: ["transactions", "reliability"], createdAt: new Date(Date.now() - 86400000 * 14).toISOString(), updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "thr_003", name: "Low Agent Activity", description: "Alert when active agents drop below 100",
    ownerId: "u2", ownerName: "Supervisor Chidi",
    metric: "active_agents", metricLabel: "Active Agents", dataSource: "analytics.agents",
    operator: "lt", threshold: 100, unit: "count",
    checkIntervalMinutes: 60, cooldownMinutes: 240,
    severity: "warning", channels: ["email", "in-app"], recipients: ["ops@54link.com"],
    status: "active", lastCheckedAt: new Date(Date.now() - 3600000).toISOString(), lastTriggeredAt: null,
    triggerCount: 0, currentValue: 187,
    tags: ["agents", "operations"], createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "thr_004", name: "API Latency Degradation", description: "Alert when P99 latency exceeds 2000ms",
    ownerId: "u1", ownerName: "Admin Fatima",
    metric: "api_latency_p99", metricLabel: "API Latency P99", dataSource: "analytics.system",
    operator: "gt", threshold: 2000, unit: "ms",
    checkIntervalMinutes: 5, cooldownMinutes: 15,
    severity: "warning", channels: ["push", "in-app"], recipients: ["devops@54link.com"],
    status: "active", lastCheckedAt: new Date(Date.now() - 300000).toISOString(), lastTriggeredAt: null,
    triggerCount: 0, currentValue: 450,
    tags: ["system", "performance"], createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "thr_005", name: "Revenue Drop Alert", description: "Alert when daily revenue drops more than 20% vs 7-day average",
    ownerId: "u1", ownerName: "Admin Fatima",
    metric: "revenue_daily", metricLabel: "Daily Revenue", dataSource: "analytics.finance",
    operator: "pct_change_down", threshold: 20, unit: "%",
    checkIntervalMinutes: 60, cooldownMinutes: 1440,
    severity: "critical", channels: ["email", "sms"], recipients: ["cfo@54link.com", "admin@54link.com"],
    status: "active", lastCheckedAt: new Date(Date.now() - 3600000).toISOString(), lastTriggeredAt: null,
    triggerCount: 0, currentValue: null,
    tags: ["finance", "revenue"], createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const alertEvents: AlertEvent[] = [
  {
    id: "evt_001", ruleId: "thr_002", ruleName: "Transaction Failure Spike",
    metric: "tx_failure_rate", operator: "gt", threshold: 5, actualValue: 7.2,
    severity: "critical", channels: ["email", "sms", "push", "webhook"],
    message: "Transaction failure rate is 7.2%, exceeding threshold of 5%",
    acknowledged: true, acknowledgedBy: "Admin Fatima", acknowledgedAt: new Date(Date.now() - 1200000).toISOString(),
    resolvedAt: null, createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "evt_002", ruleId: "thr_002", ruleName: "Transaction Failure Spike",
    metric: "tx_failure_rate", operator: "gt", threshold: 5, actualValue: 6.1,
    severity: "critical", channels: ["email", "sms", "push", "webhook"],
    message: "Transaction failure rate is 6.1%, exceeding threshold of 5%",
    acknowledged: true, acknowledgedBy: "Admin Fatima", acknowledgedAt: new Date(Date.now() - 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 82800000).toISOString(), createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

let nextRuleId = 6;
let nextEventId = 3;

// ─── Router ──────────────────────────────────────────────────────────────────
export const dataThresholdAlertsRouter = router({
  // Available metrics catalog
  metrics: protectedProcedure.query(() => AVAILABLE_METRICS),

  // Operator labels
  operators: protectedProcedure.query(() =>
    Object.entries(OPERATOR_LABELS).map(([key, label]) => ({ value: key, label }))
  ),

  // List all threshold rules
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "paused", "triggered", "resolved", "expired", "all"]).optional(),
      severity: z.enum(["info", "warning", "critical", "all"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(({ input }) => {
      let filtered = [...rules];
      if (input?.status && input.status !== "all") filtered = filtered.filter((r: any) => r.status === input.status);
      if (input?.severity && input.severity !== "all") filtered = filtered.filter((r: any) => r.severity === input.severity);
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter((r: any) => r.name.toLowerCase().includes(q) || r.metric.includes(q));
      }
      filtered.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const stats = {
        total: rules.length,
        active: rules.filter((r: any) => r.status === "active").length,
        triggered: rules.filter((r: any) => r.status === "triggered").length,
        paused: rules.filter((r: any) => r.status === "paused").length,
      };
      return { rules: filtered, stats };
    }),

  // Get a single rule
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const rule = rules.find((r: any) => r.id === input.id);
      if (!rule) throw new Error("Rule not found");
      const events = alertEvents.filter((e: any) => e.ruleId === input.id).sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return { rule, events };
    }),

  // Create a new threshold rule
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      ownerId: z.string(),
      ownerName: z.string(),
      metric: z.string(),
      operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq", "pct_change_up", "pct_change_down"]),
      threshold: z.number(),
      checkIntervalMinutes: z.number().min(1).max(1440).optional(),
      cooldownMinutes: z.number().min(1).max(10080).optional(),
      severity: z.enum(["info", "warning", "critical"]),
      channels: z.array(z.enum(["email", "sms", "push", "webhook", "in-app"])),
      recipients: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => {
      const metricInfo = AVAILABLE_METRICS.find((m: any) => m.id === input.metric);
      if (!metricInfo) throw new Error("Invalid metric");

      const newRule: ThresholdRule = {
        id: `thr_${String(nextRuleId++).padStart(3, "0")}`,
        name: input.name,
        description: input.description ?? "",
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        metric: input.metric,
        metricLabel: metricInfo.label,
        dataSource: metricInfo.dataSource,
        operator: input.operator,
        threshold: input.threshold,
        unit: metricInfo.unit,
        checkIntervalMinutes: input.checkIntervalMinutes ?? 15,
        cooldownMinutes: input.cooldownMinutes ?? 60,
        severity: input.severity,
        channels: input.channels,
        recipients: input.recipients ?? [],
        status: "active",
        lastCheckedAt: null,
        lastTriggeredAt: null,
        triggerCount: 0,
        currentValue: null,
        tags: input.tags ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rules.push(newRule);
      return newRule;
    }),

  // Update a rule
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq", "pct_change_up", "pct_change_down"]).optional(),
      threshold: z.number().optional(),
      checkIntervalMinutes: z.number().optional(),
      cooldownMinutes: z.number().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      channels: z.array(z.enum(["email", "sms", "push", "webhook", "in-app"])).optional(),
      recipients: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => {
      const rule = rules.find((r: any) => r.id === input.id);
      if (!rule) throw new Error("Rule not found");
      if (input.name) rule.name = input.name;
      if (input.description !== undefined) rule.description = input.description;
      if (input.operator) rule.operator = input.operator;
      if (input.threshold !== undefined) rule.threshold = input.threshold;
      if (input.checkIntervalMinutes) rule.checkIntervalMinutes = input.checkIntervalMinutes;
      if (input.cooldownMinutes) rule.cooldownMinutes = input.cooldownMinutes;
      if (input.severity) rule.severity = input.severity;
      if (input.channels) rule.channels = input.channels;
      if (input.recipients) rule.recipients = input.recipients;
      if (input.tags) rule.tags = input.tags;
      rule.updatedAt = new Date().toISOString();
      return rule;
    }),

  // Pause/resume a rule
  toggleStatus: protectedProcedure
    .input(z.object({ id: z.string(), action: z.enum(["pause", "resume"]) }))
    .mutation(({ input }) => {
      const rule = rules.find((r: any) => r.id === input.id);
      if (!rule) throw new Error("Rule not found");
      rule.status = input.action === "pause" ? "paused" : "active";
      rule.updatedAt = new Date().toISOString();
      return { status: rule.status };
    }),

  // Delete a rule
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = rules.findIndex((r) => r.id === input.id);
      if (idx < 0) throw new Error("Rule not found");
      rules.splice(idx, 1);
      return { deleted: true };
    }),

  // Alert event history
  events: protectedProcedure
    .input(z.object({
      ruleId: z.string().optional(),
      severity: z.enum(["info", "warning", "critical", "all"]).optional(),
      acknowledged: z.boolean().optional(),
      limit: z.number().min(1).max(100).optional(),
    }).optional())
    .query(({ input }) => {
      let filtered = [...alertEvents];
      if (input?.ruleId) filtered = filtered.filter((e: any) => e.ruleId === input.ruleId);
      if (input?.severity && input.severity !== "all") filtered = filtered.filter((e: any) => e.severity === input.severity);
      if (input?.acknowledged !== undefined) filtered = filtered.filter((e: any) => e.acknowledged === input.acknowledged);
      filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { events: filtered.slice(0, input?.limit ?? 50), total: filtered.length };
    }),

  // Acknowledge an alert event
  acknowledge: protectedProcedure
    .input(z.object({ eventId: z.string(), userId: z.string(), userName: z.string() }))
    .mutation(({ input }) => {
      const event = alertEvents.find((e: any) => e.id === input.eventId);
      if (!event) throw new Error("Event not found");
      event.acknowledged = true;
      event.acknowledgedBy = input.userName;
      event.acknowledgedAt = new Date().toISOString();
      return { acknowledged: true };
    }),

  // Resolve an alert event
  resolve: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(({ input }) => {
      const event = alertEvents.find((e: any) => e.id === input.eventId);
      if (!event) throw new Error("Event not found");
      event.resolvedAt = new Date().toISOString();
      // Also update the rule status
      const rule = rules.find((r: any) => r.id === event.ruleId);
      if (rule && rule.status === "triggered") rule.status = "resolved";
      return { resolved: true };
    }),

  // Simulate a threshold check (for testing)
  simulateCheck: protectedProcedure
    .input(z.object({ ruleId: z.string(), simulatedValue: z.number() }))
    .mutation(async ({ input }) => {
      const rule = rules.find((r: any) => r.id === input.ruleId);
      if (!rule) throw new Error("Rule not found");

      rule.currentValue = input.simulatedValue;
      rule.lastCheckedAt = new Date().toISOString();

      let breached = false;
      switch (rule.operator) {
        case "gt": breached = input.simulatedValue > rule.threshold; break;
        case "gte": breached = input.simulatedValue >= rule.threshold; break;
        case "lt": breached = input.simulatedValue < rule.threshold; break;
        case "lte": breached = input.simulatedValue <= rule.threshold; break;
        case "eq": breached = input.simulatedValue === rule.threshold; break;
        case "neq": breached = input.simulatedValue !== rule.threshold; break;
        case "pct_change_up": breached = input.simulatedValue > rule.threshold; break;
        case "pct_change_down": breached = input.simulatedValue > rule.threshold; break;
      }

      if (breached) {
        rule.status = "triggered";
        rule.lastTriggeredAt = new Date().toISOString();
        rule.triggerCount++;
        const event: AlertEvent = {
          id: `evt_${String(nextEventId++).padStart(3, "0")}`,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          operator: rule.operator,
          threshold: rule.threshold,
          actualValue: input.simulatedValue,
          severity: rule.severity,
          channels: rule.channels,
          message: `${rule.metricLabel} is ${input.simulatedValue}${rule.unit}, ${OPERATOR_LABELS[rule.operator]} threshold of ${rule.threshold}${rule.unit}`,
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
        };
        alertEvents.push(event);

        // ── Dispatch notifications via email/SMS/push/webhook ──
        const breachEvent: BreachEvent = {
          eventId: event.id,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          metricLabel: rule.metricLabel,
          operator: rule.operator,
          threshold: rule.threshold,
          actualValue: input.simulatedValue,
          unit: rule.unit,
          severity: rule.severity,
          channels: rule.channels,
          recipients: rule.recipients,
          message: event.message,
          createdAt: event.createdAt,
        };
        const dispatchResult = await dispatchThresholdAlert(breachEvent, rule.cooldownMinutes);

        return { breached: true, event, notifications: dispatchResult.summary };
      }

      rule.updatedAt = new Date().toISOString();
      return { breached: false, currentValue: input.simulatedValue };
    }),

  // Notification history for threshold alerts
  notificationHistory: protectedProcedure
    .input(z.object({
      ruleId: z.string().optional(),
      channel: z.enum(["email", "sms", "push", "webhook", "in-app"]).optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional())
    .query(({ input }) => {
      return getNotificationHistory(input ?? undefined);
    }),

  // Cooldown status for all rules
  cooldownStatus: protectedProcedure.query(() => {
    return getCooldownStatus();
  }),

  // Clear expired cooldowns
  clearCooldowns: protectedProcedure.mutation(() => {
    const cleared = clearExpiredCooldowns();
    return { cleared };
  }),
});
