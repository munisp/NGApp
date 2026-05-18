import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const ussdReceiptRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(transactions).where(eq(transactions.channel, "USSD")).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
      return { receipts: rows.map(r => ({ id: r.id, ref: r.ref, amount: r.amount, type: r.type, status: r.status, createdAt: r.createdAt })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  generate: protectedProcedure.input(z.object({ transactionId: z.number() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      await db.insert(auditLog).values({ action: "ussd_receipt_generated", resource: "transactions", resourceId: String(input.transactionId), status: "success" });
      return { transactionId: input.transactionId, status: "generated" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.channel, "USSD")).limit(100);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.channel, "USSD")).limit(100);
    return { totalUssdTransactions: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
