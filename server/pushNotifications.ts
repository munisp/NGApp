/**
 * pushNotifications.ts
 * PWA Web Push notification service using web-push + VAPID.
 * Stores subscriptions in push_subscriptions table.
 * Called by alarmNotifier.ts for critical alarm delivery.
 */

import webpush from "web-push";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── VAPID Setup ──────────────────────────────────────────────────────────────

let vapidConfigured = false;

export function initWebPush() {
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey) {
    console.warn("[PushNotifications] VAPID keys not configured — push notifications disabled");
    return;
  }
  webpush.setVapidDetails(
    "mailto:ops@og-rmm.platform",
    ENV.vapidPublicKey,
    ENV.vapidPrivateKey
  );
  vapidConfigured = true;
  console.log("[PushNotifications] VAPID configured — push notifications enabled");
}

// ─── Subscription Management ──────────────────────────────────────────────────

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionPayload,
  userAgent?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Upsert: update if endpoint already exists for this user
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date(),
      },
    });
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getUserSubscriptions(userId: string): Promise<typeof pushSubscriptions.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

// ─── Send Push Notification ───────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  urgency?: "very-low" | "low" | "normal" | "high";
}

/**
 * Send a push notification to all subscriptions for a given user.
 * Silently removes stale/invalid subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!vapidConfigured) return 0;

  const db = await getDb();
  if (!db) return 0;

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return 0;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/icon-192.png",
    badge: payload.badge ?? "/icon-192.png",
    tag: payload.tag ?? "og-rmm-alert",
    data: { url: payload.url ?? "/" },
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
          { urgency: payload.urgency ?? "high" }
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — queue for removal
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error("[PushNotifications] Send error:", err.message);
        }
      }
    })
  );

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0 && db) {
    for (const endpoint of staleEndpoints) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    }
  }

  return sent;
}

/**
 * Broadcast a push notification to ALL subscribed users.
 * Used for system-wide critical alarms.
 */
export async function broadcastPush(payload: PushPayload): Promise<number> {
  if (!vapidConfigured) return 0;

  const db = await getDb();
  if (!db) return 0;

  const allSubs = await db.select().from(pushSubscriptions);
  if (allSubs.length === 0) return 0;

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/icon-192.png",
    badge: payload.badge ?? "/icon-192.png",
    tag: payload.tag ?? "og-rmm-critical",
    data: { url: payload.url ?? "/alarms" },
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    allSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification,
          { urgency: payload.urgency ?? "high" }
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length > 0 && db) {
    for (const endpoint of staleEndpoints) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    }
  }

  return sent;
}
