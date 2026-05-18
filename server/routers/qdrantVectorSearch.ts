import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { analyticsMetrics, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const qdrantVectorSearchRouter = router({
  search: protectedProcedure.input(z.object({ query: z.string().min(1).max(500), limit: z.number().min(1).max(100).default(10) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(analyticsMetrics).orderBy(desc(analyticsMetrics.createdAt)).limit(input.limit);
      return { results: rows, query: input.query, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(analyticsMetrics).limit(100);
    return { totalVectors: Number(total.value) };
  }),
});
