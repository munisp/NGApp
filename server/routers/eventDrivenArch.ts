import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { dlqMessages, auditLog, systemConfig } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const eventDrivenArchRouter = router({
  listTopics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const rows = await db.select({ resource: auditLog.resource, cnt: count() }).from(auditLog).groupBy(auditLog.resource).orderBy(desc(count())).limit(30);
    return { topics: rows.map(r => ({ name: r.resource, messageCount: Number(r.cnt) })) };
  }),
  getDlqMessages: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(dlqMessages).orderBy(desc(dlqMessages.createdAt)).limit(input?.limit ?? 50);
      return { messages: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  retryDlqMessage: protectedProcedure.input(z.object({ messageId: z.number() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      await db.update(dlqMessages).set({ status: "retrying" }).where(eq(dlqMessages.id, input.messageId));
      await db.insert(auditLog).values({ action: "dlq_message_retried", resource: "dlq_messages", resourceId: String(input.messageId), status: "success", metadata: {} });
      return { success: true, messageId: input.messageId };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getConfig: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [config] = await db.select().from(systemConfig).where(eq(systemConfig.key, "event_driven_config")).limit(1);
    return config ? JSON.parse(String(config.value)) : { broker: "kafka", dlqEnabled: true, retryPolicy: { maxRetries: 3, backoffMs: 1000 } };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalDlq] = await db.select({ value: count() }).from(dlqMessages).limit(100);
    const [totalEvents] = await db.select({ value: count() }).from(auditLog).limit(100);
    return { totalEvents: Number(totalEvents.value), dlqMessages: Number(totalDlq.value) };
  }),
});
