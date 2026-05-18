import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { notification_logs, auditLog } from "../../drizzle/schema";

export const realtimeNotificationsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(50), read: z.boolean().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.read !== undefined ? await db.select().from(notification_logs).where(eq(notification_logs.status, input.read ? "read" : "pending")).orderBy(desc(notification_logs.createdAt)).limit(input?.limit ?? 50) : await db.select().from(notification_logs).orderBy(desc(notification_logs.createdAt)).limit(input?.limit ?? 50);
    return { notifications: rows, total: rows.length };
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(notification_logs).set({ status: "read" }).where(eq(notification_logs.id, input.id));
    return { success: true };
  }),
  markAllRead: protectedProcedure.mutation(async () => {
    const db = (await getDb())!;
    await db.update(notification_logs).set({ status: "read" }).where(eq(notification_logs.status, "pending"));
    return { success: true };
  }),
  send: protectedProcedure.input(z.object({ title: z.string(), message: z.string(), type: z.enum(["info", "warning", "error", "success"]).default("info"), userId: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [notif] = await db.insert(notification_logs).values({ recipientId: input.userId ? String(input.userId) : "system", recipientType: input.userId ? "user" : "system", subject: input.title, body: input.message, status: "pending" }).returning();
    return notif;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(notification_logs);
    const [unread] = await db.select({ value: count() }).from(notification_logs).where(eq(notification_logs.status, "pending"));
    return { totalNotifications: Number(total.value), unread: Number(unread.value), channels: 5 };
  }),
});
