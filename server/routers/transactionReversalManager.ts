import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const transactionReversalManagerRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReversals: 0, pending: 0, completed: 0, rejected: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "reversal_requested")).orderBy(desc(auditLog.createdAt)).limit(500);
    const completed = rows.filter(r => (r.metadata as any)?.status === "completed").length;
    return { totalReversals: rows.length, pending: rows.length - completed, completed, rejected: 0 };
  }),
  listReversals: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { reversals: [], total: 0 };
    const conditions: any[] = [eq(auditLog.action, "reversal_requested")];
    if (input?.status) conditions.push(sql`${auditLog.status} = ${input.status}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { reversals: rows.map(r => ({ id: r.id, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  requestReversal: protectedProcedure.input(z.object({ transactionId: z.number(), reason: z.string(), requestedBy: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const txRows = await db.select().from(transactions).where(eq(transactions.id, input.transactionId)).limit(1);
    if (txRows.length === 0) return { success: false, error: "Transaction not found" };
    const reversalId = "REV-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "reversal_requested", resource: "transactions", resourceId: reversalId, status: "success", metadata: { transactionId: input.transactionId, reason: input.reason, amount: txRows[0].amount, status: "pending" } });
    return { success: true, reversalId };
  }),
  approveReversal: protectedProcedure.input(z.object({ reversalId: z.string(), approved: z.boolean(), notes: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: input.approved ? "reversal_approved" : "reversal_rejected", resource: "transactions", resourceId: input.reversalId, status: "success", metadata: { approved: input.approved, notes: input.notes, status: input.approved ? "completed" : "rejected" } });
    return { success: true };
  }),
});
