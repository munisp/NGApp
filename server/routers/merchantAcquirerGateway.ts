import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { merchants, merchantSettlements, transactions } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const merchantAcquirerGatewayRouter = router({
  listMerchants: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(merchants.status, input.status));
      const rows = await db.select().from(merchants).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 50);
      return { merchants: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalMerchants] = await db.select({ value: count() }).from(merchants).limit(100);
    const [totalSettlements] = await db.select({ value: count() }).from(merchantSettlements).limit(100);
    return { totalMerchants: Number(totalMerchants.value), totalSettlements: Number(totalSettlements.value) };
  }),
});
