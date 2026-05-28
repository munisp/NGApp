/**
 * email.ts — Nodemailer email service for user invitations
 *
 * Uses SMTP credentials from environment variables.
 * Falls back to logging the email content when SMTP is not configured.
 */

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "noreply@og-rmm.platform";

function createTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export interface InvitationEmailOptions {
  to: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
  message?: string;
  platformName?: string;
}

export async function sendInvitationEmail(opts: InvitationEmailOptions): Promise<boolean> {
  const transport = createTransport();
  const platform = opts.platformName ?? "OG-RMM Platform";
  const expiryStr = opts.expiresAt.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You've been invited to ${platform}</title></head>
<body style="font-family: Arial, sans-serif; background: #0a0e1a; color: #e2e8f0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #1a2744 0%, #0a0e1a 100%); padding: 32px; text-align: center; border-bottom: 1px solid #c9a84c40;">
      <h1 style="color: #c9a84c; margin: 0; font-size: 24px; letter-spacing: 0.05em;">${platform}</h1>
      <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px;">Oil & Gas Remote Monitoring & Management</p>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #f1f5f9; margin: 0 0 16px; font-size: 20px;">You've been invited</h2>
      <p style="color: #94a3b8; line-height: 1.6; margin: 0 0 16px;">
        <strong style="color: #e2e8f0;">${opts.inviterName}</strong> has invited you to join 
        <strong style="color: #e2e8f0;">${platform}</strong> as a 
        <strong style="color: #c9a84c;">${opts.role}</strong>.
      </p>
      ${opts.message ? `<div style="background: #1f2937; border-left: 3px solid #c9a84c; padding: 12px 16px; border-radius: 4px; margin: 0 0 24px; color: #cbd5e1; font-style: italic;">"${opts.message}"</div>` : ""}
      <div style="text-align: center; margin: 32px 0;">
        <a href="${opts.inviteUrl}" style="background: #c9a84c; color: #0a0e1a; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          Accept Invitation
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px;">Or copy this link:</p>
      <code style="background: #1f2937; color: #94a3b8; padding: 8px 12px; border-radius: 4px; font-size: 12px; display: block; word-break: break-all;">${opts.inviteUrl}</code>
      <p style="color: #64748b; font-size: 12px; margin: 24px 0 0; text-align: center;">
        This invitation expires on <strong>${expiryStr}</strong>.
      </p>
    </div>
    <div style="background: #0a0e1a; padding: 16px 32px; text-align: center; border-top: 1px solid #1f2937;">
      <p style="color: #475569; font-size: 11px; margin: 0;">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `You've been invited to ${platform} as a ${opts.role} by ${opts.inviterName}.

Accept your invitation: ${opts.inviteUrl}

This invitation expires on ${expiryStr}.
${opts.message ? `\nMessage from ${opts.inviterName}: "${opts.message}"` : ""}`;

  if (!transport) {
    // No SMTP configured — log to console for development
    console.log(`[Email] Would send invitation to ${opts.to}:`);
    console.log(`[Email] Invite URL: ${opts.inviteUrl}`);
    console.log(`[Email] Expires: ${expiryStr}`);
    return true; // Return true so the flow continues
  }

  try {
    await transport.sendMail({
      from: `"${platform}" <${SMTP_FROM}>`,
      to: opts.to,
      subject: `You've been invited to ${platform}`,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send invitation to ${opts.to}:`, err);
    return false;
  }
}
