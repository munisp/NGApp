// @ts-nocheck
/**
 * Sprint 93 — Alert Notification tRPC Router
 *
 * Exposes endpoints for managing admin notification preferences,
 * viewing delivery history, sending test alerts, and managing
 * escalation rules.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getAdminPreferences,
  getAdminPreference,
  updateAdminPreference,
  addAdminPreference,
  getDeliveryHistory,
  getDeliveryStats,
  getEscalationRules,
  updateEscalationRule,
  sendTestAlert,
  dispatchSecurityAlert,
  cancelEscalation,
  type AlertSeverity,
  type AlertCategory,
  type DeliveryChannel,
  type DeliveryStatus,
} from "../services/securityAlertNotifier";

const severityEnum = z.enum(["critical", "high", "medium", "low", "info"]);
const categoryEnum = z.enum([
  "ransomware", "bulk_operation", "file_integrity", "exfiltration",
  "brute_force", "canary_trigger", "ddos", "deepfake", "unauthorized_access",
]);
const channelEnum = z.enum(["push", "email", "sms", "webhook", "slack"]);
const deliveryStatusEnum = z.enum(["pending", "sent", "delivered", "failed", "bounced"]);

export const alertNotificationsRouter = router({
  // ── Preferences ──────────────────────────────────────────────────────────

  /** List all admin notification preferences */
  listPreferences: protectedProcedure.query(() => {
    return getAdminPreferences();
  }),

  /** Get a single admin's notification preferences */
  getPreference: protectedProcedure
    .input(z.object({ adminId: z.string() }))
    .query(({ input }) => {
      const pref = getAdminPreference(input.adminId);
      if (!pref) return null;
      return pref;
    }),

  /** Update an admin's notification preferences */
  updatePreference: protectedProcedure
    .input(
      z.object({
        adminId: z.string(),
        channels: z
          .object({
            push: z.boolean().optional(),
            email: z.boolean().optional(),
            sms: z.boolean().optional(),
            webhook: z.boolean().optional(),
            slack: z.boolean().optional(),
          })
          .optional(),
        severityThreshold: severityEnum.optional(),
        quietHours: z
          .object({
            enabled: z.boolean(),
            startHour: z.number().min(0).max(23),
            endHour: z.number().min(0).max(23),
            overrideForCritical: z.boolean(),
          })
          .optional(),
        categories: z.array(categoryEnum).optional(),
        webhookUrl: z.string().url().optional(),
        slackWebhookUrl: z.string().url().optional(),
        adminEmail: z.string().email().optional(),
        adminPhone: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { adminId, ...updates } = input;
      const result = updateAdminPreference(adminId, updates);
      if (!result) {
        return { success: false, message: "Admin preference not found" };
      }
      return { success: true, preference: result };
    }),

  /** Add a new admin notification preference */
  addPreference: protectedProcedure
    .input(
      z.object({
        adminId: z.string(),
        adminName: z.string(),
        adminEmail: z.string().email(),
        adminPhone: z.string().optional(),
        channels: z.object({
          push: z.boolean(),
          email: z.boolean(),
          sms: z.boolean(),
          webhook: z.boolean(),
          slack: z.boolean(),
        }),
        severityThreshold: severityEnum,
        categories: z.array(categoryEnum),
        webhookUrl: z.string().url().optional(),
        slackWebhookUrl: z.string().url().optional(),
      })
    )
    .mutation(({ input }) => {
      addAdminPreference(input);
      return { success: true } as any;
    }),

  // ── Delivery History ─────────────────────────────────────────────────────

  /** Get delivery history with filters */
  getDeliveryHistory: protectedProcedure
    .input(
      z
        .object({
          alertId: z.string().optional(),
          adminId: z.string().optional(),
          channel: channelEnum.optional(),
          status: deliveryStatusEnum.optional(),
          limit: z.number().min(1).max(200).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(({ input }) => {
      return getDeliveryHistory(input ?? undefined);
    }),

  /** Get delivery statistics */
  getDeliveryStats: protectedProcedure.query(() => {
    return getDeliveryStats();
  }),

  // ── Escalation Rules ─────────────────────────────────────────────────────

  /** List all escalation rules */
  listEscalationRules: protectedProcedure.query(() => {
    return getEscalationRules();
  }),

  /** Update an escalation rule */
  updateEscalationRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        name: z.string().optional(),
        triggerAfterMinutes: z.number().min(1).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { ruleId, ...updates } = input;
      const result = updateEscalationRule(ruleId, updates);
      if (!result) {
        return { success: false, message: "Escalation rule not found" };
      }
      return { success: true, rule: result };
    }),

  // ── Test & Manual Dispatch ───────────────────────────────────────────────

  /** Send a test alert to verify notification configuration */
  sendTestAlert: protectedProcedure
    .input(
      z.object({
        adminId: z.string(),
        severity: severityEnum.optional(),
      })
    )
    .mutation(async ({ input }) => {
      return sendTestAlert(input.adminId, input.severity ?? "info");
    }),

  /** Manually dispatch a security alert (for testing or manual trigger) */
  manualDispatch: protectedProcedure
    .input(
      z.object({
        severity: severityEnum,
        category: categoryEnum,
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(2000),
        sourceIp: z.string().optional(),
        affectedResource: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await dispatchSecurityAlert({
        alertId: `manual-${Date.now()}`,
        ...input,
        timestamp: Date.now(),
      });
      return result;
    }),

  /** Cancel escalation for an acknowledged alert */
  cancelEscalation: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(({ input }) => {
      const cancelled = cancelEscalation(input.alertId);
      return { success: cancelled };
    }),
});
