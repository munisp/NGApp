import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, auditLog } from "../../drizzle/schema";

export const paymentDisputeArbitrationRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalDisputes: 0, pending: 0, resolved: 0, avgResolutionDays: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "dispute_filed")).orderBy(desc(auditLog.createdAt)).limit(500);
    const resolved = rows.filter(r => (r.metadata as any)?.status === "resolved").length;
    return { totalDisputes: rows.length, pending: rows.length - resolved, resolved, avgResolutionDays: 3 };
  }),
  listDisputes: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { disputes: [], total: 0 };
    const conditions: any[] = [eq(auditLog.action, "dispute_filed")];
    if (input?.status) conditions.push(sql`${auditLog.status} = ${input.status}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { disputes: rows.map(r => ({ id: r.id, disputeId: r.resourceId, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  fileDispute: protectedProcedure.input(z.object({ transactionId: z.number(), reason: z.string(), amount: z.number(), evidence: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const disputeId = "DSP-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "dispute_filed", resource: "disputes", resourceId: disputeId, status: "success", metadata: { transactionId: input.transactionId, reason: input.reason, amount: input.amount, status: "pending" } });
    return { success: true, disputeId };
  }),
  resolveDispute: protectedProcedure.input(z.object({ disputeId: z.string(), resolution: z.enum(["merchant_favor", "customer_favor", "split"]), notes: z.string().optional(), refundAmount: z.number().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "dispute_resolved", resource: "disputes", resourceId: input.disputeId, status: "success", metadata: { resolution: input.resolution, notes: input.notes, refundAmount: input.refundAmount, status: "resolved" } });
    return { success: true };
  }),
});
