import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const offlineQueueRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [eq(transactions.status, "pending")];
      if (input?.status) conditions.push(eq(transactions.channel, input.status));
      const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
      return { queued: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  sync: protectedProcedure.input(z.object({ transactionId: z.number() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [updated] = await db.update(transactions).set({ status: "success" }).where(eq(transactions.id, input.transactionId)).returning();
      await db.insert(auditLog).values({ action: "offline_tx_synced", resource: "transactions", resourceId: String(input.transactionId), status: "success" });
      return { id: updated?.id ?? input.transactionId, status: "synced" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.status, "pending")).limit(100);
    return { pendingCount: Number(total.value) };
  }),
});
