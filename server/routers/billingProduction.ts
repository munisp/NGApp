import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { platformBillingLedger, tenantBillingConfig } from "../../drizzle/schema";

export const billingProductionRouter = router({
  listCharges: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(platformBillingLedger).orderBy(desc(platformBillingLedger.createdAt)).limit(input?.limit ?? 50);
    return { charges: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(platformBillingLedger);
    const [totalAmt] = await db.select({ value: sum(platformBillingLedger.grossAmount) }).from(platformBillingLedger);
    const [configs] = await db.select({ value: count() }).from(tenantBillingConfig);
    return { totalCharges: Number(total.value), totalAmount: Number(totalAmt.value ?? 0), billingConfigs: Number(configs.value) };
  }),
});
