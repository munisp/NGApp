import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, sum } from "drizzle-orm";
import { chatMessages, chatSessions, notification_logs, auditLog } from "../../drizzle/schema";

export const whatsappChannelRouter = router({
  listConversations: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.enum(["open", "closed", "pending"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(chatSessions).orderBy(desc(chatSessions.createdAt)).limit(input?.limit ?? 50);
    return { conversations: rows, total: rows.length };
  }),
  sendMessage: protectedProcedure.input(z.object({ phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/), message: z.string().min(1).max(4096), templateId: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [session] = await db.insert(chatSessions).values({ channelId: "whatsapp", status: "active" }).returning();
    const [msg] = await db.insert(chatMessages).values({ sessionId: session.id, senderType: "system", content: input.message }).returning();
    await db.insert(notification_logs).values({ channel: "whatsapp", recipient: input.phoneNumber, subject: "WhatsApp Message", body: input.message, status: "pending" });
    await db.insert(auditLog).values({ action: "whatsapp_message_sent", resource: "whatsapp_channel", resourceId: String(msg.id), status: "success", metadata: { phoneNumber: input.phoneNumber, sessionId: session.id, templateId: input.templateId } });
    return { messageId: msg.id, sessionId: session.id, status: "sent", sentAt: new Date().toISOString() };
  }),
  getTemplates: protectedProcedure.query(async () => {
    return { templates: [
      { id: "welcome", name: "Welcome Message", category: "marketing" },
      { id: "txn_receipt", name: "Transaction Receipt", category: "transactional" },
      { id: "otp", name: "OTP Verification", category: "authentication" },
      { id: "balance", name: "Balance Update", category: "transactional" }
    ] };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [sessions] = await db.select({ value: count() }).from(chatSessions);
    const [messages] = await db.select({ value: count() }).from(chatMessages);
    return { totalSessions: Number(sessions.value), totalMessages: Number(messages.value) };
  }),
});
