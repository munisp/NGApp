import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const crossBorderRemittanceHubRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [eq(transactions.type, "Transfer")];
      if (input?.status) conditions.push(eq(transactions.status, input.status as any));
      const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
      return { remittances: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.type, "Transfer")).limit(100);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.type, "Transfer")).limit(100);
    return { totalRemittances: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
