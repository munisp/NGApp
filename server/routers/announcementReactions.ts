import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { notification_logs } from "../../drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

export const announcementReactionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, limit: input.limit, offset: input.offset };
      const rows = await db.select().from(notification_logs).orderBy(desc(notification_logs.id)).limit(input.limit).offset(input.offset);
      const totalArr = await db.select({ total: count() }).from(notification_logs); const total = totalArr?.[0]?.total ?? 0;
      return { items: rows, total, limit: input.limit, offset: input.offset };
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [record] = await db.select().from(notification_logs).where(eq(notification_logs.id, input.id)).limit(1);
      return record ?? null;
    }),
  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReactions: 0, lastUpdated: new Date().toISOString() };
    const totalArr = await db.select({ total: count() }).from(notification_logs); const total = totalArr?.[0]?.total ?? 0;
    return { totalReactions: total, lastUpdated: new Date().toISOString() };
  }),
});
