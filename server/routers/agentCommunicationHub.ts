import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { chatSessions, chatMessages, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentCommunicationHubRouter = router({
  listSessions: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(chatSessions.status, input.status as any));
      const rows = await db.select().from(chatSessions).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(chatSessions.createdAt)).limit(input?.limit ?? 50);
      return { sessions: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  sendMessage: protectedProcedure.input(z.object({ sessionId: z.number(), content: z.string().min(1).max(2000), senderType: z.enum(["agent", "support", "system"]).default("agent") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [msg] = await db.insert(chatMessages).values({ sessionId: input.sessionId, content: input.content, senderType: input.senderType as any }).returning();
      await db.insert(auditLog).values({ action: "message_sent", resource: "chat_messages", resourceId: String(msg.id), status: "success", metadata: { sessionId: input.sessionId } });
      return { id: msg.id, sessionId: input.sessionId, status: "sent" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalSessions] = await db.select({ value: count() }).from(chatSessions).limit(100);
    const [totalMessages] = await db.select({ value: count() }).from(chatMessages).limit(100);
    return { totalSessions: Number(totalSessions.value), totalMessages: Number(totalMessages.value) };
  }),
});
