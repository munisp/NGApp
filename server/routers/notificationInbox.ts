import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { notification_logs, auditLog } from "../../drizzle/schema";

export const notificationInboxRouter = router({
  getStats: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { total: 0, unread: 0, archived: 0 };
    const [total] = await db.select({ value: count() }).from(notification_logs).where(eq(notification_logs.recipientId, input.userId));
    const [unread] = await db.select({ value: count() }).from(notification_logs).where(and(eq(notification_logs.recipientId, input.userId), eq(notification_logs.status, "pending")));
    return { total: Number(total.value), unread: Number(unread.value), archived: 0 };
  }),
  list: protectedProcedure.input(z.object({ userId: z.string(), status: z.string().optional(), limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { notifications: [], total: 0 };
    const conditions: any[] = [eq(notification_logs.recipientId, input.userId)];
    if (input.status) conditions.push(eq(notification_logs.status, input.status));
    const where = and(...conditions);
    const rows = await db.select().from(notification_logs).where(where).orderBy(desc(notification_logs.createdAt)).limit(input.limit).offset(input.offset);
    return { notifications: rows, total: rows.length };
  }),
  markRead: protectedProcedure.input(z.object({ notificationId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [updated] = await db.update(notification_logs).set({ status: "read" }).where(eq(notification_logs.id, input.notificationId)).returning();
    return { success: true, notification: updated };
  }),
  markAllRead: protectedProcedure.input(z.object({ userId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.update(notification_logs).set({ status: "read" }).where(and(eq(notification_logs.recipientId, input.userId), eq(notification_logs.status, "pending")));
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ notificationId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(notification_logs).where(eq(notification_logs.id, input.notificationId));
    return { success: true };
  }),
});
