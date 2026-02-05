import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';

/**
 * Push Notification Testing Router
 * Provides endpoints to test push notification delivery
 */
export const pushTestRouter = router({
  /**
   * Send a test push notification to the current user
   */
  sendTestNotification: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        body: z.string().min(1).max(200),
        data: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // In production, this would send via Expo Push Notification service
      // For now, we'll return success and log the notification
      console.log('[Push Test] Sending test notification:', {
        userId,
        title: input.title,
        body: input.body,
        data: input.data,
      });

      return {
        success: true,
        message: 'Test notification sent successfully',
        notification: {
          title: input.title,
          body: input.body,
          data: input.data,
          sentAt: new Date().toISOString(),
        },
      };
    }),

  /**
   * Send a test notification using Expo Push API
   * Requires the user to have a registered push token
   */
  sendExpoPushNotification: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        body: z.string().min(1).max(200),
        data: z.record(z.any()).optional(),
        sound: z.enum(['default', 'none']).optional().default('default'),
        priority: z.enum(['default', 'normal', 'high']).optional().default('default'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get user's push token from database
      const { getDb } = await import('../db.js');
      const { notificationPreferences } = await import('../../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');

      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (!prefs || !prefs.pushToken) {
        throw new Error('No push token registered for this user');
      }

      // Send push notification via Expo Push API
      const message = {
        to: prefs.pushToken,
        sound: input.sound,
        title: input.title,
        body: input.body,
        data: input.data,
        priority: input.priority,
      };

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Expo Push API error: ${JSON.stringify(result)}`);
        }

        console.log('[Push Test] Expo push notification sent:', result);

        return {
          success: true,
          message: 'Push notification sent via Expo',
          result,
          sentAt: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error('[Push Test] Failed to send Expo push notification:', error);
        throw new Error(`Failed to send push notification: ${error.message}`);
      }
    }),

  /**
   * Get push notification statistics for the current user
   */
  getPushStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { getDb } = await import('../db.js');
    const { notificationPreferences } = await import('../../drizzle/schema.js');
    const { eq } = await import('drizzle-orm');

    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return {
      hasToken: !!prefs?.pushToken,
      pushEnabled: prefs?.pushEnabled ?? false,
      token: prefs?.pushToken ? `${prefs.pushToken.substring(0, 20)}...` : null,
      registeredAt: prefs?.createdAt?.toISOString() ?? null,
    };
  }),
});

export default pushTestRouter;
