import { z } from "zod";
import { protectedProcedure, router } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as notificationService from "../../onboarding/notificationChannelService";

export const notificationChannelsRouter = router({
  /**
   * Add a new notification channel
   */
  add: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
        channelType: z.enum(["slack", "email"]),
        channelName: z.string().min(1),
        config: z.union([
          z.object({
            webhookUrl: z.string().url(),
            channel: z.string().optional(),
            username: z.string().optional(),
            iconEmoji: z.string().optional(),
          }),
          z.object({
            to: z.string().email(),
            from: z.string().email().optional(),
            subject: z.string().optional(),
          }),
        ]),
        template: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await notificationService.addNotificationChannel(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to add channel",
        });
      }
    }),

  /**
   * Update notification channel
   */
  update: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        channelName: z.string().min(1).optional(),
        config: z
          .union([
            z.object({
              webhookUrl: z.string().url(),
              channel: z.string().optional(),
              username: z.string().optional(),
              iconEmoji: z.string().optional(),
            }),
            z.object({
              to: z.string().email(),
              from: z.string().email().optional(),
              subject: z.string().optional(),
            }),
          ])
          .optional(),
        template: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await notificationService.updateNotificationChannel(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update channel",
        });
      }
    }),

  /**
   * Delete notification channel
   */
  delete: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await notificationService.deleteNotificationChannel(input.channelId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete channel",
        });
      }
    }),

  /**
   * List all channels for a credential
   */
  list: protectedProcedure
    .input(
      z.object({
        credentialId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await notificationService.listNotificationChannels(input.credentialId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to list channels",
        });
      }
    }),

  /**
   * Test a notification channel
   */
  test: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await notificationService.sendNotification({
          channelId: input.channelId,
          event: "test",
          data: {
            text: "Test Notification",
            message: "This is a test notification from your webhook monitoring system.",
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to send test notification",
        });
      }
    }),

  /**
   * Get delivery history for a channel
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        limit: z.number().min(1).max(100).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await notificationService.getDeliveryHistory(
          input.channelId,
          input.limit
        );
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get delivery history",
        });
      }
    }),

  /**
   * Enable Do Not Disturb mode
   */
  enableDND: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        durationMinutes: z.number().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await notificationService.enableDND(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to enable DND",
        });
      }
    }),

  /**
   * Disable Do Not Disturb mode
   */
  disableDND: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await notificationService.disableDND(input.channelId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to disable DND",
        });
      }
    }),

  /**
   * Get DND status
   */
  getDNDStatus: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await notificationService.getDNDStatus(input.channelId);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get DND status",
        });
      }
    }),
});
