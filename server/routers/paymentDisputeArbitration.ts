import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { disputes, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const paymentDisputeArbitrationRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(disputes.status, input.status));
      const rows = await db.select().from(disputes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(disputes.createdAt)).limit(input?.limit ?? 50);
      return { disputes: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  arbitrate: protectedProcedure.input(z.object({ disputeId: z.number(), decision: z.enum(["approved", "rejected"]), note: z.string().optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [updated] = await db.update(disputes).set({ status: input.decision === "approved" ? "resolved" : "rejected", resolution: input.note ?? input.decision, resolvedAt: new Date() }).where(eq(disputes.id, input.disputeId)).returning();
      await db.insert(auditLog).values({ action: "dispute_arbitrated", resource: "disputes", resourceId: String(input.disputeId), status: "success", metadata: { decision: input.decision, note: input.note } });
      return { id: updated?.id ?? input.disputeId, status: input.decision };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(disputes).limit(100);
    const [open] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "open")).limit(100);
    const [totalAmt] = await db.select({ value: sum(disputes.amount) }).from(disputes).limit(100);
    return { totalDisputes: Number(total.value), openDisputes: Number(open.value), totalAmount: Number(totalAmt.value ?? 0) };
  }),
});
