import { getDb } from '../db';
import { notificationPreferences, users } from '../../drizzle/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  badge?: number;
  channelId?: string;
}

interface PushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

interface PushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

/**
 * Send a push notification to a single user
 */
export async function sendPushNotification(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, string> }
): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'Database not available' };
  }

  // Get user's push token
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, parseInt(userId)),
        eq(notificationPreferences.pushEnabled, true),
        isNotNull(notificationPreferences.pushToken)
      )
    )
    .limit(1);

  if (!prefs || !prefs.pushToken) {
    return { success: false, error: 'No push token registered for user' };
  }

  const message: PushMessage = {
    to: prefs.pushToken,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    sound: 'default',
    priority: 'high',
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
      console.error('[Push] Expo API error:', result);
      return { success: false, error: `Expo API error: ${JSON.stringify(result)}` };
    }

    const ticket = result.data as PushTicket;
    if (ticket.status === 'error') {
      console.error('[Push] Ticket error:', ticket);
      return { success: false, error: ticket.message || ticket.details?.error };
    }

    console.log('[Push] Notification sent successfully:', ticket.id);
    return { success: true, ticketId: ticket.id };
  } catch (error: any) {
    console.error('[Push] Failed to send notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple users in batch
 * Expo recommends batching up to 100 notifications per request
 */
export async function sendBatchPushNotifications(
  notifications: Array<{
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }>
): Promise<{
  successful: number;
  failed: number;
  results: Array<{ userId: string; success: boolean; ticketId?: string; error?: string }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      successful: 0,
      failed: notifications.length,
      results: notifications.map((n) => ({
        userId: n.userId,
        success: false,
        error: 'Database not available',
      })),
    };
  }

  // Get all user push tokens
  const userIds = notifications.map((n) => parseInt(n.userId));
  const allPrefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.pushEnabled, true),
        isNotNull(notificationPreferences.pushToken)
      )
    );

  const tokenMap = new Map(allPrefs.map((p) => [p.userId.toString(), p.pushToken]));

  // Build messages for users with tokens
  const messages: PushMessage[] = [];
  const messageUserMap: string[] = [];

  for (const notification of notifications) {
    const token = tokenMap.get(notification.userId);
    if (token) {
      messages.push({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default',
        priority: 'high',
      });
      messageUserMap.push(notification.userId);
    }
  }

  if (messages.length === 0) {
    return {
      successful: 0,
      failed: notifications.length,
      results: notifications.map((n) => ({
        userId: n.userId,
        success: false,
        error: 'No push token registered',
      })),
    };
  }

  // Send in batches of 100
  const results: Array<{ userId: string; success: boolean; ticketId?: string; error?: string }> = [];
  const batchSize = 100;

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const batchUserIds = messageUserMap.slice(i, i + batchSize);

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[Push] Batch API error:', result);
        batchUserIds.forEach((userId) => {
          results.push({ userId, success: false, error: 'Expo API error' });
        });
        continue;
      }

      const tickets = result.data as PushTicket[];
      tickets.forEach((ticket, index) => {
        const userId = batchUserIds[index];
        if (ticket.status === 'ok') {
          results.push({ userId, success: true, ticketId: ticket.id });
        } else {
          results.push({
            userId,
            success: false,
            error: ticket.message || ticket.details?.error,
          });
        }
      });
    } catch (error: any) {
      console.error('[Push] Batch send error:', error);
      batchUserIds.forEach((userId) => {
        results.push({ userId, success: false, error: error.message });
      });
    }
  }

  // Add results for users without tokens
  for (const notification of notifications) {
    if (!results.find((r) => r.userId === notification.userId)) {
      results.push({
        userId: notification.userId,
        success: false,
        error: 'No push token registered',
      });
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`[Push] Batch complete: ${successful} successful, ${failed} failed`);

  return { successful, failed, results };
}

/**
 * Get all users with push notifications enabled
 */
export async function getUsersWithPushEnabled(): Promise<
  Array<{ userId: number; pushToken: string }>
> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const prefs = await db
    .select({
      userId: notificationPreferences.userId,
      pushToken: notificationPreferences.pushToken,
    })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.pushEnabled, true),
        isNotNull(notificationPreferences.pushToken)
      )
    );

  return prefs.filter((p) => p.pushToken !== null) as Array<{
    userId: number;
    pushToken: string;
  }>;
}

/**
 * Check push notification receipts for delivery status
 */
export async function checkPushReceipts(
  ticketIds: string[]
): Promise<Map<string, PushReceipt>> {
  const receipts = new Map<string, PushReceipt>();

  if (ticketIds.length === 0) {
    return receipts;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });

    const result = await response.json();

    if (response.ok && result.data) {
      for (const [id, receipt] of Object.entries(result.data)) {
        receipts.set(id, receipt as PushReceipt);
      }
    }
  } catch (error) {
    console.error('[Push] Failed to check receipts:', error);
  }

  return receipts;
}
