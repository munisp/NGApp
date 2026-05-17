/**
 * Scheduled Report Generator — CRUD for report schedules + template engine
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ReportSchedule {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly";
  template: "transaction_summary" | "agent_performance" | "fraud_report" | "settlement_report" | "kyc_status" | "revenue_report";
  recipients: string[];
  enabled: boolean;
  lastRun: number | null;
  nextRun: number;
  createdAt: number;
  updatedAt: number;
  config: {
    includeCharts: boolean;
    format: "html" | "pdf";
    timezone: string;
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    hour: number; // 0-23
    minute: number; // 0-59
  };
}

interface ReportRun {
  id: string;
  scheduleId: string;
  status: "success" | "failed" | "pending";
  startedAt: number;
  completedAt: number | null;
  recipientCount: number;
  error: string | null;
  reportUrl: string | null;
}

// ─── In-memory store (replace with DB in production) ─────────────────────────
const schedules: ReportSchedule[] = [
  {
    id: "rpt_001",
    name: "Daily Transaction Summary",
    type: "daily",
    template: "transaction_summary",
    recipients: ["admin@54link.com", "finance@54link.com"],
    enabled: true,
    lastRun: Date.now() - 86400000,
    nextRun: Date.now() + 3600000,
    createdAt: Date.now() - 2592000000,
    updatedAt: Date.now() - 86400000,
    config: { includeCharts: true, format: "html", timezone: "Africa/Lagos", hour: 18, minute: 0 },
  },
  {
    id: "rpt_002",
    name: "Weekly Agent Performance",
    type: "weekly",
    template: "agent_performance",
    recipients: ["ops@54link.com"],
    enabled: true,
    lastRun: Date.now() - 604800000,
    nextRun: Date.now() + 259200000,
    createdAt: Date.now() - 5184000000,
    updatedAt: Date.now() - 604800000,
    config: { includeCharts: true, format: "pdf", timezone: "Africa/Lagos", dayOfWeek: 1, hour: 9, minute: 0 },
  },
  {
    id: "rpt_003",
    name: "Monthly Fraud Report",
    type: "monthly",
    template: "fraud_report",
    recipients: ["compliance@54link.com", "risk@54link.com"],
    enabled: true,
    lastRun: Date.now() - 2592000000,
    nextRun: Date.now() + 1296000000,
    createdAt: Date.now() - 7776000000,
    updatedAt: Date.now() - 2592000000,
    config: { includeCharts: true, format: "pdf", timezone: "Africa/Lagos", dayOfMonth: 1, hour: 8, minute: 0 },
  },
  {
    id: "rpt_004",
    name: "Daily Settlement Report",
    type: "daily",
    template: "settlement_report",
    recipients: ["finance@54link.com"],
    enabled: false,
    lastRun: null,
    nextRun: Date.now() + 7200000,
    createdAt: Date.now() - 604800000,
    updatedAt: Date.now() - 604800000,
    config: { includeCharts: false, format: "html", timezone: "Africa/Lagos", hour: 17, minute: 30 },
  },
];

const reportRuns: ReportRun[] = [
  { id: "run_001", scheduleId: "rpt_001", status: "success", startedAt: Date.now() - 86400000, completedAt: Date.now() - 86399000, recipientCount: 2, error: null, reportUrl: "/reports/txn-summary-2026-04-15.html" },
  { id: "run_002", scheduleId: "rpt_001", status: "success", startedAt: Date.now() - 172800000, completedAt: Date.now() - 172799000, recipientCount: 2, error: null, reportUrl: "/reports/txn-summary-2026-04-14.html" },
  { id: "run_003", scheduleId: "rpt_002", status: "success", startedAt: Date.now() - 604800000, completedAt: Date.now() - 604798000, recipientCount: 1, error: null, reportUrl: "/reports/agent-perf-w15.pdf" },
  { id: "run_004", scheduleId: "rpt_003", status: "failed", startedAt: Date.now() - 2592000000, completedAt: Date.now() - 2591999000, recipientCount: 0, error: "SMTP connection timeout", reportUrl: null },
];

// ─── Report Template Engine ──────────────────────────────────────────────────
const TEMPLATES: Record<string, { name: string; description: string; sections: string[] }> = {
  transaction_summary: {
    name: "Transaction Summary",
    description: "Daily/weekly/monthly transaction volume, amounts, and trends",
    sections: ["KPI Overview", "Transaction Volume by Type", "Top Agents by Volume", "Failed Transactions", "Commission Summary"],
  },
  agent_performance: {
    name: "Agent Performance",
    description: "Agent activity, ratings, onboarding funnel, and tier distribution",
    sections: ["Active vs Inactive Agents", "Top Performers", "Onboarding Funnel", "Tier Distribution", "Commission Leaderboard"],
  },
  fraud_report: {
    name: "Fraud Report",
    description: "Fraud detection rates, alert breakdown, resolution times",
    sections: ["Fraud Alert Summary", "Severity Breakdown", "Detection Rate Trend", "Top Fraud Types", "Resolution Time Analysis"],
  },
  settlement_report: {
    name: "Settlement Report",
    description: "Settlement success rates, pending amounts, reconciliation status",
    sections: ["Settlement Summary", "Success vs Failed", "Pending Settlements", "Agent Settlement Breakdown", "Reconciliation Exceptions"],
  },
  kyc_status: {
    name: "KYC Status Report",
    description: "KYC approval rates, pending reviews, document verification stats",
    sections: ["KYC Pipeline", "Approval Rate", "Pending Reviews", "Document Types", "Rejection Reasons"],
  },
  revenue_report: {
    name: "Revenue Report",
    description: "Revenue breakdown by type, tier, region, and trend analysis",
    sections: ["Total Revenue", "Revenue by Transaction Type", "Revenue by Agent Tier", "Regional Distribution", "Month-over-Month Trend"],
  },
};

function generateNextRunTime(config: ReportSchedule["config"], type: ReportSchedule["type"]): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(config.hour, config.minute, 0, 0);

  if (type === "daily") {
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  } else if (type === "weekly" && config.dayOfWeek !== undefined) {
    const currentDay = next.getDay();
    const daysUntil = (config.dayOfWeek - currentDay + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntil);
  } else if (type === "monthly" && config.dayOfMonth !== undefined) {
    next.setDate(config.dayOfMonth);
    if (next.getTime() <= now.getTime()) next.setMonth(next.getMonth() + 1);
  }

  return next.getTime();
}

// ─── Router ──────────────────────────────────────────────────────────────────
export const scheduledReportsRouter = router({
  list: protectedProcedure.query(() => {
    return {
      schedules: schedules.map((s: any) => ({
        ...s,
        templateName: TEMPLATES[s.template]?.name ?? s.template,
      })),
      total: schedules.length,
      enabled: schedules.filter((s: any) => s.enabled).length,
    };
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const schedule = schedules.find((s: any) => s.id === input.id);
      if (!schedule) throw new Error("Schedule not found");
      const runs = reportRuns.filter((r: any) => r.scheduleId === input.id).sort((a: any, b: any) => b.startedAt - a.startedAt);
      return { schedule, runs, template: TEMPLATES[schedule.template] };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["daily", "weekly", "monthly"]),
        template: z.enum(["transaction_summary", "agent_performance", "fraud_report", "settlement_report", "kyc_status", "revenue_report"]),
        recipients: z.array(z.string().email()).min(1),
        config: z.object({
          includeCharts: z.boolean(),
          format: z.enum(["html", "pdf"]),
          timezone: z.string(),
          dayOfWeek: z.number().min(0).max(6).optional(),
          dayOfMonth: z.number().min(1).max(31).optional(),
          hour: z.number().min(0).max(23),
          minute: z.number().min(0).max(59),
        }),
      })
    )
    .mutation(({ input }) => {
      const id = `rpt_${String(schedules.length + 1).padStart(3, "0")}`;
      const now = Date.now();
      const schedule: ReportSchedule = {
        id,
        name: input.name,
        type: input.type,
        template: input.template,
        recipients: input.recipients,
        enabled: true,
        lastRun: null,
        nextRun: generateNextRunTime(input.config, input.type),
        createdAt: now,
        updatedAt: now,
        config: input.config,
      };
      schedules.push(schedule);
      return { success: true, schedule };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        recipients: z.array(z.string().email()).min(1).optional(),
        enabled: z.boolean().optional(),
        config: z
          .object({
            includeCharts: z.boolean().optional(),
            format: z.enum(["html", "pdf"]).optional(),
            timezone: z.string().optional(),
            dayOfWeek: z.number().min(0).max(6).optional(),
            dayOfMonth: z.number().min(1).max(31).optional(),
            hour: z.number().min(0).max(23).optional(),
            minute: z.number().min(0).max(59).optional(),
          })
          .optional(),
      })
    )
    .mutation(({ input }) => {
      const idx = schedules.findIndex((s) => s.id === input.id);
      if (idx === -1) throw new Error("Schedule not found");
      const schedule = schedules[idx];
      if (input.name) schedule.name = input.name;
      if (input.recipients) schedule.recipients = input.recipients;
      if (input.enabled !== undefined) schedule.enabled = input.enabled;
      if (input.config) {
        schedule.config = { ...schedule.config, ...input.config };
        schedule.nextRun = generateNextRunTime(schedule.config, schedule.type);
      }
      schedule.updatedAt = Date.now();
      return { success: true, schedule };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = schedules.findIndex((s) => s.id === input.id);
      if (idx === -1) throw new Error("Schedule not found");
      schedules.splice(idx, 1);
      return { success: true } as any;
    }),

  runNow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const schedule = schedules.find((s: any) => s.id === input.id);
      if (!schedule) throw new Error("Schedule not found");
      const run: ReportRun = {
        id: `run_${String(reportRuns.length + 1).padStart(3, "0")}`,
        scheduleId: input.id,
        status: "success",
        startedAt: Date.now(),
        completedAt: Date.now() + 1200,
        recipientCount: schedule.recipients.length,
        error: null,
        reportUrl: `/reports/${schedule.template}-${new Date().toISOString().slice(0, 10)}.${schedule.config.format}`,
      };
      reportRuns.push(run);
      schedule.lastRun = run.startedAt;
      schedule.nextRun = generateNextRunTime(schedule.config, schedule.type);
      schedule.updatedAt = Date.now();
      return { success: true, run };
    }),

  templates: protectedProcedure.query(() => {
    return Object.entries(TEMPLATES).map(([key, tmpl]) => ({
      id: key,
      ...tmpl,
    }));
  }),

  recentRuns: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }))
    .query(({ input }) => {
      const limit = input?.limit ?? 20;
      return reportRuns
        .sort((a: any, b: any) => b.startedAt - a.startedAt)
        .slice(0, limit)
        .map((run: any) => ({
          ...run,
          scheduleName: schedules.find((s: any) => s.id === run.scheduleId)?.name ?? "Unknown",
        }));
    }),
});
