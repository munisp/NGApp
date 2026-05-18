import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { merchantSettlements, merchantPayouts, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const merchantSettlementDashboardRouter = router({
  listSettlements: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(merchantSettlements.status, input.status));
      const rows = await db.select().from(merchantSettlements).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(merchantSettlements.createdAt)).limit(input?.limit ?? 50);
      return { settlements: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(merchantSettlements).limit(100);
    const [totalGross] = await db.select({ value: sum(merchantSettlements.grossAmount) }).from(merchantSettlements).limit(100);
    const [totalNet] = await db.select({ value: sum(merchantSettlements.netAmount) }).from(merchantSettlements).limit(100);
    const [payoutCount] = await db.select({ value: count() }).from(merchantPayouts).limit(100);
    return { totalSettlements: Number(total.value), totalGrossAmount: Number(totalGross.value ?? 0), totalNetAmount: Number(totalNet.value ?? 0), totalPayouts: Number(payoutCount.value) };
  }),
});
