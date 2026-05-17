/**
 * Weekly Reports Router
 *
 * Provides procedures for:
 *  - Generating on-demand weekly reports
 *  - Listing report history
 *  - Viewing individual reports with trend comparison
 *  - Configuring the recurring schedule
 *  - Email delivery with distribution list management
 *  - PDF export with branded layout
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  generateWeeklyReport,
  getReportHistory,
  getReportById,
  getScheduleConfig,
  updateScheduleConfig,
  startWeeklyReportCron,
  stopWeeklyReportCron,
} from "../lib/weeklyReportGenerator";
import {
  calculateTrends,
  sendWeeklyReportEmail,
  generateReportPdfHtml,
  getEmailConfig,
  updateEmailConfig,
  addRecipient,
  removeRecipient,
  listRecipients,
} from "../lib/weeklyReportEnhancements";

export const weeklyReportsRouter = router({
  // ─── Core Report Operations ────────────────────────────────────────────

  /**
   * Generate a new weekly report on demand.
   */
  generate: protectedProcedure
    .input(
      z
        .object({
          notify: z.boolean().optional().default(true),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const notify = input?.notify ?? true;
      const report = await generateWeeklyReport(notify);
      return report;
    }),

  /**
   * List all stored reports (newest first) with summary info.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(52).optional().default(10),
          offset: z.number().min(0).optional().default(0),
        })
        .optional()
    )
    .query(({ input }) => {
      const limit = input?.limit ?? 10;
      const offset = input?.offset ?? 0;
      const all = getReportHistory();
      return {
        reports: all.slice(offset, offset + limit).map((r: any) => ({
          id: r.id,
          generatedAt: r.generatedAt,
          period: r.period,
          score: r.score,
          alertCount: r.alerts.length,
          recommendationCount: r.recommendations.length,
          txCount: r.metrics.transactions.totalCount,
          txValue: r.metrics.transactions.totalValue,
          activeUsers: r.metrics.userActivity.totalActiveUsers,
          errorRate: r.metrics.errors.errorRate,
          uptimePercent: r.metrics.system.uptimePercent,
        })),
        total: all.length,
      };
    }),

  /**
   * Get a specific report by ID with optional trend comparison.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => {
      const report = getReportById(input.id);
      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Report ${input.id} not found`,
        });
      }
      const trends = calculateTrends(report);
      return { report, trends };
    }),

  /**
   * Get the latest report with trends (convenience shortcut).
   */
  latest: protectedProcedure.query(() => {
    const history = getReportHistory();
    const report = history[0] ?? null;
    if (!report) return { report: null, trends: null };
    const trends = calculateTrends(report);
    return { report, trends };
  }),

  // ─── Trend Comparison ─────────────────────────────────────────────────

  /**
   * Get trend comparison for a specific report vs the previous week.
   */
  getTrends: protectedProcedure
    .input(z.object({ reportId: z.string().min(1) }))
    .query(({ input }) => {
      const report = getReportById(input.reportId);
      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Report ${input.reportId} not found`,
        });
      }
      const trends = calculateTrends(report);
      return { reportId: input.reportId, trends };
    }),

  // ─── Schedule Configuration ───────────────────────────────────────────

  /**
   * Get current schedule configuration.
   */
  getSchedule: protectedProcedure.query(() => {
    return getScheduleConfig();
  }),

  /**
   * Update the report schedule configuration.
   */
  updateSchedule: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        hourUtc: z.number().min(0).max(23).optional(),
        minuteUtc: z.number().min(0).max(59).optional(),
        notifyOwner: z.boolean().optional(),
        retentionWeeks: z.number().min(4).max(104).optional(),
      })
    )
    .mutation(({ input }) => {
      const config = updateScheduleConfig(input);

      // Restart cron with new settings
      stopWeeklyReportCron();
      if (config.enabled) {
        startWeeklyReportCron();
      }

      return config;
    }),

  // ─── Email Delivery ───────────────────────────────────────────────────

  /**
   * Send a weekly report via email to all recipients.
   */
  sendEmail: protectedProcedure
    .input(z.object({ reportId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const report = getReportById(input.reportId);
      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Report ${input.reportId} not found`,
        });
      }
      const result = await sendWeeklyReportEmail(report);
      return result;
    }),

  /**
   * Get email distribution configuration.
   */
  getEmailConfig: protectedProcedure.query(() => {
    return getEmailConfig();
  }),

  /**
   * Update email distribution settings (enabled, includeFullReport, etc.).
   */
  updateEmailConfig: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        includeFullReport: z.boolean().optional(),
        includePdfAttachment: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      return updateEmailConfig(input);
    }),

  /**
   * Add a recipient to the distribution list.
   */
  addRecipient: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).max(100),
        role: z.string().min(1).max(50),
      })
    )
    .mutation(({ input }) => {
      return addRecipient(input.email, input.name, input.role);
    }),

  /**
   * Remove a recipient from the distribution list.
   */
  removeRecipient: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(({ input }) => {
      return removeRecipient(input.email);
    }),

  /**
   * List all recipients in the distribution list.
   */
  listRecipients: protectedProcedure.query(() => {
    return listRecipients();
  }),

  // ─── PDF Export ───────────────────────────────────────────────────────

  /**
   * Generate PDF-ready HTML for a report (client converts to PDF via print).
   */
  getPdfHtml: protectedProcedure
    .input(z.object({ reportId: z.string().min(1) }))
    .query(({ input }) => {
      const report = getReportById(input.reportId);
      if (!report) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Report ${input.reportId} not found`,
        });
      }
      const trends = calculateTrends(report);
      const html = generateReportPdfHtml(report, trends);
      return { reportId: input.reportId, html };
    }),
});
