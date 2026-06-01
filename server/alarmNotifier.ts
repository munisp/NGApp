/**
 * alarmNotifier.ts — Server-side cron for critical alarm push notifications
 *
 * Runs every 60 seconds. Finds severity-4 alarms that have been UNACKNOWLEDGED
 * for more than 5 minutes and fires:
 *   1. notifyOwner() — in-app push notification (always)
 *   2. escalateAlarm() — email (nodemailer) + SMS (Twilio) when configured
 *
 * ISA-18.2 compliance:
 *   - Severity 4 = "Critical" — immediate operator action required
 *   - Severity 3 = "High"     — email escalation after 15-minute delay
 *
 * State is now persisted to PostgreSQL (alarm_notification_state table) instead
 * of ephemeral in-memory Maps to survive restarts.
 */
import { getDb } from "./db";
import { alarms, alarmNotificationState } from "../drizzle/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { escalateAlarm } from "./alarmEscalation";
import { broadcastPush } from "./pushNotifications";
import logger from "./_core/logger";

// How long an alarm must be unacknowledged before we notify (5 minutes)
const NOTIFY_THRESHOLD_MS = 5 * 60 * 1000;

// Minimum interval between re-notifications for the same alarm (30 minutes)
const RE_NOTIFY_INTERVAL_MS = 30 * 60 * 1000;

// Email/SMS escalation delay for severity-3 alarms (15 minutes)
const HIGH_SEVERITY_ESCALATION_MS = 15 * 60 * 1000;

async function getNotificationState(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, alarmId: number) {
  const [state] = await db.select().from(alarmNotificationState).where(eq(alarmNotificationState.alarmId, alarmId)).limit(1);
  return state ?? null;
}

async function updateNotificationTimestamp(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, alarmId: number, field: "lastNotifiedAt" | "lastEscalatedAt") {
  const existing = await getNotificationState(db, alarmId);
  if (existing) {
    await db.update(alarmNotificationState).set({
      [field]: new Date(),
      notificationCount: (existing.notificationCount ?? 0) + 1,
      updatedAt: new Date(),
    }).where(eq(alarmNotificationState.alarmId, alarmId));
  } else {
    await db.insert(alarmNotificationState).values({
      alarmId,
      [field]: new Date(),
      notificationCount: 1,
    });
  }
}

async function checkCriticalAlarms() {
  const db = await getDb();
  if (!db) return;

  try {
    const fiveMinutesAgo = new Date(Date.now() - NOTIFY_THRESHOLD_MS);

    const criticalAlarms = await db
      .select()
      .from(alarms)
      .where(
        and(
          eq(alarms.state, "UNACKNOWLEDGED"),
          lte(alarms.createdAt, fiveMinutesAgo),
          gte(alarms.severity, 3)
        )
      )
      .limit(10);

    for (const alarm of criticalAlarms) {
      const now = Date.now();
      const state = await getNotificationState(db, alarm.id);
      const lastNotified = state?.lastNotifiedAt ? new Date(state.lastNotifiedAt).getTime() : 0;
      const lastEscalated = state?.lastEscalatedAt ? new Date(state.lastEscalatedAt).getTime() : 0;
      const minutesUnacked = Math.round((now - new Date(alarm.createdAt).getTime()) / 60000);

      // In-app push notification (severity 4, rate-limited)
      if (alarm.severity === 4 && now - lastNotified >= RE_NOTIFY_INTERVAL_MS) {
        const title = `🚨 CRITICAL ALARM — ${alarm.wellId}: ${alarm.tag}`;
        const content = [
          `**Well:** ${alarm.wellId}`,
          `**Tag:** ${alarm.tag}`,
          `**Description:** ${alarm.description}`,
          `**Severity:** ${alarm.severity} (Critical — ISA-18.2)`,
          `**State:** ${alarm.state}`,
          `**Unacknowledged for:** ${minutesUnacked} minutes`,
          alarm.value != null ? `**Current Value:** ${alarm.value} ${alarm.unit ?? ""}` : null,
          alarm.setpoint != null ? `**Setpoint:** ${alarm.setpoint} ${alarm.unit ?? ""}` : null,
          `**Alarm ID:** ${alarm.alarmId}`,
          `\n⚠️ Immediate operator action required per ISA-18.2 Critical alarm protocol.`,
        ].filter(Boolean).join("\n");

        const success = await notifyOwner({ title, content });
        const pushSent = await broadcastPush({
          title: `🚨 CRITICAL: ${alarm.wellId} — ${alarm.tag}`,
          body: `${alarm.description} | Unacked ${minutesUnacked} min`,
          tag: `alarm-${alarm.alarmId}`,
          url: `/alarms`,
          urgency: "high",
        });
        if (success || pushSent > 0) {
          await updateNotificationTimestamp(db, alarm.id, "lastNotifiedAt");
          logger.info({ alarmId: alarm.alarmId, wellId: alarm.wellId, minutesUnacked, pushSent }, "Alarm push sent");
        }
      }

      // Email + SMS escalation
      const escalationThreshold = alarm.severity === 4
        ? NOTIFY_THRESHOLD_MS
        : HIGH_SEVERITY_ESCALATION_MS;

      const alarmAgeMs = now - new Date(alarm.createdAt).getTime();
      const shouldEscalate =
        alarmAgeMs >= escalationThreshold &&
        now - lastEscalated >= RE_NOTIFY_INTERVAL_MS;

      if (shouldEscalate) {
        const result = await escalateAlarm({
          alarmId: alarm.alarmId,
          wellId: alarm.wellId,
          tag: alarm.tag,
          description: alarm.description,
          severity: alarm.severity,
          value: alarm.value ? Number(alarm.value) : null,
          setpoint: alarm.setpoint ? Number(alarm.setpoint) : null,
          unit: alarm.unit,
          minutesUnacked,
        });

        if (result.email || result.sms) {
          await updateNotificationTimestamp(db, alarm.id, "lastEscalatedAt");
          logger.info({ alarmId: alarm.alarmId, email: result.email, sms: result.sms, minutesUnacked }, "Alarm escalated");
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "AlarmNotifier check failed");
  }
}

/**
 * Start the alarm notification cron.
 * Runs immediately on startup, then every 60 seconds.
 */
export function startAlarmNotifier() {
  logger.info("AlarmNotifier started — checking critical alarms every 60s");

  setTimeout(() => {
    checkCriticalAlarms();
    setInterval(checkCriticalAlarms, 60_000);
  }, 30_000);
}
