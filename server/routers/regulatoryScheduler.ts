/**
 * regulatoryScheduler.ts — Automated regulatory export scheduling tRPC router
 *
 * Provides:
 *   - regulatoryScheduler.getConfig: get current schedule configuration
 *   - regulatoryScheduler.updateConfig: update schedule (cron, recipients, standards)
 *   - regulatoryScheduler.triggerNow: manually trigger an export run
 *   - regulatoryScheduler.history: list past export runs with status and S3 URLs
 *   - regulatoryScheduler.status: get scheduler health and next run time
 *
 * The actual scheduler is started in server/_core/index.ts via startRegulatoryScheduler().
 * This router only exposes configuration and history to the PWA.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getRegulatorySchedulerStatus, triggerRegulatoryExport, updateRegulatorySchedulerConfig, getRegulatoryExportHistory } from "../regulatoryScheduler";

export const regulatorySchedulerRouter = router({
  /**
   * Get current scheduler configuration.
   */
  getConfig: protectedProcedure.query(() => {
    return getRegulatorySchedulerStatus();
  }),

  /**
   * Update scheduler configuration (cron expression, recipients, standards).
   */
  updateConfig: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        cronExpression: z.string().optional(), // e.g. "0 0 1 * *" = 1st of each month
        recipients: z.array(z.string().email()).optional(),
        standards: z.array(
          z.enum(["IEC_61511", "HSE_OSD", "ADNOC", "KOC", "ARAMCO", "BSEE", "EPA"])
        ).optional(),
        includeWellKPIs: z.boolean().optional(),
        includeAlarmStats: z.boolean().optional(),
        includeComplianceStatus: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      return updateRegulatorySchedulerConfig(input);
    }),

  /**
   * Manually trigger an export run immediately.
   */
  triggerNow: protectedProcedure
    .input(
      z.object({
        standards: z.array(
          z.enum(["IEC_61511", "HSE_OSD", "ADNOC", "KOC", "ARAMCO", "BSEE", "EPA"])
        ).optional(),
        recipients: z.array(z.string().email()).optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      return triggerRegulatoryExport(input ?? {});
    }),

  /**
   * List past export runs (last 50).
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(({ input }) => {
      return getRegulatoryExportHistory(input?.limit ?? 50);
    }),

  /**
   * Get scheduler health and next scheduled run time.
   */
  status: protectedProcedure.query(() => {
    return getRegulatorySchedulerStatus();
  }),
});
