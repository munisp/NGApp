import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { settlementReconciliation, transactions } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const transactionReconciliationRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(settlementReconciliation.status, input.status as any));
      const rows = await db.select().from(settlementReconciliation).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(settlementReconciliation.createdAt)).limit(input?.limit ?? 50);
      return { reconciliations: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(settlementReconciliation).limit(100);
    return { totalReconciliations: Number(total.value) };
  }),
});
