import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, count } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const transactionReversalWorkflowRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(transactions.status, "pending_reversal_approval" as any)];
    if (input?.status && input.status !== "pending_reversal_approval") conditions.push(eq(transactions.status, input.status as any));
    const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    const [total] = await db.select({ value: count() }).from(transactions).where(and(...conditions));
    return { reversals: rows, total: Number(total.value) };
  }),
  approve: protectedProcedure.input(z.object({ transactionId: z.number(), approvedBy: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(transactions).set({ status: "reversed" as any, approvedBy: input.approvedBy, approvedAt: new Date() }).where(eq(transactions.id, input.transactionId)).returning();
    if (!updated) throw new Error("Transaction not found");
    await db.insert(auditLog).values({ action: "transaction_reversal_approved", resource: "transactions", resourceId: String(input.transactionId), status: "success", metadata: { approvedBy: input.approvedBy, ref: updated.ref } });
    return { id: updated.id, ref: updated.ref, status: "reversed" };
  }),
  reject: protectedProcedure.input(z.object({ transactionId: z.number(), reason: z.string().min(1), rejectedBy: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(transactions).set({ status: "failed" as any, failureReason: input.reason }).where(eq(transactions.id, input.transactionId)).returning();
    if (!updated) throw new Error("Transaction not found");
    await db.insert(auditLog).values({ action: "transaction_reversal_rejected", resource: "transactions", resourceId: String(input.transactionId), status: "success", metadata: { reason: input.reason, rejectedBy: input.rejectedBy } });
    return { id: updated.id, ref: updated.ref, status: "failed", reason: input.reason };
  }),
});
