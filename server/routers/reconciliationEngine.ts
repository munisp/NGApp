import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { reconciliationBatches, reconciliationItems, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const reconciliationEngineRouter = router({
  listBatches: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(reconciliationBatches.status, input.status));
      const rows = await db.select().from(reconciliationBatches).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(reconciliationBatches.createdAt)).limit(input?.limit ?? 50);
      return { batches: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalBatches] = await db.select({ value: count() }).from(reconciliationBatches).limit(100);
    const [totalItems] = await db.select({ value: count() }).from(reconciliationItems).limit(100);
    return { totalBatches: Number(totalBatches.value), totalItems: Number(totalItems.value) };
  }),
});
