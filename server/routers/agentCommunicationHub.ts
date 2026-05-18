import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents, notifications, auditLog } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";

export const agentCommunicationHubRouter = router({
  getChannels: protectedProcedure.query(async () => {
    return { channels: [
      { id: "sms", name: "SMS", enabled: true, cost: 0.02 },
      { id: "ussd", name: "USSD Push", enabled: true, cost: 0.01 },
      { id: "whatsapp", name: "WhatsApp", enabled: true, cost: 0.005 },
      { id: "push", name: "Push Notification", enabled: true, cost: 0 },
      { id: "email", name: "Email", enabled: true, cost: 0.001 }
    ]};
  }),
  sendMessage: protectedProcedure
    .input(z.object({ agentId: z.number(), channel: z.string(), message: z.string(), priority: z.enum(["low", "normal", "high", "critical"]).default("normal") }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const messageId = crypto.randomUUID();
      const [notif] = await db.insert(notifications).values({ title: `[${input.channel.toUpperCase()}] Agent Message`, message: input.message, type: input.priority === "critical" ? "error" : "info", read: false }).returning();
      await db.insert(auditLog).values({ action: "agent_message_sent", resource: "notifications", resourceId: String(notif.id), status: "success", metadata: { agentId: input.agentId, channel: input.channel, priority: input.priority } });
      return { sent: true, messageId, notificationId: notif.id, channel: input.channel, timestamp: new Date().toISOString() };
    }),
  getMessageHistory: protectedProcedure
    .input(z.object({ agentId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(auditLog).where(sql`${auditLog.action} = 'agent_message_sent' AND (${auditLog.metadata}->>'agentId')::int = ${input.agentId}`).orderBy(desc(auditLog.createdAt)).limit(input.limit);
      return { messages: rows.map(r => ({ id: r.resourceId, channel: (r.metadata as Record<string, unknown>)?.channel, timestamp: r.createdAt, status: r.status })), total: rows.length, agentId: input.agentId };
    }),
  broadcastAlert: protectedProcedure
    .input(z.object({ message: z.string(), channels: z.array(z.string()), targetGroup: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const broadcastId = crypto.randomUUID();
      const [agentCount] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true));
      await db.insert(notifications).values({ title: "Broadcast Alert", message: input.message, type: "warning", read: false });
      await db.insert(auditLog).values({ action: "broadcast_alert_sent", resource: "notifications", resourceId: broadcastId, status: "success", metadata: { channels: input.channels, targetGroup: input.targetGroup, recipientCount: Number(agentCount.value) } });
      return { broadcastId, recipientCount: Number(agentCount.value), channels: input.channels, status: "sent" };
    }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalMessages] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "agent_message_sent"));
    const [totalBroadcasts] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "broadcast_alert_sent"));
    return { totalMessages: Number(totalMessages.value), totalBroadcasts: Number(totalBroadcasts.value), lastUpdated: new Date().toISOString() };
  }),
});
