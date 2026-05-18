import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { notification_logs as notificationLogs, auditLog } from "../../drizzle/schema";

export const smsNotificationsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(notificationLogs);
    const [sent] = await db.select({ value: count() }).from(notificationLogs).where(eq(notificationLogs.status, "sent"));
    const [failed] = await db.select({ value: count() }).from(notificationLogs).where(eq(notificationLogs.status, "failed"));
    return { totalNotifications: Number(total.value), sentCount: Number(sent.value), failedCount: Number(failed.value) };
  }),
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(notificationLogs.status, input.status));
    const rows = await db.select().from(notificationLogs).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(notificationLogs.createdAt)).limit(input?.limit ?? 50);
    return { notifications: rows, total: rows.length };
  }),
  send: protectedProcedure.input(z.object({ recipientId: z.string(), body: z.string().min(1).max(1000), subject: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [notif] = await db.insert(notificationLogs).values({ recipientId: input.recipientId, recipientType: "agent", body: input.body, subject: input.subject ?? "SMS Notification", status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "sms_sent", resource: "notification_logs", resourceId: String(notif.id), status: "success", metadata: { recipientId: input.recipientId } });
    return { id: notif.id, status: "pending" };
  }),
});
