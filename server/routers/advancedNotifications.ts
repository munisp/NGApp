import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { notification_logs, auditLog } from "../../drizzle/schema";

export const advancedNotificationsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalNotifications: 0, unread: 0, channels: 0 };
    const [total] = await db.select({ value: count() }).from(notification_logs);
    const [unread] = await db.select({ value: count() }).from(notification_logs).where(eq(notification_logs.status, "pending"));
    return { totalNotifications: Number(total.value), unread: Number(unread.value), channels: 4 };
  }),
  list: protectedProcedure.input(z.object({ recipientId: z.string().optional(), status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { notifications: [], total: 0 };
    const conditions: any[] = [];
    if (input?.recipientId) conditions.push(eq(notification_logs.recipientId, input.recipientId));
    if (input?.status) conditions.push(eq(notification_logs.status, input.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(notification_logs).where(where).orderBy(desc(notification_logs.createdAt)).limit(input?.limit ?? 20);
    return { notifications: rows, total: rows.length };
  }),
  send: protectedProcedure.input(z.object({ recipientId: z.string(), recipientType: z.string().default("user"), subject: z.string(), body: z.string(), channel: z.string().default("in_app") })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [notif] = await db.insert(notification_logs).values({ recipientId: input.recipientId, recipientType: input.recipientType, subject: input.subject, body: input.body, status: "sent", sentAt: new Date() }).returning();
    return { success: true, notification: notif };
  }),
  markRead: protectedProcedure.input(z.object({ notificationId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [updated] = await db.update(notification_logs).set({ status: "read" }).where(eq(notification_logs.id, input.notificationId)).returning();
    return { success: true, notification: updated };
  }),
});
