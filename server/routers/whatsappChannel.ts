import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const whatsappChannelRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalMessages: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "whatsapp")).orderBy(desc(auditLog.createdAt)).limit(500);
    const sent = rows.filter(r => r.action === "whatsapp_sent").length;
    const delivered = rows.filter(r => r.status === "success").length;
    return { totalMessages: rows.length, sent, delivered, read: 0, failed: rows.filter(r => r.status === "failure").length };
  }),
  listMessages: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { messages: [], total: 0 };
    const conditions: any[] = [eq(auditLog.resource, "whatsapp")];
    if (input?.status) conditions.push(sql`${auditLog.status} = ${input.status}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { messages: rows.map(r => ({ id: r.id, ...r.metadata as any, status: r.status, sentAt: r.createdAt })), total: rows.length };
  }),
  sendMessage: protectedProcedure.input(z.object({ to: z.string(), message: z.string(), template: z.string().optional(), mediaUrl: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const messageId = "WA-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "whatsapp_sent", resource: "whatsapp", resourceId: messageId, status: "success", metadata: { to: input.to, template: input.template, hasMedia: !!input.mediaUrl } });
    return { success: true, messageId };
  }),
  getTemplates: protectedProcedure.query(async () => {
    return { templates: [
      { id: "transaction_alert", name: "Transaction Alert", language: "en", status: "approved" },
      { id: "otp_verification", name: "OTP Verification", language: "en", status: "approved" },
      { id: "commission_payout", name: "Commission Payout", language: "en", status: "approved" },
      { id: "account_activation", name: "Account Activation", language: "en", status: "approved" },
      { id: "float_low", name: "Float Balance Low", language: "en", status: "approved" },
    ] };
  }),
  getChannelConfig: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { configured: false };
    const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "whatsapp_config")).limit(1);
    if (rows.length > 0 && rows[0].value) return { configured: true, ...JSON.parse(String(rows[0].value)) };
    return { configured: false };
  }),
});
