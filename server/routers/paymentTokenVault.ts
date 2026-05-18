import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { encryptedFields, auditLog } from "../../drizzle/schema";

export const paymentTokenVaultRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(encryptedFields).orderBy(desc(encryptedFields.createdAt)).limit(input?.limit ?? 50);
    return { tokens: rows.map(r => ({ id: r.id, fieldName: r.fieldName, tableName: r.tableName, createdAt: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(encryptedFields);
    return { totalTokens: Number(total.value) };
  }),
});
