import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { merchants, merchantSettlements, transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const merchantAnalyticsDashRouter = router({
  getDashboard: protectedProcedure.input(z.object({ merchantId: z.number().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [totalMerchants] = await db.select({ value: count() }).from(merchants).limit(100);
      const [activeMerchants] = await db.select({ value: count() }).from(merchants).where(eq(merchants.status, "active")).limit(100);
      const [txCount] = await db.select({ value: count() }).from(transactions).limit(100);
      const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).limit(100);
      return { totalMerchants: Number(totalMerchants.value), activeMerchants: Number(activeMerchants.value), totalTransactions: Number(txCount.value), totalVolume: Number(txVolume.value ?? 0) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  listMerchants: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = input?.status ? await db.select().from(merchants).where(eq(merchants.status, input.status)).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 50) : await db.select().from(merchants).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 50);
      return { merchants: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(merchants).limit(100);
    return { totalMerchants: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
