import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { analyticsMetrics, auditLog } from "../../drizzle/schema";

export const qdrantVectorSearchRouter = router({
  search: protectedProcedure.input(z.object({ query: z.string().min(1).max(500), limit: z.number().min(1).max(100).default(10) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(analyticsMetrics).orderBy(desc(analyticsMetrics.createdAt)).limit(input.limit);
    return { results: rows, query: input.query, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(analyticsMetrics);
    return { totalVectors: Number(total.value) };
  }),
});
