// @ts-nocheck
/**
 * Sprint 8: Email Notifications Router
 *
 * tRPC procedures for:
 *   - Email preference management (opt-in/out per category)
 *   - Email delivery log viewer (admin)
 *   - Provider status monitoring
 *   - Manual email sending (admin)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { sendEmail, sendBatchEmail, getProviderStatus, buildDigestEmail, type EmailMessage } from "../lib/emailService";
import { enqueueEmail, buildAlertEmail } from "../lib/emailQueue";

// ── Email Preferences (in-memory for demo, DB-backed in production) ──────────

interface EmailPreference {
  agentId: number;
  category: string;
  emailEnabled: boolean;
  frequency: "instant" | "daily" | "weekly" | "never";
}

const preferencesStore = new Map<string, EmailPreference>();

const CATEGORIES = [
  "transactions",
  "fraud",
  "security",
  "performance",
  "agents",
  "system",
  "rate_alerts",
  "kyc",
  "commission",
  "digest",
] as const;

// ── Delivery Log (in-memory for demo) ────────────────────────────────────────

interface DeliveryLogEntry {
  id: string;
  to: string;
  subject: string;
  provider: string;
  status: "sent" | "failed" | "bounced";
  messageId?: string;
  error?: string;
  category?: string;
  createdAt: Date;
}

const deliveryLog: DeliveryLogEntry[] = [];
const MAX_LOG_SIZE = 1000;

function logDelivery(entry: DeliveryLogEntry) {
  deliveryLog.unshift(entry);
  if (deliveryLog.length > MAX_LOG_SIZE) deliveryLog.pop();
}

// ── Router ───────────────────────────────────────────────────────────────────

export const emailNotificationsRouter = router({
  // Get email preferences for current agent
  getPreferences: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .query(({ input }) => {
      const prefs: Record<string, { emailEnabled: boolean; frequency: string }> = {};
      for (const cat of CATEGORIES) {
        const key = `${input.agentId}:${cat}`;
        const stored = preferencesStore.get(key);
        prefs[cat] = stored
          ? { emailEnabled: stored.emailEnabled, frequency: stored.frequency }
          : { emailEnabled: true, frequency: "instant" };
      }
      return { agentId: input.agentId, preferences: prefs, categories: [...CATEGORIES] };
    }),

  // Update email preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        preferences: z.record(
          z.string(),
          z.object({
            emailEnabled: z.boolean(),
            frequency: z.enum(["instant", "daily", "weekly", "never"]),
          })
        ),
      })
    )
    .mutation(({ input }) => {
      for (const [category, pref] of Object.entries(input.preferences)) {
        const key = `${input.agentId}:${category}`;
        preferencesStore.set(key, {
          agentId: input.agentId,
          category,
          emailEnabled: pref.emailEnabled,
          frequency: pref.frequency,
        });
      }
      return { success: true, updated: Object.keys(input.preferences).length };
    }),

  // Send a test email
  sendTest: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { subject, html, text } = buildAlertEmail({
        title: "Test Email from 54Link POS",
        message: "This is a test email to verify your email notification settings are working correctly.",
        severity: "low",
      });

      const result = await sendEmail({
        to: input.to,
        subject: input.subject ?? subject,
        html,
        text,
        category: "test",
      });

      logDelivery({
        id: `log_${Date.now()}`,
        to: input.to,
        subject: input.subject ?? subject,
        provider: result.provider,
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        error: result.error,
        category: "test",
        createdAt: new Date(),
      });

      return result;
    }),

  // Send email to specific address (admin)
  sendCustom: protectedProcedure
    .input(
      z.object({
        to: z.union([z.string().email(), z.array(z.string().email())]),
        subject: z.string().min(1).max(256),
        html: z.string().min(1),
        text: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await sendEmail({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        category: input.category,
      });

      const toStr = Array.isArray(input.to) ? input.to.join(", ") : input.to;
      logDelivery({
        id: `log_${Date.now()}`,
        to: toStr,
        subject: input.subject,
        provider: result.provider,
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        error: result.error,
        category: input.category,
        createdAt: new Date(),
      });

      return result;
    }),

  // Get delivery log (admin)
  getDeliveryLog: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(25),
        status: z.enum(["sent", "failed", "bounced", "all"]).default("all"),
        provider: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .query(({ input }) => {
      let filtered = [...deliveryLog];
      if (input.status !== "all") filtered = filtered.filter((e: any) => e.status === input.status);
      if (input.provider) filtered = filtered.filter((e: any) => e.provider === input.provider);
      if (input.category) filtered = filtered.filter((e: any) => e.category === input.category);

      const total = filtered.length;
      const start = (input.page - 1) * input.pageSize;
      const items = filtered.slice(start, start + input.pageSize);

      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // Get provider status (admin)
  getProviderStatus: protectedProcedure.query(() => {
    return {
      providers: getProviderStatus(),
      totalSent: deliveryLog.filter((e: any) => e.status === "sent").length,
      totalFailed: deliveryLog.filter((e: any) => e.status === "failed").length,
      lastSentAt: deliveryLog.find((e: any) => e.status === "sent")?.createdAt ?? null,
    };
  }),

  // Get delivery stats (admin dashboard)
  getStats: protectedProcedure.query(() => {
    const now = Date.now();
    const last24h = deliveryLog.filter((e: any) => now - e.createdAt.getTime() < 86_400_000);
    const last7d = deliveryLog.filter((e: any) => now - e.createdAt.getTime() < 7 * 86_400_000);

    const byProvider: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const entry of deliveryLog) {
      byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + 1;
      if (entry.category) byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    }

    return {
      total: deliveryLog.length,
      sent: deliveryLog.filter((e: any) => e.status === "sent").length,
      failed: deliveryLog.filter((e: any) => e.status === "failed").length,
      last24h: last24h.length,
      last7d: last7d.length,
      byProvider,
      byCategory,
    };
  }),
});
