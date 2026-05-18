import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { tenantCorridors, auditLog } from "../../drizzle/schema";

export const currencyHedgingRouter = router({
  listCorridors: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(tenantCorridors).orderBy(desc(tenantCorridors.updatedAt)).limit(input?.limit ?? 50);
    return { corridors: rows, total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(tenantCorridors);
    return { totalCorridors: Number(total.value) };
  }),
});
