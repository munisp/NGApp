/**
 * regulatoryScheduler.ts — Automated regulatory export scheduler
 *
 * Runs on a configurable cron schedule (default: 1st of each month at 06:00 UTC).
 * For each configured standard, it:
 *   1. Generates a PDF report using the existing regulatoryPDF module
 *   2. Uploads the PDF to S3 via storagePut
 *   3. Sends the PDF link via email (nodemailer) to configured recipients
 *   4. Falls back to notifyOwner if email is not configured
 *   5. Appends a run record to the in-memory history (last 100 runs)
 *
 * Started by calling startRegulatoryScheduler() from server/_core/index.ts.
 */

import cron from "node-cron";
import nodemailer from "nodemailer";
import { generateRegulatoryPDF, type ReportTemplate } from "./regulatoryPDF";
import { notifyOwner } from "./_core/notification";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegulatoryStandard =
  | "IEC_61511"
  | "HSE_OSD"
  | "ADNOC"
  | "KOC"
  | "ARAMCO"
  | "BSEE"
  | "EPA";

export interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string; // node-cron 5-field expression
  recipients: string[];
  standards: RegulatoryStandard[];
  includeWellKPIs: boolean;
  includeAlarmStats: boolean;
  includeComplianceStatus: boolean;
}

export interface ExportRun {
  id: string;
  triggeredAt: Date;
  triggeredBy: "scheduler" | "manual";
  standards: RegulatoryStandard[];
  recipients: string[];
  status: "running" | "success" | "partial" | "failed";
  reports: Array<{
    standard: RegulatoryStandard;
    status: "success" | "failed";
    s3Url?: string;
    error?: string;
    sizeBytes?: number;
  }>;
  emailSent: boolean;
  durationMs?: number;
  completedAt?: Date;
}

