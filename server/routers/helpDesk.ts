import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { chatSessions, chatMessages, auditLog } from "../../drizzle/schema";

export const helpDeskRouter = router({
  listTickets: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.enum(["open", "assigned", "resolved", "escalated"]).optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(chatSessions).where(eq(chatSessions.status, input.status)).orderBy(desc(chatSessions.createdAt)).limit(input?.limit ?? 50) : await db.select().from(chatSessions).orderBy(desc(chatSessions.createdAt)).limit(input?.limit ?? 50);
    return { tickets: rows, total: rows.length };
  }),
  getTicket: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [ticket] = await db.select().from(chatSessions).where(eq(chatSessions.id, input.id)).limit(1);
    if (!ticket) return null;
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.sessionId, input.id)).orderBy(chatMessages.createdAt);
    return { ...ticket, messages };
  }),
  createTicket: protectedProcedure.input(z.object({ subject: z.string(), description: z.string(), priority: z.enum(["low", "medium", "high", "critical"]).default("medium"), agentId: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [ticket] = await db.insert(chatSessions).values({ status: "open", subject: input.subject, agentId: input.agentId }).returning();
    await db.insert(chatMessages).values({ sessionId: ticket.id, content: input.description, senderType: "agent" });
    await db.insert(auditLog).values({ action: "helpdesk_ticket_created", resource: "chat_sessions", resourceId: String(ticket.id), status: "success", metadata: { subject: input.subject, priority: input.priority } });
    return ticket;
  }),
  resolveTicket: protectedProcedure.input(z.object({ id: z.number(), resolution: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.update(chatSessions).set({ status: "resolved" }).where(eq(chatSessions.id, input.id));
    await db.insert(auditLog).values({ action: "helpdesk_ticket_resolved", resource: "chat_sessions", resourceId: String(input.id), status: "success", metadata: { resolution: input.resolution } });
    return { success: true };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(chatSessions);
    const [open] = await db.select({ value: count() }).from(chatSessions).where(eq(chatSessions.status, "open"));
    const [resolved] = await db.select({ value: count() }).from(chatSessions).where(eq(chatSessions.status, "resolved"));
    return { totalTickets: Number(total.value), openTickets: Number(open.value), resolvedTickets: Number(resolved.value) };
  }),
});
