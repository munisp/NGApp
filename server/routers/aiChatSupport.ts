import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { chatSessions, chatMessages, auditLog } from "../../drizzle/schema";

export const aiChatSupportRouter = router({
  listSessions: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.enum(["open", "assigned", "resolved", "escalated"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = input?.status ? [eq(chatSessions.status, input.status)] : [];
    const rows = conditions.length > 0 ? await db.select().from(chatSessions).where(conditions[0]).orderBy(desc(chatSessions.createdAt)).limit(input?.limit ?? 50) : await db.select().from(chatSessions).orderBy(desc(chatSessions.createdAt)).limit(input?.limit ?? 50);
    return { sessions: rows, total: rows.length };
  }),
  getSession: protectedProcedure.input(z.object({ sessionId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, input.sessionId)).limit(1);
    if (!session) return null;
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.sessionId, input.sessionId)).orderBy(chatMessages.createdAt);
    return { ...session, messages };
  }),
  sendMessage: protectedProcedure.input(z.object({ sessionId: z.number(), content: z.string(), senderType: z.enum(["agent", "support", "system"]).default("support") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [msg] = await db.insert(chatMessages).values({ sessionId: input.sessionId, content: input.content, senderType: input.senderType }).returning();
    await db.insert(auditLog).values({ action: "chat_message_sent", resource: "chat_messages", resourceId: String(msg.id), status: "success", metadata: { sessionId: input.sessionId } });
    return msg;
  }),
  resolveSession: protectedProcedure.input(z.object({ sessionId: z.number(), resolution: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(chatSessions).set({ status: "resolved" }).where(eq(chatSessions.id, input.sessionId));
    await db.insert(auditLog).values({ action: "chat_session_resolved", resource: "chat_sessions", resourceId: String(input.sessionId), status: "success", metadata: { resolution: input.resolution } });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(chatSessions);
    const [open] = await db.select({ value: count() }).from(chatSessions).where(eq(chatSessions.status, "open"));
    const [resolved] = await db.select({ value: count() }).from(chatSessions).where(eq(chatSessions.status, "resolved"));
    return { totalSessions: Number(total.value), openSessions: Number(open.value), resolvedSessions: Number(resolved.value), resolutionRate: Number(total.value) > 0 ? Math.round(Number(resolved.value) / Number(total.value) * 100) : 0 };
  }),
});
