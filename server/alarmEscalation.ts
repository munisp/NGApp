/**
 * alarmEscalation.ts — Email and SMS escalation for critical SCADA alarms
 *
 * Supports two notification channels:
 *   1. Email via SMTP (nodemailer) — configured with SMTP_HOST / SMTP_USER / SMTP_PASS
 *   2. SMS via Twilio — configured with TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM
 *
 * Both channels are optional and degrade gracefully when credentials are absent.
 * This keeps the alarm notifier functional in local dev without external services.
 *
 * ISA-18.2 escalation model:
 *   - Severity 4 (Critical): immediate email + SMS
 *   - Severity 3 (High):     email only, 15-minute delay
 *   - Severity 1-2:          in-app push notification only (handled by alarmNotifier.ts)
 */

import nodemailer from "nodemailer";

// ─── SMTP CONFIG ──────────────────────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;

// ─── TWILIO CONFIG ────────────────────────────────────────────────────────────
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? "";

// ─── ESCALATION RECIPIENTS ────────────────────────────────────────────────────
// Comma-separated list of email addresses and phone numbers to notify
const ESCALATION_EMAILS = (process.env.ALARM_ESCALATION_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
const ESCALATION_PHONES = (process.env.ALARM_ESCALATION_PHONES ?? "").split(",").map(s => s.trim()).filter(Boolean);

// ─── EMAIL TRANSPORT ─────────────────────────────────────────────────────────
function createTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export interface AlarmEscalationPayload {
  alarmId: string;
  wellId: string;
  tag: string;
  description: string;
  severity: number;
  value?: number | null;
  setpoint?: number | null;
  unit?: string | null;
  minutesUnacked: number;
}

/**
 * Send email escalation to all configured recipients.
 * Returns true if at least one email was sent successfully.
 */
export async function sendEmailEscalation(alarm: AlarmEscalationPayload): Promise<boolean> {
  if (ESCALATION_EMAILS.length === 0) {
    console.warn("[AlarmEscalation] No ALARM_ESCALATION_EMAILS configured — skipping email");
    return false;
  }

  const transport = createTransport();
  if (!transport) {
    console.warn("[AlarmEscalation] SMTP not configured (SMTP_HOST/USER/PASS) — skipping email");
    return false;
  }

  const severityLabel = alarm.severity === 4 ? "CRITICAL" : alarm.severity === 3 ? "HIGH" : "MEDIUM";
  const subject = `[OG-RMM] ${severityLabel} ALARM — ${alarm.wellId}: ${alarm.tag}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>OG-RMM Alarm Escalation</title></head>
<body style="font-family: monospace; background: #0a0a0a; color: #e5e5e5; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #dc2626; border-radius: 8px; overflow: hidden;">
    <div style="background: #dc2626; padding: 16px 24px;">
      <h2 style="margin: 0; color: white; font-size: 18px;">
        🚨 ${severityLabel} ALARM — ISA-18.2 Escalation
      </h2>
    </div>
    <div style="padding: 24px; background: #111;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #9ca3af; width: 140px;">Well ID</td><td style="padding: 6px 0; color: #f59e0b; font-weight: bold;">${alarm.wellId}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Tag</td><td style="padding: 6px 0;">${alarm.tag}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Description</td><td style="padding: 6px 0;">${alarm.description}</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Severity</td><td style="padding: 6px 0; color: #dc2626; font-weight: bold;">${alarm.severity} — ${severityLabel}</td></tr>
        ${alarm.value != null ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Current Value</td><td style="padding: 6px 0;">${alarm.value} ${alarm.unit ?? ""}</td></tr>` : ""}
        ${alarm.setpoint != null ? `<tr><td style="padding: 6px 0; color: #9ca3af;">Setpoint</td><td style="padding: 6px 0;">${alarm.setpoint} ${alarm.unit ?? ""}</td></tr>` : ""}
        <tr><td style="padding: 6px 0; color: #9ca3af;">Unacknowledged</td><td style="padding: 6px 0; color: #ef4444;">${alarm.minutesUnacked} minutes</td></tr>
        <tr><td style="padding: 6px 0; color: #9ca3af;">Alarm ID</td><td style="padding: 6px 0; font-size: 11px; color: #6b7280;">${alarm.alarmId}</td></tr>
      </table>
      <div style="margin-top: 20px; padding: 12px; background: #1f1f1f; border-left: 3px solid #dc2626; border-radius: 4px;">
        <p style="margin: 0; color: #fca5a5; font-size: 13px;">
          ⚠️ Immediate operator action required per ISA-18.2 Critical alarm protocol.
          Log in to the OG-RMM platform to acknowledge this alarm.
        </p>
      </div>
    </div>
    <div style="padding: 12px 24px; background: #0a0a0a; text-align: center; font-size: 11px; color: #4b5563;">
      OG-RMM Platform · Automated Alarm Escalation · Do not reply to this email
    </div>
  </div>
</body>
</html>`;

  const textBody = [
    `[OG-RMM] ${severityLabel} ALARM ESCALATION`,
    `Well: ${alarm.wellId}`,
    `Tag: ${alarm.tag}`,
    `Description: ${alarm.description}`,
    `Severity: ${alarm.severity} (${severityLabel})`,
    alarm.value != null ? `Current Value: ${alarm.value} ${alarm.unit ?? ""}` : null,
    alarm.setpoint != null ? `Setpoint: ${alarm.setpoint} ${alarm.unit ?? ""}` : null,
    `Unacknowledged for: ${alarm.minutesUnacked} minutes`,
    `Alarm ID: ${alarm.alarmId}`,
    ``,
    `Immediate operator action required per ISA-18.2.`,
  ].filter(Boolean).join("\n");

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to: ESCALATION_EMAILS.join(", "),
      subject,
      text: textBody,
      html: htmlBody,
    });
    console.log(`[AlarmEscalation] Email sent to ${ESCALATION_EMAILS.length} recipient(s) for alarm ${alarm.alarmId}`);
    return true;
  } catch (err) {
    console.error("[AlarmEscalation] Email send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Send SMS escalation via Twilio to all configured phone numbers.
 * Returns true if at least one SMS was sent successfully.
 */
export async function sendSmsEscalation(alarm: AlarmEscalationPayload): Promise<boolean> {
  if (ESCALATION_PHONES.length === 0) {
    console.warn("[AlarmEscalation] No ALARM_ESCALATION_PHONES configured — skipping SMS");
    return false;
  }

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.warn("[AlarmEscalation] Twilio not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER) — skipping SMS");
    return false;
  }

  // Dynamic import to avoid loading Twilio SDK when not needed
  const { default: Twilio } = await import("twilio");
  const client = Twilio(TWILIO_SID, TWILIO_TOKEN);

  const severityLabel = alarm.severity === 4 ? "CRITICAL" : "HIGH";
  const body = [
    `[OG-RMM] ${severityLabel} ALARM`,
    `Well: ${alarm.wellId} | Tag: ${alarm.tag}`,
    alarm.value != null ? `Value: ${alarm.value}${alarm.unit ? ` ${alarm.unit}` : ""}` : null,
    `Unacked: ${alarm.minutesUnacked}min`,
    `ID: ${alarm.alarmId}`,
    `ACK required — ISA-18.2`,
  ].filter(Boolean).join("\n");

  let successCount = 0;
  for (const to of ESCALATION_PHONES) {
    try {
      await client.messages.create({ from: TWILIO_FROM, to, body });
      console.log(`[AlarmEscalation] SMS sent to ${to} for alarm ${alarm.alarmId}`);
      successCount++;
    } catch (err) {
      console.error(`[AlarmEscalation] SMS to ${to} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return successCount > 0;
}

/**
 * Full escalation: send both email and SMS for a critical alarm.
 * Both channels are attempted independently; partial success is acceptable.
 */
export async function escalateAlarm(alarm: AlarmEscalationPayload): Promise<{ email: boolean; sms: boolean }> {
  const [email, sms] = await Promise.allSettled([
    sendEmailEscalation(alarm),
    sendSmsEscalation(alarm),
  ]);

  return {
    email: email.status === "fulfilled" && email.value,
    sms: sms.status === "fulfilled" && sms.value,
  };
}
