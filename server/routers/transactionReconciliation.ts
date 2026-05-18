import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { settlementReconciliation, transactions } from "../../drizzle/schema";

export const transactionReconciliationRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(settlementReconciliation.status, input.status as any));
    const rows = await db.select().from(settlementReconciliation).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(settlementReconciliation.createdAt)).limit(input?.limit ?? 50);
    return { reconciliations: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(settlementReconciliation);
    return { totalReconciliations: Number(total.value) };
  }),
});
