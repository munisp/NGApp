import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as rateAlertService from "../services/rateAlertService";

/**
 * Rate Alert tRPC Router
 * Provides API endpoints for managing exchange rate alerts
 */

export const rateAlertRouter = router({
  /**
   * Create a new rate alert
   */
  create: protectedProcedure
    .input(
      z.object({
        fromCurrency: z.string().min(3).max(10),
        toCurrency: z.string().min(3).max(10),
        targetRate: z.number().positive(),
        condition: z.enum(["above", "below", "exact"]),
        notifyEmail: z.boolean().optional(),
        notifySms: z.boolean().optional(),
        notifyPush: z.boolean().optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await rateAlertService.createRateAlert({
        userId: ctx.user.id,
        ...input,
      });
    }),

  /**
   * Get all rate alerts for the current user
   */
  list: protectedProcedure
    .input(
      z
        .object({
          includeInactive: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return await rateAlertService.getUserRateAlerts(ctx.user.id);
    }),

  /**
   * Get active rate alerts with current progress
   */
  listWithProgress: protectedProcedure.query(async ({ ctx }) => {
    return await rateAlertService.getUserRateAlertsWithProgress(ctx.user.id);
  }),

  /**
   * Update a rate alert
   */
  update: protectedProcedure
    .input(
      z.object({
        alertId: z.number(),
        targetRate: z.number().positive().optional(),
        condition: z.enum(["above", "below", "exact"]).optional(),
        notifyEmail: z.boolean().optional(),
        notifySms: z.boolean().optional(),
        notifyPush: z.boolean().optional(),
        expiresAt: z.date().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { alertId, ...updates } = input;
      return await rateAlertService.updateRateAlert(alertId, ctx.user.id, updates);
    }),

  /**
   * Delete a rate alert
   */
  delete: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await rateAlertService.deleteRateAlert(input.alertId, ctx.user.id);
      return { success: true };
    }),

  /**
   * Get rate alert history (triggered alerts)
   */
  history: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return await rateAlertService.getRateAlertHistory(ctx.user.id, input?.limit);
    }),

  /**
   * Get analytics for rate alerts
   */
  analytics: protectedProcedure.query(async ({ ctx }) => {
    return await rateAlertService.getRateAlertAnalytics(ctx.user.id);
  }),

  /**
   * Get monitor status (admin/debugging)
   */
  monitorStatus: protectedProcedure.query(async () => {
    const { getRateAlertMonitorStatus } = await import("../jobs/rateAlertMonitor");
    return getRateAlertMonitorStatus();
  }),
});
