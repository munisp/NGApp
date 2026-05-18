import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { platformBillingLedger, tenantBillingConfig } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const liveBillingDashboardRouter = router({
  getOverview: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platformBillingLedger).limit(100);
    const [totalAmt] = await db.select({ value: sum(platformBillingLedger.grossAmount) }).from(platformBillingLedger).limit(100);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [monthly] = await db.select({ value: sum(platformBillingLedger.grossAmount) }).from(platformBillingLedger).where(gte(platformBillingLedger.createdAt, thirtyDaysAgo)).limit(100);
    return { totalCharges: Number(total.value), totalRevenue: Number(totalAmt.value ?? 0), monthlyRevenue: Number(monthly.value ?? 0) };
  }),
  listRecent: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(platformBillingLedger).orderBy(desc(platformBillingLedger.createdAt)).limit(input?.limit ?? 50);
      return { charges: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
