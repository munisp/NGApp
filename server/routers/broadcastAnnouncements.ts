/**
 * Broadcast Announcements — System-wide announcements from admins to all users
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "critical" | "maintenance" | "feature";
  priority: "low" | "medium" | "high" | "urgent";
  target: "all" | "agents" | "admins" | "merchants";
  pinned: boolean;
  scheduledAt: number | null;
  expiresAt: number | null;
  publishedAt: number;
  createdBy: string;
  dismissedBy: string[]; // user IDs who dismissed
  readBy: string[]; // user IDs who read
  channels: ("banner" | "inbox" | "push" | "email" | "sms")[];
  metadata: Record<string, string>;
}

// ─── Seed data ───────────────────────────────────────────────────────────────
const announcements: Announcement[] = [
  {
    id: "ann_001", title: "Scheduled Maintenance — April 20", content: "The platform will undergo scheduled maintenance on April 20, 2026 from 02:00 to 06:00 WAT. All services will be temporarily unavailable. Please complete any pending transactions before this window.",
    type: "maintenance", priority: "high", target: "all", pinned: true, scheduledAt: null, expiresAt: Date.now() + 345600000,
    publishedAt: Date.now() - 86400000, createdBy: "admin", dismissedBy: [], readBy: ["agent_001", "agent_002"],
    channels: ["banner", "inbox", "email"], metadata: { duration: "4 hours", impact: "full" },
  },
  {
    id: "ann_002", title: "New Feature: Rate Alerts", content: "You can now set custom exchange rate alerts! Navigate to the Rate Alerts page to create threshold-based notifications for any currency pair. Get notified via email, SMS, or push when rates cross your targets.",
    type: "feature", priority: "medium", target: "all", pinned: false, scheduledAt: null, expiresAt: null,
    publishedAt: Date.now() - 172800000, createdBy: "admin", dismissedBy: ["agent_003"], readBy: ["agent_001", "agent_002", "agent_003"],
    channels: ["banner", "inbox"], metadata: {},
  },
  {
    id: "ann_003", title: "CBN Compliance Update", content: "New CBN regulations effective May 1, 2026 require enhanced KYC verification for transactions above ₦500,000. All agents must complete the updated compliance training by April 28.",
    type: "warning", priority: "urgent", target: "agents", pinned: true, scheduledAt: null, expiresAt: Date.now() + 1209600000,
    publishedAt: Date.now() - 259200000, createdBy: "compliance_admin", dismissedBy: [], readBy: ["agent_001"],
    channels: ["banner", "inbox", "push", "sms"], metadata: { regulation: "CBN/2026/04", deadline: "2026-04-28" },
  },
  {
    id: "ann_004", title: "Commission Rate Adjustment", content: "Effective immediately, commission rates for cash-in transactions above ₦100,000 have been increased by 0.1%. Check the Commission Config page for updated tier-based rates.",
    type: "info", priority: "medium", target: "agents", pinned: false, scheduledAt: null, expiresAt: null,
    publishedAt: Date.now() - 604800000, createdBy: "admin", dismissedBy: ["agent_001", "agent_002", "agent_003"], readBy: ["agent_001", "agent_002", "agent_003", "agent_004"],
    channels: ["inbox", "email"], metadata: {},
  },
  {
    id: "ann_005", title: "System Performance Improvement", content: "We have completed a major infrastructure upgrade. Transaction processing times have been reduced by 40% and the platform now supports 3x more concurrent users.",
    type: "info", priority: "low", target: "all", pinned: false, scheduledAt: null, expiresAt: null,
    publishedAt: Date.now() - 1209600000, createdBy: "admin", dismissedBy: ["agent_001", "agent_002"], readBy: ["agent_001", "agent_002", "agent_003", "agent_004", "agent_005"],
    channels: ["inbox"], metadata: {},
  },
];

const TYPE_ICONS: Record<string, string> = {
  info: "ℹ️", warning: "⚠️", critical: "🚨", maintenance: "🔧", feature: "✨",
};

// ─── Router ──────────────────────────────────────────────────────────────────
export const broadcastAnnouncementsRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.enum(["all", "info", "warning", "critical", "maintenance", "feature"]).optional(),
      target: z.enum(["all", "agents", "admins", "merchants"]).optional(),
      pinnedOnly: z.boolean().optional(),
      limit: z.number().min(1).max(50).optional(),
    }).optional())
    .query(({ input }) => {
      let filtered = [...announcements];
      if (input?.type && input.type !== "all") filtered = filtered.filter((a: any) => a.type === input.type);
      if (input?.target) filtered = filtered.filter((a: any) => a.target === input.target || a.target === "all");
      if (input?.pinnedOnly) filtered = filtered.filter((a: any) => a.pinned);
      // Remove expired
      filtered = filtered.filter((a: any) => !a.expiresAt || a.expiresAt > Date.now());
      filtered.sort((a: any, b: any) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.publishedAt - a.publishedAt;
      });
      const limit = input?.limit ?? 20;
      return {
        announcements: filtered.slice(0, limit),
        total: filtered.length,
        unread: filtered.filter((a: any) => !a.readBy.includes("current_user")).length,
        pinned: filtered.filter((a: any) => a.pinned).length,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const ann = announcements.find((a: any) => a.id === input.id);
      if (!ann) throw new Error("Announcement not found");
      return { announcement: ann, icon: TYPE_ICONS[ann.type] ?? "📢" };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(5000),
      type: z.enum(["info", "warning", "critical", "maintenance", "feature"]),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      target: z.enum(["all", "agents", "admins", "merchants"]),
      pinned: z.boolean().optional(),
      scheduledAt: z.number().optional(),
      expiresAt: z.number().optional(),
      channels: z.array(z.enum(["banner", "inbox", "push", "email", "sms"])).min(1),
      metadata: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(({ input }) => {
      const id = `ann_${String(announcements.length + 1).padStart(3, "0")}`;
      const ann: Announcement = {
        id,
        title: input.title,
        content: input.content,
        type: input.type,
        priority: input.priority,
        target: input.target,
        pinned: input.pinned ?? false,
        scheduledAt: input.scheduledAt ?? null,
        expiresAt: input.expiresAt ?? null,
        publishedAt: input.scheduledAt ?? Date.now(),
        createdBy: "admin",
        dismissedBy: [],
        readBy: [],
        channels: input.channels,
        metadata: input.metadata ?? {},
      };
      announcements.unshift(ann);
      return { success: true, announcement: ann };
    }),

  dismiss: protectedProcedure
    .input(z.object({ id: z.string(), userId: z.string().optional() }))
    .mutation(({ input }) => {
      const ann = announcements.find((a: any) => a.id === input.id);
      if (!ann) throw new Error("Announcement not found");
      const userId = input.userId ?? "current_user";
      if (!ann.dismissedBy.includes(userId)) ann.dismissedBy.push(userId);
      return { success: true } as any;
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string(), userId: z.string().optional() }))
    .mutation(({ input }) => {
      const ann = announcements.find((a: any) => a.id === input.id);
      if (!ann) throw new Error("Announcement not found");
      const userId = input.userId ?? "current_user";
      if (!ann.readBy.includes(userId)) ann.readBy.push(userId);
      return { success: true } as any;
    }),

  togglePin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const ann = announcements.find((a: any) => a.id === input.id);
      if (!ann) throw new Error("Announcement not found");
      ann.pinned = !ann.pinned;
      return { success: true, pinned: ann.pinned };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const idx = announcements.findIndex((a) => a.id === input.id);
      if (idx === -1) throw new Error("Announcement not found");
      announcements.splice(idx, 1);
      return { success: true } as any;
    }),

  stats: protectedProcedure.query(() => {
    const active = announcements.filter((a: any) => !a.expiresAt || a.expiresAt > Date.now());
    return {
      total: announcements.length,
      active: active.length,
      pinned: active.filter((a: any) => a.pinned).length,
      byType: {
        info: active.filter((a: any) => a.type === "info").length,
        warning: active.filter((a: any) => a.type === "warning").length,
        critical: active.filter((a: any) => a.type === "critical").length,
        maintenance: active.filter((a: any) => a.type === "maintenance").length,
        feature: active.filter((a: any) => a.type === "feature").length,
      },
    };
  }),
});
