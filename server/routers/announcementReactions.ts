import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const announcementReactionsRouter = router({
  getReactions: protectedProcedure.input(z.object({ announcementId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { reactions: [], total: 0 };
    const rows = await db.select().from(auditLog).where(and(eq(auditLog.resource, "announcements"), eq(auditLog.resourceId, input.announcementId), eq(auditLog.action, "reaction_added"))).orderBy(desc(auditLog.createdAt)).limit(100);
    const reactionMap: Record<string, number> = {};
    rows.forEach(r => { const emoji = (r.metadata as any)?.emoji ?? "thumbsup"; reactionMap[emoji] = (reactionMap[emoji] || 0) + 1; });
    return { reactions: Object.entries(reactionMap).map(([emoji, cnt]) => ({ emoji, count: cnt })), total: rows.length };
  }),
  addReaction: protectedProcedure.input(z.object({ announcementId: z.string(), emoji: z.string(), userId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "reaction_added", resource: "announcements", resourceId: input.announcementId, status: "success", metadata: { emoji: input.emoji, userId: input.userId } });
    return { success: true };
  }),
  removeReaction: protectedProcedure.input(z.object({ announcementId: z.string(), emoji: z.string(), userId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "reaction_removed", resource: "announcements", resourceId: input.announcementId, status: "success", metadata: { emoji: input.emoji, userId: input.userId } });
    return { success: true };
  }),
});
