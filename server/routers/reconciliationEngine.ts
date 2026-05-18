import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { reconciliationBatches, reconciliationItems, auditLog } from "../../drizzle/schema";

export const reconciliationEngineRouter = router({
  listBatches: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(reconciliationBatches.status, input.status));
    const rows = await db.select().from(reconciliationBatches).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(reconciliationBatches.createdAt)).limit(input?.limit ?? 50);
    return { batches: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalBatches] = await db.select({ value: count() }).from(reconciliationBatches);
    const [totalItems] = await db.select({ value: count() }).from(reconciliationItems);
    return { totalBatches: Number(totalBatches.value), totalItems: Number(totalItems.value) };
  }),
});
