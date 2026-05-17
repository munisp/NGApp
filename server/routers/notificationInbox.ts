// @ts-nocheck
/**
 * Sprint 9: Unified Notification Inbox tRPC Router
 *
 * Aggregates all notification channels (email, SMS, push, in-app) into a
 * single timeline view. Supports mark-as-read, filtering, search, and
 * real-time notification counts.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = "email" | "sms" | "push" | "in_app";
export type NotificationCategory = "rate_alert" | "fraud" | "transaction" | "security" | "system" | "settlement" | "kyc" | "compliance" | "general";
export type NotificationPriority = "critical" | "high" | "medium" | "low";

export interface InboxNotification {
  id: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  read: boolean;
  starred: boolean;
  archived: boolean;
  agentId?: number;
  agentName?: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  createdAt: Date;
  readAt?: Date;
}

// ── In-Memory Store ─────────────────────────────────────────────────────────

const notificationStore = new Map<string, InboxNotification>();
let notifIdCounter = 1;
const MAX_NOTIFICATIONS = 50_000;

function generateId(): string {
  return `notif_${Date.now()}_${(notifIdCounter++).toString().padStart(6, "0")}`;
}

// Seed some demo notifications
function seedNotifications(): void {
  if (notificationStore.size > 0) return;

  const now = Date.now();
  const demoNotifs: Omit<InboxNotification, "id">[] = [
    {
      channel: "email",
      category: "rate_alert",
      priority: "high",
      title: "USD/NGN Rate Alert Triggered",
      body: "USD/NGN has risen above your target of 1600.00. Current rate: 1605.50.",
      read: false,
      starred: false,
      archived: false,
      agentId: 1,
      agentName: "Adebayo Okafor",
      actionUrl: "/rate-alerts",
      createdAt: new Date(now - 300_000),
    },
    {
      channel: "sms",
      category: "fraud",
      priority: "critical",
      title: "Fraud Alert: Suspicious Transaction",
      body: "High-value transaction of NGN 5,000,000 flagged for velocity anomaly. Agent: AGT001.",
      read: false,
      starred: true,
      archived: false,
      agentId: 1,
      agentName: "Adebayo Okafor",
      actionUrl: "/admin/fraud",
      createdAt: new Date(now - 600_000),
    },
    {
      channel: "push",
      category: "transaction",
      priority: "medium",
      title: "Cash-In Completed",
      body: "Cash-in of NGN 50,000 processed successfully. Ref: TXN-2026-0416-001.",
      read: true,
      starred: false,
      archived: false,
      agentId: 1,
      agentName: "Adebayo Okafor",
      createdAt: new Date(now - 1_800_000),
      readAt: new Date(now - 1_200_000),
    },
    {
      channel: "in_app",
      category: "system",
      priority: "low",
      title: "System Maintenance Scheduled",
      body: "Planned maintenance window: April 17, 2026 02:00-04:00 WAT. Services may be briefly unavailable.",
      read: false,
      starred: false,
      archived: false,
      createdAt: new Date(now - 3_600_000),
    },
    {
      channel: "email",
      category: "settlement",
      priority: "medium",
      title: "Daily Settlement Report",
      body: "Your daily settlement has been processed. 47 transactions, NGN 2,350,000 volume, NGN 11,750 commission.",
      read: true,
      starred: false,
      archived: false,
      agentId: 1,
      agentName: "Adebayo Okafor",
      createdAt: new Date(now - 7_200_000),
      readAt: new Date(now - 5_400_000),
    },
    {
      channel: "sms",
      category: "security",
      priority: "high",
      title: "New Login Detected",
      body: "New login to your account from Lagos, Nigeria. If this wasn't you, change your PIN immediately.",
      read: false,
      starred: false,
      archived: false,
      agentId: 2,
      agentName: "Fatima Ibrahim",
      createdAt: new Date(now - 10_800_000),
    },
    {
      channel: "in_app",
      category: "kyc",
      priority: "medium",
      title: "KYC Document Approved",
      body: "Your National ID verification has been approved. Your account is now fully verified.",
      read: true,
      starred: false,
      archived: false,
      agentId: 3,
      agentName: "Chinedu Eze",
      createdAt: new Date(now - 14_400_000),
      readAt: new Date(now - 12_600_000),
    },
    {
      channel: "push",
      category: "compliance",
      priority: "high",
      title: "Compliance Policy Update",
      body: "New AML compliance policy requires additional verification for transactions above NGN 1,000,000.",
      read: false,
      starred: true,
      archived: false,
      createdAt: new Date(now - 18_000_000),
    },
    {
      channel: "email",
      category: "rate_alert",
      priority: "medium",
      title: "EUR/KES Rate Alert",
      body: "EUR/KES has fallen below your target of 145.00. Current rate: 143.80.",
      read: false,
      starred: false,
      archived: false,
      agentId: 2,
      agentName: "Fatima Ibrahim",
      actionUrl: "/rate-alerts",
      createdAt: new Date(now - 21_600_000),
    },
    {
      channel: "in_app",
      category: "general",
      priority: "low",
      title: "Welcome to 54Link POS",
      body: "Your agent account has been activated. Explore the platform and start processing transactions.",
      read: true,
      starred: false,
      archived: false,
      agentId: 4,
      agentName: "Grace Akinwale",
      createdAt: new Date(now - 86_400_000),
      readAt: new Date(now - 82_800_000),
    },
  ];

  for (const n of demoNotifs) {
    const id = generateId();
    notificationStore.set(id, { ...n, id });
  }
}

seedNotifications();

// ── Public API: Create Notification ─────────────────────────────────────────

/**
 * Programmatic notification creation (called by other services).
 */
