/**
 * Sprint 9: SMS Notifications tRPC Router
 *
 * Endpoints for sending SMS, checking delivery status, viewing logs,
 * and managing SMS provider configuration.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  sendSms,
  sendBatchSms,
  sendSmsWithRetry,
  getSmsProviderStatus,
  getSmsDeliveryLog,
  getSmsStats,
  normalizePhone,
  buildRateAlertSms,
  buildFraudAlertSms,
  buildTransactionConfirmSms,
  buildOtpSms,
  buildSettlementSms,
} from "../lib/smsService";

export const smsNotificationsRouter = router({
  // Send a single SMS
  send: protectedProcedure
    .input(
      z.object({
        to: z.string().min(8).max(20),
        body: z.string().min(1).max(480),
        from: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return sendSms(input);
    }),

  // Send SMS with retry
  sendWithRetry: protectedProcedure
    .input(
      z.object({
        to: z.string().min(8).max(20),
        body: z.string().min(1).max(480),
        maxRetries: z.number().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ input }) => {
      return sendSmsWithRetry({ to: input.to, body: input.body }, input.maxRetries);
    }),

  // Send batch SMS
  sendBatch: protectedProcedure
    .input(
      z.object({
        recipients: z.array(z.string().min(8).max(20)).min(1).max(100),
        body: z.string().min(1).max(480),
      })
    )
    .mutation(async ({ input }) => {
      return sendBatchSms(input.recipients, input.body);
    }),

  // Send templated SMS
  sendTemplate: protectedProcedure
    .input(
      z.object({
        to: z.string().min(8).max(20),
        template: z.enum(["rateAlert", "fraudAlert", "transactionConfirm", "otp", "settlement"]),
        params: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      let msg;
      switch (input.template) {
        case "rateAlert":
          msg = buildRateAlertSms(input.params as any);
          break;
        case "fraudAlert":
          msg = buildFraudAlertSms(input.params as any);
          break;
        case "transactionConfirm":
          msg = buildTransactionConfirmSms(input.params as any);
          break;
        case "otp":
          msg = buildOtpSms(input.params as any);
          break;
        case "settlement":
          msg = buildSettlementSms(input.params as any);
          break;
      }
      msg.to = input.to;
      return sendSms(msg);
    }),

  // Send test SMS
  sendTest: protectedProcedure
    .input(z.object({ to: z.string().min(8).max(20) }))
    .mutation(async ({ input }) => {
      return sendSms({
        to: input.to,
        body: "54Link POS: This is a test SMS notification. If you received this, SMS delivery is working correctly.",
      });
    }),

  // Normalize phone number
  normalizePhone: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(({ input }) => {
      return { normalized: normalizePhone(input.phone) };
    }),

  // Get provider status
  getProviderStatus: protectedProcedure.query(() => {
    return getSmsProviderStatus();
  }),

  // Get delivery log
  getDeliveryLog: protectedProcedure
    .input(
      z.object({
        phone: z.string().optional(),
        provider: z.enum(["twilio", "africastalking", "termii", "console"]).optional(),
        status: z.enum(["sent", "delivered", "failed", "pending"]).optional(),
        limit: z.number().min(1).max(500).default(50),
      })
    )
    .query(({ input }) => {
      return getSmsDeliveryLog(input);
    }),

  // Get SMS stats
  getStats: protectedProcedure.query(() => {
    return getSmsStats();
  }),
});
