import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { reversalRequests, auditLog } from "../../drizzle/schema";

export const transactionReversalManagerRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(reversalRequests.status, input.status as any));
    const rows = await db.select().from(reversalRequests).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(reversalRequests.createdAt)).limit(input?.limit ?? 50);
    return { reversals: rows, total: rows.length };
  }),
  create: protectedProcedure.input(z.object({ transactionId: z.string(), agentId: z.number(), reason: z.string().min(3), amount: z.number().positive() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [rev] = await db.insert(reversalRequests).values({ transactionId: input.transactionId, agentId: input.agentId, reason: input.reason, amount: String(input.amount), currency: "NGN", status: "pending" as any }).returning();
    await db.insert(auditLog).values({ action: "reversal_requested", resource: "reversal_requests", resourceId: String(rev.id), status: "success", metadata: { transactionId: input.transactionId, amount: input.amount } });
    return { id: rev.id, status: "pending" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(reversalRequests);
    const [pending] = await db.select({ value: count() }).from(reversalRequests).where(eq(reversalRequests.status, "pending" as any));
    const [totalAmt] = await db.select({ value: sum(reversalRequests.amount) }).from(reversalRequests);
    return { totalReversals: Number(total.value), pendingReversals: Number(pending.value), totalAmount: Number(totalAmt.value ?? 0) };
  }),
});
