import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const offlineQueueRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(transactions.status, "pending" as any)];
    if (input?.status) conditions.push(eq(transactions.channel, input.status as any));
    const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { queued: rows, total: rows.length };
  }),
  sync: protectedProcedure.input(z.object({ transactionId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(transactions).set({ status: "success" as any }).where(eq(transactions.id, input.transactionId)).returning();
    await db.insert(auditLog).values({ action: "offline_tx_synced", resource: "transactions", resourceId: String(input.transactionId), status: "success" });
    return { id: updated?.id ?? input.transactionId, status: "synced" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.status, "pending" as any));
    return { pendingCount: Number(total.value) };
  }),
});
