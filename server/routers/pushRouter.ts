import { TRPCError } from "@trpc/server";
/**
 * pushRouter.ts
 * tRPC procedures for PWA push notification subscription management.
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import {
  savePushSubscription,
  deletePushSubscription,
  getUserSubscriptions,
  sendPushToUser,
} from "../pushNotifications";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const pushRouter = router({
  /**
   * Get the VAPID public key for the client to use when subscribing.
   */
  vapidPublicKey: publicProcedure.query(() => {
    return { publicKey: ENV.vapidPublicKey || null };
  }),

  /**
   * Save a push subscription for the current user.
   */
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await savePushSubscription(
        ctx.user.openId,
        { endpoint: input.endpoint, keys: input.keys },
        input.userAgent
      );
      return { success: true, message: "Push subscription saved" };
    }),

  /**
   * Remove a push subscription for the current user.
   */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await deletePushSubscription(ctx.user.openId, input.endpoint);
      return { success: true };
    }),

  /**
   * List active push subscriptions for the current user.
   */
  mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
    const subs = await getUserSubscriptions(ctx.user.openId);
    return subs.map(s => ({
      id: s.id,
      endpoint: s.endpoint,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
    }));
  }),

  /**
   * Check if push notifications are supported and configured.
   */
  status: protectedProcedure.query(() => {
    return {
      vapidConfigured: !!ENV.vapidPublicKey && !!ENV.vapidPrivateKey,
      publicKey: ENV.vapidPublicKey || null,
    };
  }),

  /**
   * Send a test push notification to the current user's subscriptions.
   * Used by the Settings page to verify the subscription is working.
   */
  testPush: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const subs = await getUserSubscriptions(ctx.user.openId);
      if (subs.length === 0) {
        throw new Error("No active push subscriptions found. Enable notifications in Settings first.");
      }
      const sent = await sendPushToUser(ctx.user.openId, {
        title: "OG RMM — Test Notification",
        body: `Push delivery confirmed for ${ctx.user.name ?? ctx.user.openId}. Critical alarms will appear here.`,
        icon: "/icon-192.png",
        tag: "test-push",
        url: "/settings",
        urgency: "normal",
      });
      if (sent === 0) {
        throw new Error("Failed to deliver to any subscription. They may have expired — try re-subscribing.");
      }
      // Log the test push
      try {
        const dbLog = await getDb();
        if (dbLog) {
          await dbLog.execute(
            sql`INSERT INTO push_log (user_id, title, body, tag, channel) VALUES (${ctx.user.openId}, 'OG RMM — Test Notification', ${'Push delivery confirmed for ' + (ctx.user.name ?? ctx.user.openId)}, 'test-push', 'push')`
          );
        }
      } catch { /* non-critical */ }
      return {
        success: true,
        sent,
        message: `Test notification sent to ${sent} device${sent > 1 ? "s" : ""}.`,
      };
    }),

  /**
   * Recent notification history for the current user (last 20 events).
   */
  myNotificationHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    try {
      const result = await db.execute(
        sql`SELECT id, title, body, tag, sent_at, well_id, alarm_id, channel FROM push_log WHERE user_id = ${ctx.user.openId} ORDER BY sent_at DESC LIMIT 20`
      );
      return ((result as any).rows ?? result) as Array<{
        id: number; title: string; body: string; tag: string | null;
        sent_at: string; well_id: string | null; alarm_id: string | null; channel: string | null;
      }>;
    } catch {
      return [];
    }
  }),
});
