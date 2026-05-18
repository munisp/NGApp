import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { merchantSettlements, merchantPayouts, auditLog } from "../../drizzle/schema";

export const merchantSettlementDashboardRouter = router({
  listSettlements: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(merchantSettlements.status, input.status));
    const rows = await db.select().from(merchantSettlements).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(merchantSettlements.createdAt)).limit(input?.limit ?? 50);
    return { settlements: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(merchantSettlements);
    const [totalGross] = await db.select({ value: sum(merchantSettlements.grossAmount) }).from(merchantSettlements);
    const [totalNet] = await db.select({ value: sum(merchantSettlements.netAmount) }).from(merchantSettlements);
    const [payoutCount] = await db.select({ value: count() }).from(merchantPayouts);
    return { totalSettlements: Number(total.value), totalGrossAmount: Number(totalGross.value ?? 0), totalNetAmount: Number(totalNet.value ?? 0), totalPayouts: Number(payoutCount.value) };
  }),
});
