import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { analyticsMetrics, auditLog } from "../../drizzle/schema";

export const nlAnalyticsQueryRouter = router({
  query: protectedProcedure.input(z.object({ question: z.string().min(3).max(500) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(analyticsMetrics).orderBy(desc(analyticsMetrics.createdAt)).limit(20);
    return { answer: `Found ${rows.length} metrics records`, data: rows, query: input.question };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(analyticsMetrics);
    return { totalMetrics: Number(total.value) };
  }),
});
