import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const smsNotificationsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSent: 0, delivered: 0, failed: 0, deliveryRate: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "sms_sent")).orderBy(desc(auditLog.createdAt)).limit(500);
    const delivered = rows.filter(r => r.status === "success").length;
    return { totalSent: rows.length, delivered, failed: rows.filter(r => r.status === "failure").length, deliveryRate: rows.length > 0 ? Math.round(delivered / rows.length * 100) : 0 };
  }),
  send: protectedProcedure.input(z.object({ to: z.string(), message: z.string(), template: z.string().optional(), priority: z.enum(["low", "normal", "high"]).default("normal") })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const msgId = "SMS-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "sms_sent", resource: "sms", resourceId: msgId, status: "success", metadata: { to: input.to, template: input.template, priority: input.priority } });
    return { success: true, messageId: msgId };
  }),
  sendBulk: protectedProcedure.input(z.object({ recipients: z.array(z.string()), message: z.string(), template: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const batchId = "SMSBATCH-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "sms_bulk_sent", resource: "sms", resourceId: batchId, status: "success", metadata: { recipientCount: input.recipients.length, template: input.template } });
    return { success: true, batchId, recipientCount: input.recipients.length };
  }),
  listHistory: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { messages: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "sms_sent")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { messages: rows.map(r => ({ id: r.id, messageId: r.resourceId, ...r.metadata as any, status: r.status, sentAt: r.createdAt })), total: rows.length };
  }),
});
