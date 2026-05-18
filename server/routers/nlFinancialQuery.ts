import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const nlFinancialQueryRouter = router({
  query: protectedProcedure.input(z.object({ question: z.string().min(3).max(500) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [totalTx] = await db.select({ value: count() }).from(transactions).limit(100);
      const [totalVol] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
      return { answer: `Total transactions: ${totalTx.value}, Total volume: ${totalVol.value ?? 0}`, query: input.question };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).limit(100);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
    return { totalTransactions: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
