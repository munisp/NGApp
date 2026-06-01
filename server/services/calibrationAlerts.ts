/**
 * calibrationAlerts.ts — Automated calibration due-date alert service
 * Runs every 6 hours, sends email + push notification for overdue/due-soon sensors
 */
import nodemailer from "nodemailer";
import { getDb } from "../db";
import { calibrationRecords } from "../../drizzle/schema";
import { lte, eq, or } from "drizzle-orm";
import { ENV } from "../_core/env";
import { notifyOwner } from "../_core/notification";

export async function checkCalibrationAlerts(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 86400000);

  // Find overdue or due-soon records
  const due = await db.select().from(calibrationRecords)
    .where(or(
      eq(calibrationRecords.status, "OVERDUE"),
      eq(calibrationRecords.status, "DUE_SOON"),
      lte(calibrationRecords.nextDueAt, sevenDaysOut),
    ))
    .limit(100);

  if (due.length === 0) return;

  const overdue = due.filter(r => r.status === "OVERDUE" || (r.nextDueAt && r.nextDueAt < now));
  const dueSoon = due.filter(r => r.status === "DUE_SOON" || (r.nextDueAt && r.nextDueAt >= now));

  const subject = `[OG-RMM] Calibration Alert: ${overdue.length} overdue, ${dueSoon.length} due soon`;
  const body = [
    `<h2>Calibration Due-Date Alert</h2>`,
    `<p>Generated: ${now.toISOString()}</p>`,
    overdue.length > 0 ? `<h3 style="color:#DC2626">Overdue (${overdue.length})</h3><ul>${overdue.map(r => `<li>${r.tag} — Well ${r.wellId} — ${r.sensorType} — Due: ${r.nextDueAt?.toISOString().split("T")[0]}</li>`).join("")}</ul>` : "",
    dueSoon.length > 0 ? `<h3 style="color:#D97706">Due Soon (${dueSoon.length})</h3><ul>${dueSoon.map(r => `<li>${r.tag} — Well ${r.wellId} — ${r.sensorType} — Due: ${r.nextDueAt?.toISOString().split("T")[0]}</li>`).join("")}</ul>` : "",
  ].join("");

  // Send email only when SMTP credentials are explicitly configured (not defaults)
  const smtpHost = ENV.smtpHost;
  const smtpUser = ENV.smtpUser;
  const smtpPass = ENV.smtpPass;
  const smtpConfigured = smtpHost &&
    smtpHost !== "smtp.gmail.com" &&
    smtpHost !== "smtp.example.com" &&
    smtpUser &&
    !smtpUser.includes("@example.com") &&
    smtpPass &&
    smtpPass !== "og-rmm-smtp-password-default";
  if (smtpConfigured) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: ENV.smtpPort,
        secure: ENV.smtpSecure,
        auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
      });
      await transporter.sendMail({
        from: ENV.smtpFrom || "noreply@og-rmm.local",
        to: ENV.alertEmailRecipients || ENV.smtpUser,
        subject,
        html: body,
      });
    } catch (e) {
      console.error("[CalibrationAlerts] Email failed:", e);
    }
  }

  // Always notify owner via platform notification
  await notifyOwner({
    title: subject,
    content: `${overdue.length} sensors overdue, ${dueSoon.length} due within 7 days. Check the Calibration page for details.`,
  });
}

export function startCalibrationAlertScheduler(): void {
  // Run immediately on startup, then every 6 hours
  checkCalibrationAlerts().catch(console.error);
  setInterval(() => checkCalibrationAlerts().catch(console.error), 6 * 3600 * 1000);
  console.log("[CalibrationAlerts] Scheduler started (every 6h)");
}
