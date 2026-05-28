import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import nodemailer from "nodemailer";
import { getDb, getPool } from "../db";
import { withCache, cacheKey, TTL } from "../cache";
import { shiftHandovers } from "../../drizzle/schema";
import { isNull, desc, eq } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

const ShiftReportSchema = z.object({
  reportId: z.string(),
  shiftType: z.enum(["DAY", "NIGHT"]),
  shiftDate: z.string(),
  outgoingOperator: z.string(),
  incomingOperator: z.string().optional(),
  totalOilBpd: z.number(),
  totalGasMmscfd: z.number(),
  activeAlarms: z.number(),
  criticalAlarms: z.number(),
  workoversActive: z.number(),
  calibrationsDue: z.number(),
  notes: z.string().optional(),
  recipientEmail: z.string().email(),
});

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildShiftHandoverEmail(report: z.infer<typeof ShiftReportSchema>): string {
  const shiftLabel = report.shiftType === "DAY" ? "Day Shift (06:00–18:00)" : "Night Shift (18:00–06:00)";
  const alarmColor = report.criticalAlarms > 0 ? "#DC2626" : report.activeAlarms > 0 ? "#D97706" : "#16A34A";
  const now = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shift Handover Report</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:12px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#92400E,#D97706);padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FEF3C7;margin-bottom:6px;">OG RMM PLATFORM</div>
                    <div style="font-size:24px;font-weight:700;color:#FFFFFF;">Shift Handover Report</div>
                    <div style="font-size:14px;color:#FDE68A;margin-top:4px;">${shiftLabel} — ${report.shiftDate}</div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:10px 16px;text-align:center;">
                      <div style="font-size:10px;color:#FDE68A;text-transform:uppercase;letter-spacing:1px;">Generated</div>
                      <div style="font-size:12px;color:#FFFFFF;margin-top:2px;">${now}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Operators -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #334155;">
                    <div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Outgoing Operator</div>
                    <div style="font-size:16px;font-weight:600;color:#F1F5F9;">${report.outgoingOperator}</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #334155;">
                    <div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Incoming Operator</div>
                    <div style="font-size:16px;font-weight:600;color:#F1F5F9;">${report.incomingOperator || "TBD"}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Production KPIs -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Production Summary</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #334155;text-align:center;">
                    <div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Oil Production</div>
                    <div style="font-size:28px;font-weight:700;color:#D97706;font-family:monospace;margin:6px 0;">${report.totalOilBpd.toLocaleString()}</div>
                    <div style="font-size:11px;color:#64748B;">BPD</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #334155;text-align:center;">
                    <div style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Gas Production</div>
                    <div style="font-size:28px;font-weight:700;color:#38BDF8;font-family:monospace;margin:6px 0;">${report.totalGasMmscfd.toFixed(1)}</div>
                    <div style="font-size:11px;color:#64748B;">MMSCFD</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Operational Status -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Operational Status</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="23%" style="background:#0F172A;border-radius:8px;padding:14px;border:1px solid #334155;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:${alarmColor};font-family:monospace;">${report.activeAlarms}</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:4px;">Active Alarms</div>
                    ${report.criticalAlarms > 0 ? `<div style="font-size:10px;color:#DC2626;margin-top:2px;">${report.criticalAlarms} CRITICAL</div>` : ""}
                  </td>
                  <td width="2%"></td>
                  <td width="23%" style="background:#0F172A;border-radius:8px;padding:14px;border:1px solid #334155;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:#F59E0B;font-family:monospace;">${report.workoversActive}</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:4px;">Workovers Active</div>
                  </td>
                  <td width="2%"></td>
                  <td width="23%" style="background:#0F172A;border-radius:8px;padding:14px;border:1px solid #334155;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:${report.calibrationsDue > 0 ? "#F59E0B" : "#16A34A"};font-family:monospace;">${report.calibrationsDue}</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:4px;">Calibrations Due</div>
                  </td>
                  <td width="2%"></td>
                  <td width="25%" style="background:#0F172A;border-radius:8px;padding:14px;border:1px solid #334155;text-align:center;">
                    <div style="font-size:22px;font-weight:700;color:#16A34A;font-family:monospace;">LIVE</div>
                    <div style="font-size:10px;color:#94A3B8;margin-top:4px;">System Status</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notes -->
          ${report.notes ? `
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Handover Notes</div>
              <div style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #334155;border-left:3px solid #D97706;">
                <div style="font-size:14px;color:#CBD5E1;line-height:1.6;">${report.notes.replace(/\n/g, "<br/>")}</div>
              </div>
            </td>
          </tr>` : ""}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;">
              <div style="border-top:1px solid #334155;padding-top:20px;text-align:center;">
                <div style="font-size:11px;color:#475569;">This report was automatically generated by the OG RMM Platform.</div>
                <div style="font-size:11px;color:#475569;margin-top:4px;">Report ID: ${report.reportId} | For operational use only.</div>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const shiftHandoverRouter = router({
  // List recent handover records for history panel
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const key = cacheKey("shiftHandover", "list", { limit: input?.limit });
      return withCache(key, TTL.SHIFT_HANDOVER, async () => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(shiftHandovers)
          .orderBy(desc(shiftHandovers.createdAt))
          .limit(input?.limit ?? 20);
      });
    }),

  // Get the most recent unsigned (in-progress) handover
  getActive: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [active] = await db
      .select()
      .from(shiftHandovers)
      .where(isNull(shiftHandovers.signedOffAt))
      .orderBy(desc(shiftHandovers.createdAt))
      .limit(1);
    return active ?? null;
  }),

  // Create a new handover record
  create: protectedProcedure
    .input(z.object({
      shiftType: z.enum(["MORNING", "EVENING", "NIGHT"]),
      outgoingOperator: z.string().min(1),
      incomingOperator: z.string().optional(),
      notes: z.string().optional(),
      criticalAlarms: z.number().default(0),
      activeWorkovers: z.number().default(0),
      productionBpd: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const generatedShiftId = `SHR-${Date.now()}`;
      const [created] = await db
        .insert(shiftHandovers)
        .values({
          shiftId: generatedShiftId,
          shiftType: input.shiftType,
          date: new Date(),
          outgoingOperator: input.outgoingOperator,
          incomingOperator: input.incomingOperator,
          notes: input.notes,
          criticalAlarms: input.criticalAlarms,
          activeWorkovers: input.activeWorkovers,
          productionBpd: input.productionBpd,
        })
        .returning();
      return created;
    }),

  // Sign off an active handover
  signOff: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [updated] = await db
        .update(shiftHandovers)
        .set({ signedOffAt: new Date() })
        .where(eq(shiftHandovers.id, input.id))
        .returning();
      return updated;
    }),

  sendEmail: protectedProcedure
    .input(ShiftReportSchema)
    .mutation(async ({ input }) => {
      // Build transporter — uses SMTP_HOST/PORT/USER/PASS env vars if set,
      // otherwise falls back to Ethereal (test account) for development
      let transporter: nodemailer.Transporter;

      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: smtpUser, pass: smtpPass },
        });
      } else {
        // Development: use Ethereal test account
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
      }

      const shiftLabel = input.shiftType === "DAY" ? "Day Shift" : "Night Shift";
      const html = buildShiftHandoverEmail(input);

      const info = await transporter.sendMail({
        from: `"OG RMM Platform" <${process.env.SMTP_FROM || "noreply@og-rmm.platform"}>`,
        to: input.recipientEmail,
        subject: `[OG RMM] Shift Handover Report — ${shiftLabel} ${input.shiftDate}`,
        html,
      });

      // For Ethereal test accounts, return the preview URL
      const previewUrl = nodemailer.getTestMessageUrl(info);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null,
        recipient: input.recipientEmail,
      };
    }),

  // Generate a shift report summary from live DB state
  generateReport: protectedProcedure
    .input(z.object({
      shiftType: z.enum(["DAY", "NIGHT"]),
    }))
    .query(async ({ input }) => {
      const now = new Date();
      const shiftDate = now.toISOString().split("T")[0];

      let totalOilBpd = 0;
      let totalGasMmscfd = 0;
      let activeAlarms = 0;
      let criticalAlarms = 0;
      let workoversActive = 0;
      let calibrationsDue = 0;
      let outgoingOperator = "Operator";
      let incomingOperator = "Operator";

      try {
        const pool = await getPool();
        if (pool) {
          // Production totals from active wells
          const prodRows = await pool.query(
            `SELECT COALESCE(SUM(oil_bpd), 0) AS total_oil, COALESCE(SUM(gas_mmscfd), 0) AS total_gas FROM wells WHERE status = 'active'`
          );
          totalOilBpd = Math.round(Number(prodRows.rows[0]?.total_oil ?? 0));
          totalGasMmscfd = Math.round(Number(prodRows.rows[0]?.total_gas ?? 0) * 10) / 10;

          // Active alarms
          const alarmRows = await pool.query(
            `SELECT COUNT(*) FILTER (WHERE state IN ('UNACKNOWLEDGED','ACKNOWLEDGED')) AS active,
                    COUNT(*) FILTER (WHERE state IN ('UNACKNOWLEDGED','ACKNOWLEDGED') AND severity = 'CRITICAL') AS critical
             FROM alarms`
          );
          activeAlarms = Number(alarmRows.rows[0]?.active ?? 0);
          criticalAlarms = Number(alarmRows.rows[0]?.critical ?? 0);

          // Active workover jobs
          const workoverRows = await pool.query(
            `SELECT COUNT(*) AS cnt FROM workover_jobs WHERE status IN ('IN_PROGRESS','MOBILIZING')`
          );
          workoversActive = Number(workoverRows.rows[0]?.cnt ?? 0);

          // Calibrations due in next 7 days
          const calRows = await pool.query(
            `SELECT COUNT(*) AS cnt FROM calibration_records
             WHERE next_calibration_date <= NOW() + INTERVAL '7 days' AND status = 'PENDING'`
          );
          calibrationsDue = Number(calRows.rows[0]?.cnt ?? 0);

          // Shift operators from shift_handovers table
          const shiftRows = await pool.query(
            `SELECT outgoing_operator, incoming_operator FROM shift_handovers
             WHERE DATE(created_at) = $1 ORDER BY created_at DESC LIMIT 1`,
            [shiftDate]
          );
          if (shiftRows.rows[0]) {
            outgoingOperator = shiftRows.rows[0].outgoing_operator || outgoingOperator;
            incomingOperator = shiftRows.rows[0].incoming_operator || incomingOperator;
          }
        }
      } catch (_e) {
        // Graceful degradation — return what we have
      }

      const notes = [
        totalOilBpd > 0 ? `Production: ${totalOilBpd.toLocaleString()} BPD oil, ${totalGasMmscfd} MMscfd gas.` : "Production data unavailable.",
        activeAlarms > 0 ? `${activeAlarms} active alarm${activeAlarms !== 1 ? "s" : ""} (${criticalAlarms} critical).` : "No active alarms.",
        workoversActive > 0 ? `${workoversActive} workover job${workoversActive !== 1 ? "s" : ""} in progress.` : "No active workovers.",
        calibrationsDue > 0 ? `${calibrationsDue} calibration${calibrationsDue !== 1 ? "s" : ""} due within 7 days.` : "No calibrations due.",
      ].join(" ");

      return {
        reportId: `SHR-${Date.now()}`,
        shiftType: input.shiftType,
        shiftDate,
        outgoingOperator,
        incomingOperator,
        totalOilBpd,
        totalGasMmscfd,
        activeAlarms,
        criticalAlarms,
        workoversActive,
        calibrationsDue,
        notes,
        status: "DRAFT" as const,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND", message: "Database unavailable" });
      const [row] = await db.select({ id: shiftHandovers.id, signedOffAt: shiftHandovers.signedOffAt })
        .from(shiftHandovers).where(eq(shiftHandovers.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Handover not found" });
      if (row.signedOffAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete a signed-off handover" });
      await db.delete(shiftHandovers).where(eq(shiftHandovers.id, input.id));
      return { success: true };
    }),
});
