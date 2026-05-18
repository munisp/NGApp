import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { merchants, merchantSettlements, transactions } from "../../drizzle/schema";

export const merchantAcquirerGatewayRouter = router({
  listMerchants: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(merchants.status, input.status as any));
    const rows = await db.select().from(merchants).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(merchants.createdAt)).limit(input?.limit ?? 50);
    return { merchants: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalMerchants] = await db.select({ value: count() }).from(merchants);
    const [totalSettlements] = await db.select({ value: count() }).from(merchantSettlements);
    return { totalMerchants: Number(totalMerchants.value), totalSettlements: Number(totalSettlements.value) };
  }),
});
