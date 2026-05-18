import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { notification_logs as notificationLogs, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const guideFeedbackRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(notificationLogs).orderBy(desc(notificationLogs.createdAt)).limit(input?.limit ?? 50);
      return { feedback: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  submit: protectedProcedure.input(z.object({ guideId: z.string().min(1), rating: z.number().int().min(1).max(5), comment: z.string().optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      await db.insert(auditLog).values({ action: "guide_feedback_submitted", resource: "guide_feedback", resourceId: input.guideId, status: "success", metadata: { rating: input.rating, comment: input.comment } });
      return { guideId: input.guideId, rating: input.rating, status: "submitted" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(notificationLogs).limit(100);
    return { totalFeedback: Number(total.value) };
  }),
});
