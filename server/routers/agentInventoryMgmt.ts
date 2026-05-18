import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { inventoryItems, auditLog } from "../../drizzle/schema";

export const agentInventoryMgmtRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(inventoryItems.status, input.status as any));
    const rows = await db.select().from(inventoryItems).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(inventoryItems.createdAt)).limit(input?.limit ?? 50);
    return { inventory: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(inventoryItems);
    const [inStock] = await db.select({ value: count() }).from(inventoryItems).where(eq(inventoryItems.status, "in_stock" as any));
    return { totalItems: Number(total.value), inStockItems: Number(inStock.value) };
  }),
});
