import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and, gte } from "drizzle-orm";
import { platformBillingLedger, tenantBillingConfig } from "../../drizzle/schema";

export const liveBillingDashboardRouter = router({
  getOverview: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platformBillingLedger);
    const [totalAmt] = await db.select({ value: sum(platformBillingLedger.grossAmount) }).from(platformBillingLedger);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [monthly] = await db.select({ value: sum(platformBillingLedger.grossAmount) }).from(platformBillingLedger).where(gte(platformBillingLedger.createdAt, thirtyDaysAgo));
    return { totalCharges: Number(total.value), totalRevenue: Number(totalAmt.value ?? 0), monthlyRevenue: Number(monthly.value ?? 0) };
  }),
  listRecent: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platformBillingLedger).orderBy(desc(platformBillingLedger.createdAt)).limit(input?.limit ?? 50);
    return { charges: rows, total: rows.length };
  }),
});
