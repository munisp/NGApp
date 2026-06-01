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
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getRegulatorySchedulerStatus, triggerRegulatoryExport, updateRegulatorySchedulerConfig, getRegulatoryExportHistory } from "../regulatoryScheduler";
import logger from "../_core/logger";

export const regulatorySchedulerRouter = router({
  getConfig: protectedProcedure.query(async () => {
    try {
      return getRegulatorySchedulerStatus();
    } catch (err) {
      logger.error({ err }, "regulatoryScheduler.getConfig failed");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get scheduler config" });
    }
  }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        cronExpression: z.string().optional(),
        recipients: z.array(z.string().email()).optional(),
        standards: z.array(
          z.enum(["IEC_61511", "HSE_OSD", "ADNOC", "KOC", "ARAMCO", "BSEE", "EPA"])
        ).optional(),
        includeWellKPIs: z.boolean().optional(),
        includeAlarmStats: z.boolean().optional(),
        includeComplianceStatus: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return updateRegulatorySchedulerConfig(input);
      } catch (err) {
        logger.error({ err }, "regulatoryScheduler.updateConfig failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update scheduler config" });
      }
    }),

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
      try {
        return await triggerRegulatoryExport(input ?? {});
      } catch (err) {
        logger.error({ err }, "regulatoryScheduler.triggerNow failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to trigger regulatory export" });
      }
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        return getRegulatoryExportHistory(input?.limit ?? 50);
      } catch (err) {
        logger.error({ err }, "regulatoryScheduler.history failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get export history" });
      }
    }),

  status: protectedProcedure.query(async () => {
    try {
      return getRegulatorySchedulerStatus();
    } catch (err) {
      logger.error({ err }, "regulatoryScheduler.status failed");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get scheduler status" });
    }
  }),
});
