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
 */
import { getDb } from "./db";
import { alarms } from "../drizzle/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { escalateAlarm } from "./alarmEscalation";
import { broadcastPush } from "./pushNotifications";

// Track alarms we've already notified about to prevent spam
const notifiedAlarmIds = new Set<number>();

// How long an alarm must be unacknowledged before we notify (5 minutes)
const NOTIFY_THRESHOLD_MS = 5 * 60 * 1000;

// Minimum interval between re-notifications for the same alarm (30 minutes)
const RE_NOTIFY_INTERVAL_MS = 30 * 60 * 1000;
const lastNotifiedAt = new Map<number, number>();
const lastEscalatedAt = new Map<number, number>();

// Email/SMS escalation delay for severity-3 alarms (15 minutes)
const HIGH_SEVERITY_ESCALATION_MS = 15 * 60 * 1000;

async function checkCriticalAlarms() {
  const db = await getDb();
  if (!db) return; // DB not available, skip

  try {
    const fiveMinutesAgo = new Date(Date.now() - NOTIFY_THRESHOLD_MS);

    // Find severity 3-4 UNACKNOWLEDGED alarms older than 5 minutes
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
      const lastNotified = lastNotifiedAt.get(alarm.id) ?? 0;
      const lastEscalated = lastEscalatedAt.get(alarm.id) ?? 0;
      const minutesUnacked = Math.round((now - new Date(alarm.createdAt).getTime()) / 60000);

      // ── In-app push notification (severity 4 only, rate-limited) ──────────
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
        // Also send PWA browser push notification to all subscribed operators
        const pushSent = await broadcastPush({
          title: `🚨 CRITICAL: ${alarm.wellId} — ${alarm.tag}`,
          body: `${alarm.description} | Unacked ${minutesUnacked} min`,
          tag: `alarm-${alarm.alarmId}`,
          url: `/alarms`,
          urgency: "high",
        });
        if (success || pushSent > 0) {
          lastNotifiedAt.set(alarm.id, now);
          console.log(`[AlarmNotifier] Push sent: ${alarm.alarmId} (${alarm.wellId} — ${minutesUnacked}min unacked, ${pushSent} PWA subscribers)`);
        }
      }

      // ── Email + SMS escalation ─────────────────────────────────────────────
      // Severity 4: escalate immediately (after 5-min threshold)
      // Severity 3: escalate after 15-minute delay
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
          lastEscalatedAt.set(alarm.id, now);
          console.log(
            `[AlarmNotifier] Escalated ${alarm.alarmId}: email=${result.email} sms=${result.sms} (${minutesUnacked}min unacked)`
          );
        }
      }
    }
  } catch (err) {
    console.warn("[AlarmNotifier] Check failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Start the alarm notification cron.
 * Runs immediately on startup, then every 60 seconds.
 */
export function startAlarmNotifier() {
  console.log("[AlarmNotifier] Started — checking critical alarms every 60s");

  // Initial check after 30 seconds (allow DB to connect first)
  setTimeout(() => {
    checkCriticalAlarms();
    setInterval(checkCriticalAlarms, 60_000);
  }, 30_000);
}
