import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const nlFinancialQueryRouter = router({
  query: protectedProcedure.input(z.object({ question: z.string().min(3).max(500) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [totalTx] = await db.select({ value: count() }).from(transactions);
    const [totalVol] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    return { answer: `Total transactions: ${totalTx.value}, Total volume: ${totalVol.value ?? 0}`, query: input.question };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    return { totalTransactions: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
