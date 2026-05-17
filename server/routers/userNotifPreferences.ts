/**
 * User Notification Preferences — End-user customizable per-category delivery channel preferences
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NotifCategory {
  id: string;
  name: string;
  description: string;
  group: string;
  icon: string;
}

interface ChannelPreference {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}

interface UserPreferences {
  userId: string;
  categories: Record<string, ChannelPreference>;
  quietHours: { enabled: boolean; start: string; end: string; timezone: string };
  digestMode: "instant" | "hourly" | "daily" | "weekly";
  language: string;
  updatedAt: number;
}

// ─── Notification Categories ─────────────────────────────────────────────────
const CATEGORIES: NotifCategory[] = [
  // Transactions
  { id: "txn_success", name: "Successful Transactions", description: "Notifications when transactions complete successfully", group: "Transactions", icon: "✅" },
  { id: "txn_failed", name: "Failed Transactions", description: "Alerts when transactions fail or are declined", group: "Transactions", icon: "❌" },
  { id: "txn_pending", name: "Pending Transactions", description: "Updates on transactions awaiting processing", group: "Transactions", icon: "⏳" },
  { id: "txn_reversal", name: "Transaction Reversals", description: "Notifications when transactions are reversed", group: "Transactions", icon: "↩️" },
  // Security
  { id: "sec_fraud", name: "Fraud Alerts", description: "Immediate alerts for suspected fraudulent activity", group: "Security", icon: "🚨" },
  { id: "sec_login", name: "Login Activity", description: "Notifications for new device logins and suspicious access", group: "Security", icon: "🔐" },
  { id: "sec_password", name: "Password Changes", description: "Confirmations when passwords are changed", group: "Security", icon: "🔑" },
  { id: "sec_kyc", name: "KYC Status Updates", description: "Updates on KYC verification progress", group: "Security", icon: "📋" },
  // Financial
  { id: "fin_settlement", name: "Settlement Reports", description: "Daily/weekly settlement summaries", group: "Financial", icon: "📊" },
  { id: "fin_commission", name: "Commission Earned", description: "Notifications when commissions are credited", group: "Financial", icon: "💰" },
  { id: "fin_float", name: "Float Balance Alerts", description: "Low balance warnings and top-up confirmations", group: "Financial", icon: "💳" },
  { id: "fin_rates", name: "Exchange Rate Alerts", description: "Triggered rate alerts for currency thresholds", group: "Financial", icon: "📈" },
  // System
  { id: "sys_maintenance", name: "Maintenance Windows", description: "Scheduled downtime and maintenance notices", group: "System", icon: "🔧" },
  { id: "sys_updates", name: "Platform Updates", description: "New features and platform improvement announcements", group: "System", icon: "🆕" },
  { id: "sys_compliance", name: "Compliance Notices", description: "Regulatory updates and compliance deadlines", group: "System", icon: "⚖️" },
  { id: "sys_broadcast", name: "Broadcast Messages", description: "System-wide announcements from administrators", group: "System", icon: "📢" },
];

// ─── Default Preferences ─────────────────────────────────────────────────────
function getDefaultPreferences(userId: string): UserPreferences {
  const categories: Record<string, ChannelPreference> = {};
  for (const cat of CATEGORIES) {
    // Security alerts default to all channels; others default to inApp + email
    const isSecurity = cat.group === "Security";
    categories[cat.id] = {
      email: true,
      sms: isSecurity,
      push: isSecurity,
      inApp: true,
    };
  }
  return {
    userId,
    categories,
    quietHours: { enabled: false, start: "22:00", end: "07:00", timezone: "Africa/Lagos" },
    digestMode: "instant",
    language: "en",
    updatedAt: Date.now(),
  };
}

// ─── In-memory store ─────────────────────────────────────────────────────────
const preferencesStore = new Map<string, UserPreferences>();

// ─── Router ──────────────────────────────────────────────────────────────────
export const userNotifPreferencesRouter = router({
  categories: protectedProcedure.query(() => {
    const groups: Record<string, NotifCategory[]> = {};
    for (const cat of CATEGORIES) {
      if (!groups[cat.group]) groups[cat.group] = [];
      groups[cat.group].push(cat);
    }
    return { categories: CATEGORIES, groups };
  }),

  getPreferences: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(({ input }) => {
      const userId = input.userId ?? "current_user";
      if (!preferencesStore.has(userId)) {
        preferencesStore.set(userId, getDefaultPreferences(userId));
      }
      return preferencesStore.get(userId)!;
    }),

  updateCategory: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      categoryId: z.string(),
      channels: z.object({
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        push: z.boolean().optional(),
        inApp: z.boolean().optional(),
      }),
    }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "current_user";
      if (!preferencesStore.has(userId)) {
        preferencesStore.set(userId, getDefaultPreferences(userId));
      }
      const prefs = preferencesStore.get(userId)!;
      const current = prefs.categories[input.categoryId];
      if (!current) throw new Error(`Category ${input.categoryId} not found`);
      if (input.channels.email !== undefined) current.email = input.channels.email;
      if (input.channels.sms !== undefined) current.sms = input.channels.sms;
      if (input.channels.push !== undefined) current.push = input.channels.push;
      if (input.channels.inApp !== undefined) current.inApp = input.channels.inApp;
      prefs.updatedAt = Date.now();
      return { success: true, category: input.categoryId, channels: current };
    }),

  bulkUpdate: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      updates: z.record(z.string(), z.object({
        email: z.boolean(),
        sms: z.boolean(),
        push: z.boolean(),
        inApp: z.boolean(),
      })),
    }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "current_user";
      if (!preferencesStore.has(userId)) {
        preferencesStore.set(userId, getDefaultPreferences(userId));
      }
      const prefs = preferencesStore.get(userId)!;
      for (const [catId, channels] of Object.entries(input.updates)) {
        prefs.categories[catId] = channels;
      }
      prefs.updatedAt = Date.now();
      return { success: true, updated: Object.keys(input.updates).length };
    }),

  updateQuietHours: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      enabled: z.boolean(),
      start: z.string().optional(),
      end: z.string().optional(),
      timezone: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "current_user";
      if (!preferencesStore.has(userId)) {
        preferencesStore.set(userId, getDefaultPreferences(userId));
      }
      const prefs = preferencesStore.get(userId)!;
      prefs.quietHours.enabled = input.enabled;
      if (input.start) prefs.quietHours.start = input.start;
      if (input.end) prefs.quietHours.end = input.end;
      if (input.timezone) prefs.quietHours.timezone = input.timezone;
      prefs.updatedAt = Date.now();
      return { success: true, quietHours: prefs.quietHours };
    }),

  updateDigestMode: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      mode: z.enum(["instant", "hourly", "daily", "weekly"]),
    }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "current_user";
      if (!preferencesStore.has(userId)) {
        preferencesStore.set(userId, getDefaultPreferences(userId));
      }
      const prefs = preferencesStore.get(userId)!;
      prefs.digestMode = input.mode;
      prefs.updatedAt = Date.now();
      return { success: true, digestMode: prefs.digestMode };
    }),

  resetToDefaults: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "current_user";
      preferencesStore.set(userId, getDefaultPreferences(userId));
      return { success: true } as any;
    }),

  enableAllForChannel: protectedProcedure
    .input(z.object({
      userId: z.string().optional(),
      channel: z.enum(["email", "sms", "push", "inApp"]),
      enabled: z.boolean(),
    }))
    .mutation(({ input }) => {
      const userId = input.userId ?? "current_user";
      if (!preferencesStore.has(userId)) {
        preferencesStore.set(userId, getDefaultPreferences(userId));
      }
      const prefs = preferencesStore.get(userId)!;
      for (const catId of Object.keys(prefs.categories)) {
        prefs.categories[catId][input.channel] = input.enabled;
      }
      prefs.updatedAt = Date.now();
      return { success: true, channel: input.channel, enabled: input.enabled };
    }),
});
