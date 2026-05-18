import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const bulkTransactionProcessingRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(500).default(100), type: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.type) conditions.push(eq(transactions.type, input.type as any));
    if (input?.status) conditions.push(eq(transactions.status, input.status as any));
    const rows = await db.select().from(transactions).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 100);
    return { transactions: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    const [pending] = await db.select({ value: count() }).from(transactions).where(eq(transactions.status, "pending" as any));
    return { totalTransactions: Number(total.value), totalVolume: Number(volume.value ?? 0), pendingCount: Number(pending.value) };
  }),
});
