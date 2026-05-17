/**
 * Sprint 92 — Ransomware & Bulk Operations Alert tRPC Router
 *
 * Provides real-time alerting and notification system for administrators
 * when ransomware mitigation triggers, bulk operation limits are reached,
 * or suspicious file integrity changes are detected.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import crypto from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "high" | "medium" | "low";
type AlertCategory = "ransomware" | "bulk_operation" | "file_integrity" | "exfiltration" | "brute_force" | "canary_trigger";
type AlertStatus = "active" | "acknowledged" | "investigating" | "resolved" | "false_positive";

interface SecurityAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  source: string;
  sourceIp: string | null;
  userId: number | null;
  userName: string | null;
  triggeredAt: number;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  resolvedAt: number | null;
  resolvedBy: string | null;
  metadata: Record<string, unknown>;
  actionsTaken: string[];
  relatedAlertIds: string[];
}

// ── In-memory alert store (production: PostgreSQL + Redis pub/sub) ────────────

const alertStore = new Map<string, SecurityAlert>();
const alertSubscribers = new Set<(alert: SecurityAlert) => void>();

function seedAlerts() {
  if (alertStore.size > 0) return;

  const alerts: Partial<SecurityAlert>[] = [
    {
      category: "ransomware",
      severity: "critical",
      status: "active",
      title: "Suspicious bulk file encryption detected",
      description: "Agent terminal T-0042 attempted to encrypt 847 transaction records in 12 seconds. Pattern matches known ransomware behavior (AES-256 bulk encryption). All write operations from this terminal have been suspended.",
      source: "File Integrity Monitor",
      sourceIp: "192.168.1.42",
      userId: 42,
      userName: "agent_kwame",
      metadata: { filesAffected: 847, encryptionPattern: "AES-256-CBC", terminalId: "T-0042", blockAction: "write_suspended" },
      actionsTaken: ["Write operations suspended for terminal T-0042", "Snapshot created for forensic analysis"],
    },
    {
      category: "bulk_operation",
      severity: "high",
      status: "active",
      title: "Bulk delete threshold exceeded",
      description: "User admin_fatima attempted to delete 2,340 records from the transactions table in a single operation. The configured threshold is 500 records per batch. Operation was blocked and requires supervisor approval.",
      source: "Bulk Operation Guard",
      sourceIp: "10.0.0.15",
      userId: 15,
      userName: "admin_fatima",
      metadata: { recordCount: 2340, threshold: 500, tableName: "transactions", operationType: "DELETE" },
      actionsTaken: ["Operation blocked", "Supervisor notification sent"],
    },
    {
      category: "file_integrity",
      severity: "high",
      status: "acknowledged",
      title: "Critical configuration file modified",
      description: "The file /etc/pos-shell/security.conf was modified outside of the approved change window. SHA-256 hash mismatch detected. Previous hash: a3f2...b8c1, Current hash: 7e9d...4f2a.",
      source: "File Integrity Monitor",
      sourceIp: null,
      userId: null,
      userName: null,
      metadata: { filePath: "/etc/pos-shell/security.conf", previousHash: "a3f2b8c1", currentHash: "7e9d4f2a", changeWindow: "02:00-04:00 UTC" },
      actionsTaken: ["Alert escalated to security team"],
      acknowledgedAt: Date.now() - 3600000,
      acknowledgedBy: "security_admin",
    },
    {
      category: "exfiltration",
      severity: "critical",
      status: "investigating",
      title: "Unusual data export volume detected",
      description: "API endpoint /api/trpc/reports.exportAll received 47 requests in 5 minutes from IP 203.0.113.99, downloading approximately 2.3 GB of transaction data. This exceeds the normal export pattern by 15x.",
      source: "Exfiltration Detector",
      sourceIp: "203.0.113.99",
      userId: 88,
      userName: "report_user",
      metadata: { requestCount: 47, timeWindowMinutes: 5, dataVolumeGB: 2.3, normalPatternMultiplier: 15 },
      actionsTaken: ["Rate limit applied to IP", "Export endpoint temporarily disabled", "Investigation opened"],
    },
    {
      category: "brute_force",
      severity: "medium",
      status: "resolved",
      title: "Brute force login attempt blocked",
      description: "IP 198.51.100.23 made 142 failed login attempts in 10 minutes targeting 8 different agent accounts. IP has been temporarily blocked for 24 hours.",
      source: "Brute Force Detector",
      sourceIp: "198.51.100.23",
      userId: null,
      userName: null,
      metadata: { failedAttempts: 142, timeWindowMinutes: 10, targetedAccounts: 8, blockDurationHours: 24 },
      actionsTaken: ["IP blocked for 24 hours", "Affected accounts notified", "Password reset recommended"],
      resolvedAt: Date.now() - 7200000,
      resolvedBy: "auto_resolver",
    },
    {
      category: "canary_trigger",
      severity: "critical",
      status: "active",
      title: "Canary record accessed",
      description: "A honeypot record in the financial_summaries table was accessed by user ID 99. This record is a canary designed to detect unauthorized data access. The user should not have access to this table.",
      source: "Canary Trap System",
      sourceIp: "10.0.0.99",
      userId: 99,
      userName: "suspicious_user",
      metadata: { canaryTable: "financial_summaries", canaryRecordId: "CANARY-001", accessType: "SELECT", expectedAccess: false },
      actionsTaken: ["User session terminated", "Account flagged for review"],
    },
  ];

  for (const partial of alerts) {
    const id = `alert_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    alertStore.set(id, {
      id,
      category: partial.category!,
      severity: partial.severity!,
      status: partial.status!,
      title: partial.title!,
      description: partial.description!,
      source: partial.source!,
      sourceIp: partial.sourceIp ?? null,
      userId: partial.userId ?? null,
      userName: partial.userName ?? null,
      triggeredAt: Date.now() - Math.floor(Math.random() * 86400000),
      acknowledgedAt: partial.acknowledgedAt ?? null,
      acknowledgedBy: partial.acknowledgedBy ?? null,
      resolvedAt: partial.resolvedAt ?? null,
      resolvedBy: partial.resolvedBy ?? null,
      metadata: partial.metadata ?? {},
      actionsTaken: partial.actionsTaken ?? [],
      relatedAlertIds: [],
    });
  }
}
seedAlerts();

export const ransomwareAlertsRouter = router({
  // Get all alerts with filtering
  getAlerts: protectedProcedure
    .input(z.object({
      category: z.enum(["all", "ransomware", "bulk_operation", "file_integrity", "exfiltration", "brute_force", "canary_trigger"]).default("all"),
      severity: z.enum(["all", "critical", "high", "medium", "low"]).default("all"),
      status: z.enum(["all", "active", "acknowledged", "investigating", "resolved", "false_positive"]).default("all"),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(5).max(50).default(20),
    }))
    .query(({ input }) => {
      let alerts = Array.from(alertStore.values());
      if (input.category !== "all") alerts = alerts.filter((a: SecurityAlert) => a.category === input.category);
      if (input.severity !== "all") alerts = alerts.filter((a: SecurityAlert) => a.severity === input.severity);
      if (input.status !== "all") alerts = alerts.filter((a: SecurityAlert) => a.status === input.status);

      alerts.sort((a: SecurityAlert, b: SecurityAlert) => {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const statusOrder: Record<string, number> = { active: 0, investigating: 1, acknowledged: 2, resolved: 3, false_positive: 4 };
        const sDiff = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
        if (sDiff !== 0) return sDiff;
        const stDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (stDiff !== 0) return stDiff;
        return b.triggeredAt - a.triggeredAt;
      });

      const total = alerts.length;
      const start = (input.page - 1) * input.pageSize;
      const paged = alerts.slice(start, start + input.pageSize);

      return { items: paged, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
    }),

  // Get alert statistics
  getStats: protectedProcedure.query(() => {
    const alerts = Array.from(alertStore.values());
    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = { active: 0, acknowledged: 0, investigating: 0, resolved: 0, false_positive: 0 };
    let activeCount = 0;

    for (const a of alerts) {
      bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
      byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      if (a.status === "active" || a.status === "investigating") activeCount++;
    }

    return {
      total: alerts.length,
      activeCount,
      bySeverity,
      byCategory,
      byStatus,
      recentCritical: alerts
        .filter((a: SecurityAlert) => a.severity === "critical" && a.status === "active")
        .sort((a: SecurityAlert, b: SecurityAlert) => b.triggeredAt - a.triggeredAt)
        .slice(0, 5),
    };
  }),

  // Acknowledge an alert
  acknowledge: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      note: z.string().optional(),
    }))
    .mutation(({ input, ctx }) => {
      const alert = alertStore.get(input.alertId);
      if (!alert) throw new Error("Alert not found");
      if (alert.status !== "active") throw new Error("Alert is not in active state");

      alert.status = "acknowledged";
      alert.acknowledgedAt = Date.now();
      alert.acknowledgedBy = ctx.user?.name ?? "admin";
      if (input.note) alert.actionsTaken.push(`Acknowledged: ${input.note}`);

      return { success: true, alert };
    }),

  // Start investigation
  investigate: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      note: z.string().optional(),
    }))
    .mutation(({ input, ctx }) => {
      const alert = alertStore.get(input.alertId);
      if (!alert) throw new Error("Alert not found");

      alert.status = "investigating";
      if (input.note) alert.actionsTaken.push(`Investigation started: ${input.note}`);

      return { success: true, alert };
    }),

  // Resolve an alert
  resolve: protectedProcedure
    .input(z.object({
      alertId: z.string(),
      resolution: z.enum(["resolved", "false_positive"]),
      note: z.string(),
    }))
    .mutation(({ input, ctx }) => {
      const alert = alertStore.get(input.alertId);
      if (!alert) throw new Error("Alert not found");

      alert.status = input.resolution;
      alert.resolvedAt = Date.now();
      alert.resolvedBy = ctx.user?.name ?? "admin";
      alert.actionsTaken.push(`${input.resolution === "false_positive" ? "Marked as false positive" : "Resolved"}: ${input.note}`);

      return { success: true, alert };
    }),

  // Get single alert detail
  getAlertDetail: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .query(({ input }) => {
      const alert = alertStore.get(input.alertId);
      if (!alert) throw new Error("Alert not found");
      return alert;
    }),
});