export function createNotification(
  opts: Omit<InboxNotification, "id" | "read" | "starred" | "archived" | "createdAt">
): InboxNotification {
  const id = generateId();
  const notif: InboxNotification = {
    ...opts,
    id,
    read: false,
    starred: false,
    archived: false,
    createdAt: new Date(),
  };
  notificationStore.set(id, notif);

  // Trim if too large
  if (notificationStore.size > MAX_NOTIFICATIONS) {
    const entries = Array.from(notificationStore.entries())
      .sort((a: any, b: any) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    const toRemove = entries.slice(0, notificationStore.size - MAX_NOTIFICATIONS);
    for (const [key] of toRemove) {
      notificationStore.delete(key);
    }
  }

  return notif;
}

// ── tRPC Router ─────────────────────────────────────────────────────────────

export const notificationInboxRouter = router({
  // List notifications with filters
  list: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["email", "sms", "push", "in_app", "all"]).default("all"),
        category: z.enum(["rate_alert", "fraud", "transaction", "security", "system", "settlement", "kyc", "compliance", "general", "all"]).default("all"),
        priority: z.enum(["critical", "high", "medium", "low", "all"]).default("all"),
        readStatus: z.enum(["read", "unread", "all"]).default("all"),
        starred: z.boolean().optional(),
        archived: z.boolean().default(false),
        search: z.string().optional(),
        agentId: z.number().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(100).default(25),
      })
    )
    .query(({ input }) => {
      let items: InboxNotification[] = [];

      // Filters
      if (input.channel !== "all") items = items.filter((n: InboxNotification) => n.channel === input.channel);
      if (input.category !== "all") items = items.filter((n: any) => n.category === input.category);
      if (input.priority !== "all") items = items.filter((n: any) => n.priority === input.priority);
      if (input.readStatus === "read") items = items.filter((n: any) => n.read);
      if (input.readStatus === "unread") items = items.filter((n: any) => !n.read);
      if (input.starred !== undefined) items = items.filter((n: any) => n.starred === input.starred);
      items = items.filter((n: any) => n.archived === input.archived);
      if (input.agentId) items = items.filter((n: any) => n.agentId === input.agentId);
      if (input.search) {
        const q = input.search.toLowerCase();
        items = items.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            (n.agentName && n.agentName.toLowerCase().includes(q))
        );
      }

      // Sort newest first
      items.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = items.length;
      const start = (input.page - 1) * input.pageSize;
      const paged = items.slice(start, start + input.pageSize);

      return {
        items: paged,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // Get single notification
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const notif = notificationStore.get(input.id);
      if (!notif) throw new Error("Notification not found");
      return notif;
    }),

  // Mark as read
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const notif = notificationStore.get(input.id);
      if (!notif) throw new Error("Notification not found");
      notif.read = true;
      notif.readAt = new Date();
      return notif;
    }),

  // Mark all as read
  markAllRead: protectedProcedure
    .input(z.object({ agentId: z.number().optional() }))
    .mutation(({ input }) => {
      let count = 0;
      for (const [, notif] of notificationStore) {
        if (!notif.read && (!input.agentId || notif.agentId === input.agentId)) {
          notif.read = true;
          notif.readAt = new Date();
          count++;
        }
      }
      return { marked: count };
    }),

  // Toggle star
  toggleStar: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const notif = notificationStore.get(input.id);
      if (!notif) throw new Error("Notification not found");
      notif.starred = !notif.starred;
      return notif;
    }),

  // Archive notification
  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const notif = notificationStore.get(input.id);
      if (!notif) throw new Error("Notification not found");
      notif.archived = true;
      return notif;
    }),

  // Delete notification
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const existed = notificationStore.delete(input.id);
      return { deleted: existed };
    }),

  // Bulk delete
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(({ input }) => {
      let deleted = 0;
      for (const id of input.ids) {
        if (notificationStore.delete(id)) deleted++;
      }
      return { deleted };
    }),

  // Get unread counts (for badges)
  getUnreadCounts: protectedProcedure
    .input(z.object({ agentId: z.number().optional() }))
    .query(({ input }) => {
      let items: InboxNotification[] = Array.from(notificationStore.values()).filter((n: any) => !n.read);
      if (input.agentId) items = items.filter((n: InboxNotification) => !n.agentId || n.agentId === input.agentId);

      const byChannel: Record<string, number> = { email: 0, sms: 0, push: 0, in_app: 0 };
      const byCategory: Record<string, number> = {};
      const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

      for (const n of items) {
        byChannel[n.channel] = (byChannel[n.channel] ?? 0) + 1;
        byCategory[n.category] = (byCategory[n.category] ?? 0) + 1;
        byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1;
      }

      return {
        total: items.length,
        byChannel,
        byCategory,
        byPriority,
      };
    }),

  // Get notification stats
  getStats: protectedProcedure.query(() => {
    const now = Date.now();
    const last24h = all.filter((n: any) => now - n.createdAt.getTime() < 86_400_000);
    const last7d = all.filter((n: any) => now - n.createdAt.getTime() < 7 * 86_400_000);

    return {
      total: all.length,
      unread: all.filter((n: any) => !n.read).length,
      starred: all.filter((n: any) => n.starred).length,
      archived: all.filter((n: any) => n.archived).length,
      last24h: last24h.length,
      last7d: last7d.length,
      byChannel: {
        email: all.filter((n: any) => n.channel === "email").length,
        sms: all.filter((n: any) => n.channel === "sms").length,
        push: all.filter((n: any) => n.channel === "push").length,
        in_app: all.filter((n: any) => n.channel === "in_app").length,
      },
    };
  }),

  // Create notification (for testing / manual trigger)
  create: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["email", "sms", "push", "in_app"]),
        category: z.enum(["rate_alert", "fraud", "transaction", "security", "system", "settlement", "kyc", "compliance", "general"]),
        priority: z.enum(["critical", "high", "medium", "low"]),
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(2000),
        agentId: z.number().optional(),
        agentName: z.string().optional(),
        actionUrl: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      return createNotification(input);
    }),
});
