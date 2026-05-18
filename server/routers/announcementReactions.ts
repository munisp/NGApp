import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { notification_logs as notificationLogs, auditLog } from "../../drizzle/schema";

export const announcementReactionsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(notificationLogs).orderBy(desc(notificationLogs.createdAt)).limit(input?.limit ?? 50);
    return { announcements: rows, total: rows.length };
  }),
  react: protectedProcedure.input(z.object({ announcementId: z.number(), reaction: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "announcement_reaction", resource: "notification_logs", resourceId: String(input.announcementId), status: "success", metadata: { reaction: input.reaction } });
    return { announcementId: input.announcementId, reaction: input.reaction, status: "recorded" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(notificationLogs);
    return { totalAnnouncements: Number(total.value) };
  }),
});
