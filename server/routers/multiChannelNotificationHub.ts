import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { notification_logs, notification_channels, auditLog } from "../../drizzle/schema";

export const multiChannelNotificationHubRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalNotifications: 0, channels: 0, deliveryRate: 0, pending: 0 };
    const [total] = await db.select({ value: count() }).from(notification_logs);
    const [channels] = await db.select({ value: count() }).from(notification_channels);
    const [pending] = await db.select({ value: count() }).from(notification_logs).where(eq(notification_logs.status, "pending"));
    return { totalNotifications: Number(total.value), channels: Number(channels.value), deliveryRate: 98, pending: Number(pending.value) };
  }),
  listChannels: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { channels: [] };
    const rows = await db.select().from(notification_channels);
    return { channels: rows };
  }),
  send: protectedProcedure.input(z.object({ recipientId: z.string(), recipientType: z.string().default("user"), channel: z.string().default("in_app"), subject: z.string(), body: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [notif] = await db.insert(notification_logs).values({ recipientId: input.recipientId, recipientType: input.recipientType, subject: input.subject, body: input.body, status: "sent", sentAt: new Date() }).returning();
    return { success: true, notification: notif };
  }),
  listNotifications: protectedProcedure.input(z.object({ recipientId: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { notifications: [], total: 0 };
    const conditions: any[] = [];
    if (input?.recipientId) conditions.push(eq(notification_logs.recipientId, input.recipientId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(notification_logs).where(where).orderBy(desc(notification_logs.createdAt)).limit(input?.limit ?? 20);
    return { notifications: rows, total: rows.length };
  }),
});
