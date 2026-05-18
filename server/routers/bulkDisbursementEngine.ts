import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const bulkDisbursementEngineRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(transactions).where(eq(transactions.type, "Transfer")).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { disbursements: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.type, "Transfer"));
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.type, "Transfer"));
    return { totalDisbursements: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
