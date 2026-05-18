import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { refunds, disputes, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const disputeRefundRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(refunds.status, input.status));
      const rows = await db.select().from(refunds).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(refunds.processedAt)).limit(input?.limit ?? 50);
      return { refunds: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  process: protectedProcedure.input(z.object({ disputeId: z.number(), amount: z.number().positive() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [refund] = await db.insert(refunds).values({ disputeId: input.disputeId, refundAmount: input.amount, originalAmount: input.amount, agentId: 1, ref: `REF-${Date.now()}`, status: "pending", reason: "Dispute resolution refund" }).returning();
      await db.insert(auditLog).values({ action: "refund_processed", resource: "refunds", resourceId: String(refund.id), status: "success", metadata: { disputeId: input.disputeId, amount: input.amount } });
      return { id: refund.id, disputeId: input.disputeId, amount: input.amount, status: "pending" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(refunds).limit(100);
    const [totalAmt] = await db.select({ value: sum(refunds.refundAmount) }).from(refunds).limit(100);
    return { totalRefunds: Number(total.value), totalAmount: Number(totalAmt.value ?? 0) };
  }),
});
