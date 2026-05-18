import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const bulkTransactionProcessingRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(500).default(100), type: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.type) conditions.push(eq(transactions.type, input.type));
      if (input?.status) conditions.push(eq(transactions.status, input.status));
      const rows = await db.select().from(transactions).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 100);
      return { transactions: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).limit(100);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
    const [pending] = await db.select({ value: count() }).from(transactions).where(eq(transactions.status, "pending")).limit(100);
    return { totalTransactions: Number(total.value), totalVolume: Number(volume.value ?? 0), pendingCount: Number(pending.value) };
  }),
});
