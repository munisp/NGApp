import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { encryptedFields, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const paymentTokenVaultRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(encryptedFields).orderBy(desc(encryptedFields.createdAt)).limit(input?.limit ?? 50);
      return { tokens: rows.map(r => ({ id: r.id, fieldName: r.fieldName, tableName: r.tableName, createdAt: r.createdAt })), total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(encryptedFields).limit(100);
    return { totalTokens: Number(total.value) };
  }),
});
