import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// Real-time Transaction Monitor Router — Sprint 78

interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  severity: "info" | "warning" | "critical";
  conditionType: string;
  threshold: number;
  windowSeconds: number;
  enabled: boolean;
  cooldownSeconds: number;
}

interface MonitorAlert {
  alertId: string;
  ruleId: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  agentId: string | null;
  transactionRef: string | null;
  triggeredAt: number;
  acknowledged: boolean;
  resolved: boolean;
}

const defaultRules: AlertRule[] = [
  { ruleId: "R001", name: "High Velocity Agent", description: "Agent exceeds 50 tx/hour", severity: "warning", conditionType: "velocity", threshold: 50, windowSeconds: 3600, enabled: true, cooldownSeconds: 300 },
  { ruleId: "R002", name: "Large Transaction", description: "Single tx exceeds ₦1,000,000", severity: "critical", conditionType: "amount", threshold: 1000000, windowSeconds: 0, enabled: true, cooldownSeconds: 60 },
  { ruleId: "R003", name: "High Failure Rate", description: "Agent failure rate exceeds 20%", severity: "warning", conditionType: "failure_rate", threshold: 20, windowSeconds: 3600, enabled: true, cooldownSeconds: 600 },
  { ruleId: "R004", name: "Suspicious Customer Velocity", description: "Customer exceeds 10 tx/hour", severity: "critical", conditionType: "velocity", threshold: 10, windowSeconds: 3600, enabled: true, cooldownSeconds: 300 },
  { ruleId: "R005", name: "Micro-Transaction Flood", description: "100+ tx under ₦1000 in 1 hour", severity: "warning", conditionType: "velocity", threshold: 100, windowSeconds: 3600, enabled: true, cooldownSeconds: 600 },
  { ruleId: "R006", name: "Off-Hours Activity", description: "Transaction outside 6am-10pm", severity: "info", conditionType: "time", threshold: 0, windowSeconds: 0, enabled: true, cooldownSeconds: 0 },
  { ruleId: "R007", name: "Dormant Agent Activity", description: "Agent with no tx in 7 days suddenly active", severity: "warning", conditionType: "dormancy", threshold: 1, windowSeconds: 604800, enabled: true, cooldownSeconds: 86400 },
  { ruleId: "R008", name: "Geographic Anomaly", description: "Agent transacting from unusual location", severity: "critical", conditionType: "geo_anomaly", threshold: 100, windowSeconds: 0, enabled: true, cooldownSeconds: 600 },
];

const seedAlerts: MonitorAlert[] = [
  { alertId: "ALT-001", ruleId: "R002", severity: "critical", title: "Large Transaction Detected", message: "Agent AGT-001 processed ₦2,500,000 cash out", agentId: "AGT-001", transactionRef: "TX-LARGE-001", triggeredAt: Date.now() - 1800000, acknowledged: false, resolved: false },
  { alertId: "ALT-002", ruleId: "R001", severity: "warning", title: "High Velocity Alert", message: "Agent AGT-003 processed 62 transactions in last hour", agentId: "AGT-003", transactionRef: null, triggeredAt: Date.now() - 900000, acknowledged: false, resolved: false },
  { alertId: "ALT-003", ruleId: "R003", severity: "warning", title: "High Failure Rate", message: "Agent AGT-005 has 35% failure rate (14/40 failed)", agentId: "AGT-005", transactionRef: null, triggeredAt: Date.now() - 600000, acknowledged: true, resolved: false },
  { alertId: "ALT-004", ruleId: "R008", severity: "critical", title: "Geographic Anomaly", message: "Agent AGT-002 (Abuja) transacting from Lagos (450km away)", agentId: "AGT-002", transactionRef: "TX-GEO-001", triggeredAt: Date.now() - 300000, acknowledged: false, resolved: false },
  { alertId: "ALT-005", ruleId: "R006", severity: "info", title: "Off-Hours Activity", message: "Agent AGT-004 transacting at 3:15 AM", agentId: "AGT-004", transactionRef: "TX-LATE-001", triggeredAt: Date.now() - 120000, acknowledged: false, resolved: false },
];

export const txMonitorRouter = router({
  getRules: protectedProcedure.query(() => {
    return { rules: defaultRules, total: defaultRules.length, activeCount: defaultRules.filter(r => r.enabled).length };
  }),

  getAlerts: protectedProcedure
    .input(z.object({
      severity: z.enum(["all", "info", "warning", "critical"]).optional(),
      acknowledged: z.boolean().optional(),
      limit: z.number().min(1).max(200).optional(),
    }).optional())
    .query(({ input }) => {
      let alerts = [...seedAlerts];
      if (input?.severity && input.severity !== "all") alerts = alerts.filter(a => a.severity === input.severity);
      if (input?.acknowledged !== undefined) alerts = alerts.filter(a => a.acknowledged === input.acknowledged);
      const limit = input?.limit ?? 50;
      return { alerts: alerts.slice(0, limit), total: alerts.length };
    }),

  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(({ input }) => {
      const alert = seedAlerts.find(a => a.alertId === input.alertId);
      if (!alert) throw new Error("Alert not found");
      alert.acknowledged = true;
      return { success: true, alertId: input.alertId };
    }),

  resolveAlert: protectedProcedure
    .input(z.object({ alertId: z.string(), resolution: z.string().optional() }))
    .mutation(({ input }) => {
      const alert = seedAlerts.find(a => a.alertId === input.alertId);
      if (!alert) throw new Error("Alert not found");
      alert.resolved = true;
      alert.acknowledged = true;
      return { success: true, alertId: input.alertId };
    }),

  getDashboard: protectedProcedure.query(() => {
    const total = seedAlerts.length;
    const critical = seedAlerts.filter(a => a.severity === "critical").length;
    const warning = seedAlerts.filter(a => a.severity === "warning").length;
    const info = seedAlerts.filter(a => a.severity === "info").length;
    const unacknowledged = seedAlerts.filter(a => !a.acknowledged).length;
    const unresolved = seedAlerts.filter(a => !a.resolved).length;
    return {
      totalAlerts: total,
      critical,
      warning,
      info,
      unacknowledged,
      unresolved,
      rulesCount: defaultRules.length,
      activeRules: defaultRules.filter(r => r.enabled).length,
      recentAlerts: seedAlerts.slice(-5),
    };
  }),
});
