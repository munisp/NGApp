import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { notifications, auditLog } from "../../drizzle/schema";

export const realtimeNotificationsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().default(50), read: z.boolean().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.read !== undefined ? await db.select().from(notifications).where(eq(notifications.read, input.read)).orderBy(desc(notifications.createdAt)).limit(input?.limit ?? 50) : await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(input?.limit ?? 50);
    return { notifications: rows, total: rows.length };
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, input.id));
    return { success: true };
  }),
  markAllRead: protectedProcedure.mutation(async () => {
    const db = (await getDb())!;
    await db.update(notifications).set({ read: true }).where(eq(notifications.read, false));
    return { success: true };
  }),
  send: protectedProcedure.input(z.object({ title: z.string(), message: z.string(), type: z.enum(["info", "warning", "error", "success"]).default("info"), userId: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [notif] = await db.insert(notifications).values({ title: input.title, message: input.message, type: input.type, read: false }).returning();
    return notif;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(notifications);
    const [unread] = await db.select({ value: count() }).from(notifications).where(eq(notifications.read, false));
    return { totalNotifications: Number(total.value), unreadCount: Number(unread.value) };
  }),
});