export interface SchedulerStatus {
  config: SchedulerConfig;
  running: boolean;
  lastRun?: ExportRun;
  nextRunAt?: string;
  totalRuns: number;
  successfulRuns: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SchedulerConfig = {
  enabled: true,
  cronExpression: "0 6 1 * *", // 1st of each month at 06:00 UTC
  recipients: [],
  standards: ["IEC_61511", "HSE_OSD"],
  includeWellKPIs: true,
  includeAlarmStats: true,
  includeComplianceStatus: true,
};

let config: SchedulerConfig = { ...DEFAULT_CONFIG };
let cronTask: ReturnType<typeof cron.schedule> | null = null;
let isRunning = false;
const exportHistory: ExportRun[] = [];
let totalRuns = 0;
let successfulRuns = 0;

// ─── Standard → PDF template mapping ─────────────────────────────────────────

const STANDARD_TO_TEMPLATE: Record<RegulatoryStandard, ReportTemplate> = {
  IEC_61511: "ADNOC_HSE",       // IEC 61511 SIL compliance maps to HSE template
  HSE_OSD: "ADNOC_HSE",         // UK HSE OSD maps to HSE template
  ADNOC: "ADNOC_PRODUCTION",
  KOC: "KOC_ENV",
  ARAMCO: "ARAMCO_WELL_INTEGRITY",
  BSEE: "ADNOC_PRODUCTION",     // BSEE maps to production template
  EPA: "KOC_ENV",               // EPA maps to environmental template
};

const STANDARD_LABELS: Record<RegulatoryStandard, string> = {
  IEC_61511: "IEC 61511 SIL Compliance",
  HSE_OSD: "UK HSE OSD Safety Case",
  ADNOC: "ADNOC Production Report",
  KOC: "KOC Environmental Report",
  ARAMCO: "Saudi Aramco Well Integrity",
  BSEE: "BSEE Production Report",
  EPA: "EPA Environmental Compliance",
};

// ─── Email transport ──────────────────────────────────────────────────────────

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

async function sendReportEmail(
  recipients: string[],
  run: ExportRun
): Promise<boolean> {
  const transport = createTransport();
  if (!transport || recipients.length === 0) return false;

  const successReports = run.reports.filter((r) => r.status === "success");
  const failedReports = run.reports.filter((r) => r.status === "failed");

  const reportLinks = successReports
    .map(
      (r) =>
        `<li><strong>${STANDARD_LABELS[r.standard]}</strong> — <a href="${r.s3Url}">Download PDF</a> (${Math.round((r.sizeBytes ?? 0) / 1024)} KB)</li>`
    )
    .join("\n");

  const failedList =
    failedReports.length > 0
      ? `<p><strong>Failed reports:</strong> ${failedReports.map((r) => STANDARD_LABELS[r.standard]).join(", ")}</p>`
      : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">OG-RMM Regulatory Export — ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
      </div>
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>The automated regulatory export has completed. ${successReports.length} of ${run.reports.length} reports generated successfully.</p>
        <ul>${reportLinks}</ul>
        ${failedList}
        <p style="color: #64748b; font-size: 12px;">
          Run ID: ${run.id} | Duration: ${run.durationMs}ms | Triggered: ${run.triggeredBy}
        </p>
      </div>
    </div>
  `;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? `"OG-RMM Platform" <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `[OG-RMM] Regulatory Export — ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("[RegulatoryScheduler] Email send failed:", err);
    return false;
  }
}

// ─── Core export logic ────────────────────────────────────────────────────────

export async function triggerRegulatoryExport(opts: {
  standards?: RegulatoryStandard[];
  recipients?: string[];
}): Promise<ExportRun> {
  const standards = opts.standards ?? config.standards;
  const recipients = opts.recipients ?? config.recipients;
  const runId = `reg-export-${Date.now()}`;
  const startedAt = Date.now();

  const run: ExportRun = {
    id: runId,
    triggeredAt: new Date(),
    triggeredBy: opts.standards ? "manual" : "scheduler",
    standards,
    recipients,
    status: "running",
    reports: [],
    emailSent: false,
  };

  exportHistory.unshift(run);
  if (exportHistory.length > 100) exportHistory.pop();
  totalRuns++;

  console.log(`[RegulatoryScheduler] Starting export run ${runId} — standards: ${standards.join(", ")}`);

  // Generate each report
  const period = new Date().toISOString().slice(0, 7); // "2026-04"

  for (const standard of standards) {
    try {
      const template = STANDARD_TO_TEMPLATE[standard];
      const reportId = `${standard}-${period}-${Date.now()}`;

      const { url, sizeBytes } = await generateRegulatoryPDF({
        template,
        period,
        language: "EN",
        generatedBy: "regulatory-scheduler",
        reportId,
      });

      run.reports.push({
        standard,
        status: "success",
        s3Url: url,
        sizeBytes,
      });

      console.log(`[RegulatoryScheduler] ${STANDARD_LABELS[standard]} — generated (${Math.round(sizeBytes / 1024)} KB)`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[RegulatoryScheduler] ${STANDARD_LABELS[standard]} — failed:`, errMsg);
      run.reports.push({
        standard,
        status: "failed",
        error: errMsg,
      });
    }
  }

  // Determine overall status
  const successCount = run.reports.filter((r) => r.status === "success").length;
  if (successCount === standards.length) {
    run.status = "success";
    successfulRuns++;
  } else if (successCount > 0) {
    run.status = "partial";
  } else {
    run.status = "failed";
  }

  run.durationMs = Date.now() - startedAt;
  run.completedAt = new Date();

  // Send email
  if (recipients.length > 0) {
    run.emailSent = await sendReportEmail(recipients, run);
  }

  // Fallback: notify owner via Manus notification
  if (!run.emailSent) {
    const successReports = run.reports.filter((r) => r.status === "success");
    const content =
      `Regulatory export completed (${successCount}/${standards.length} reports).\n\n` +
      successReports.map((r) => `• ${STANDARD_LABELS[r.standard]}: ${r.s3Url}`).join("\n");

    await notifyOwner({
      title: `[OG-RMM] Regulatory Export — ${period}`,
      content,
    }).catch((e) => console.warn("[RegulatoryScheduler] notifyOwner failed:", e));
  }

  console.log(
    `[RegulatoryScheduler] Run ${runId} completed — status: ${run.status}, duration: ${run.durationMs}ms`
  );

  return run;
}

// ─── Scheduler lifecycle ──────────────────────────────────────────────────────

export function startRegulatoryScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  if (!config.enabled) {
    console.log("[RegulatoryScheduler] Disabled — skipping cron registration");
    return;
  }

  if (!cron.validate(config.cronExpression)) {
    console.error(`[RegulatoryScheduler] Invalid cron expression: ${config.cronExpression}`);
    return;
  }

  cronTask = cron.schedule(config.cronExpression, async () => {
    if (isRunning) {
      console.warn("[RegulatoryScheduler] Previous run still in progress — skipping");
      return;
    }
    isRunning = true;
    try {
      await triggerRegulatoryExport({});
    } finally {
      isRunning = false;
    }
  });

  console.log(
    `[RegulatoryScheduler] Started — cron: "${config.cronExpression}", standards: ${config.standards.join(", ")}`
  );
}

// ─── Config & history accessors ───────────────────────────────────────────────

export function updateRegulatorySchedulerConfig(
  updates: Partial<SchedulerConfig>
): SchedulerStatus {
  config = { ...config, ...updates };
  // Restart scheduler with new config
  startRegulatoryScheduler();
  return getRegulatorySchedulerStatus();
}

export function getRegulatorySchedulerStatus(): SchedulerStatus {
  return {
    config,
    running: isRunning,
    lastRun: exportHistory[0],
    totalRuns,
    successfulRuns,
  };
}

export function getRegulatoryExportHistory(limit = 50): ExportRun[] {
  return exportHistory.slice(0, limit);
}
