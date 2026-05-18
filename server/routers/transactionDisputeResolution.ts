import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, count } from "drizzle-orm";
import { disputes, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const transactionDisputeResolutionRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional(), priority: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(disputes.status, input.status));
      if (input?.priority) conditions.push(eq(disputes.priority, input.priority));
      const rows = await db.select().from(disputes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(disputes.createdAt)).limit(input?.limit ?? 50);
      const [total] = await db.select({ value: count() }).from(disputes).where(conditions.length ? and(...conditions) : undefined).limit(100);
      return { disputes: rows, total: Number(total.value) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  resolve: protectedProcedure.input(z.object({ disputeId: z.number(), resolution: z.string().min(1), resolvedBy: z.string().min(1) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [updated] = await db.update(disputes).set({ status: "resolved", resolution: input.resolution, resolvedBy: input.resolvedBy, resolvedAt: new Date() }).where(eq(disputes.id, input.disputeId)).returning();
      if (!updated) throw new Error("Dispute not found");
      await db.insert(auditLog).values({ action: "dispute_resolved", resource: "disputes", resourceId: String(input.disputeId), status: "success", metadata: { resolution: input.resolution, resolvedBy: input.resolvedBy } });
      return { id: updated.id, status: "resolved", resolution: input.resolution };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  escalate: protectedProcedure.input(z.object({ disputeId: z.number(), reason: z.string().min(1), escalateTo: z.string().min(1) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [updated] = await db.update(disputes).set({ priority: "high", assignedTo: input.escalateTo, status: "escalated" }).where(eq(disputes.id, input.disputeId)).returning();
      if (!updated) throw new Error("Dispute not found");
      await db.insert(auditLog).values({ action: "dispute_escalated", resource: "disputes", resourceId: String(input.disputeId), status: "success", metadata: { reason: input.reason, escalateTo: input.escalateTo } });
      return { id: updated.id, status: "escalated", assignedTo: input.escalateTo };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
