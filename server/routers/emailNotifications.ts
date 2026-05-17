import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { notification_logs, auditLog } from "../../drizzle/schema";

export const emailNotificationsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSent: 0, delivered: 0, failed: 0, deliveryRate: 0 };
    const rows = await db.select().from(notification_logs).where(eq(notification_logs.recipientType, "email")).orderBy(desc(notification_logs.createdAt)).limit(500);
    const delivered = rows.filter(r => r.status === "delivered" || r.status === "sent").length;
    const failed = rows.filter(r => r.status === "failed").length;
    return { totalSent: rows.length, delivered, failed, deliveryRate: rows.length > 0 ? Math.round(delivered / rows.length * 100) : 0 };
  }),
  send: protectedProcedure.input(z.object({ to: z.string(), subject: z.string(), body: z.string(), template: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [email] = await db.insert(notification_logs).values({ recipientId: input.to, recipientType: "email", subject: input.subject, body: input.body, status: "sent", sentAt: new Date() }).returning();
    await db.insert(auditLog).values({ action: "email_sent", resource: "emails", resourceId: String(email.id), status: "success", metadata: { to: input.to, subject: input.subject } });
    return { success: true, email };
  }),
  listHistory: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { emails: [], total: 0 };
    const rows = await db.select().from(notification_logs).where(eq(notification_logs.recipientType, "email")).orderBy(desc(notification_logs.createdAt)).limit(input?.limit ?? 20);
    return { emails: rows, total: rows.length };
  }),
});
