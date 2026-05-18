import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { notification_logs, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const broadcastAnnouncementsRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalBroadcasts: 0, sent: 0, pending: 0, totalRecipients: 0 };
    const [total] = await db.select({ value: count() }).from(notification_logs).where(eq(notification_logs.recipientType, "broadcast")).limit(100);
    const [sent] = await db.select({ value: count() }).from(notification_logs).where(and(eq(notification_logs.recipientType, "broadcast"), eq(notification_logs.status, "sent"))).limit(100);
    return { totalBroadcasts: Number(total.value), sent: Number(sent.value), pending: Number(total.value) - Number(sent.value), totalRecipients: 0 };
  }),
  list: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { broadcasts: [], total: 0 };
      const rows = await db.select().from(notification_logs).where(eq(notification_logs.recipientType, "broadcast")).orderBy(desc(notification_logs.createdAt)).limit(input?.limit ?? 20);
      return { broadcasts: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  send: protectedProcedure.input(z.object({ subject: z.string(), body: z.string(), targetAudience: z.string().default("all") })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [broadcast] = await db.insert(notification_logs).values({ recipientId: input.targetAudience, recipientType: "broadcast", subject: input.subject, body: input.body, status: "sent", sentAt: new Date() }).returning();
      await db.insert(auditLog).values({ action: "broadcast_sent", resource: "broadcasts", resourceId: String(broadcast.id), status: "success", metadata: { subject: input.subject, targetAudience: input.targetAudience } });
      return { success: true, broadcast };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
