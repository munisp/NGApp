import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const guideFeedbackRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalFeedback: 0, avgRating: 0, helpfulCount: 0, notHelpfulCount: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "guide_feedback")).orderBy(desc(auditLog.createdAt)).limit(500);
    const helpful = rows.filter(r => (r.metadata as any)?.helpful === true).length;
    const ratings = rows.map(r => (r.metadata as any)?.rating).filter((r: any) => typeof r === "number");
    const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length * 10) / 10 : 0;
    return { totalFeedback: rows.length, avgRating, helpfulCount: helpful, notHelpfulCount: rows.length - helpful };
  }),
  listFeedback: protectedProcedure.input(z.object({ guideId: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { feedback: [], total: 0 };
    const conditions: any[] = [eq(auditLog.action, "guide_feedback")];
    if (input?.guideId) conditions.push(eq(auditLog.resourceId, input.guideId));
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { feedback: rows.map(r => ({ id: r.id, guideId: r.resourceId, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  submitFeedback: protectedProcedure.input(z.object({ guideId: z.string(), rating: z.number().min(1).max(5), helpful: z.boolean(), comment: z.string().optional(), userId: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "guide_feedback", resource: "guides", resourceId: input.guideId, status: "success", metadata: { rating: input.rating, helpful: input.helpful, comment: input.comment, userId: input.userId } });
    return { success: true };
  }),
});
