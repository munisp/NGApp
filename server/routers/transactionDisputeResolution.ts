import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, count } from "drizzle-orm";
import { disputes, auditLog } from "../../drizzle/schema";

export const transactionDisputeResolutionRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional(), priority: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(disputes.status, input.status));
    if (input?.priority) conditions.push(eq(disputes.priority, input.priority));
    const rows = await db.select().from(disputes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(disputes.createdAt)).limit(input?.limit ?? 50);
    const [total] = await db.select({ value: count() }).from(disputes).where(conditions.length ? and(...conditions) : undefined);
    return { disputes: rows, total: Number(total.value) };
  }),
  resolve: protectedProcedure.input(z.object({ disputeId: z.number(), resolution: z.string().min(1), resolvedBy: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(disputes).set({ status: "resolved", resolution: input.resolution, resolvedBy: input.resolvedBy, resolvedAt: new Date() }).where(eq(disputes.id, input.disputeId)).returning();
    if (!updated) throw new Error("Dispute not found");
    await db.insert(auditLog).values({ action: "dispute_resolved", resource: "disputes", resourceId: String(input.disputeId), status: "success", metadata: { resolution: input.resolution, resolvedBy: input.resolvedBy } });
    return { id: updated.id, status: "resolved", resolution: input.resolution };
  }),
  escalate: protectedProcedure.input(z.object({ disputeId: z.number(), reason: z.string().min(1), escalateTo: z.string().min(1) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [updated] = await db.update(disputes).set({ priority: "high", assignedTo: input.escalateTo, status: "escalated" }).where(eq(disputes.id, input.disputeId)).returning();
    if (!updated) throw new Error("Dispute not found");
    await db.insert(auditLog).values({ action: "dispute_escalated", resource: "disputes", resourceId: String(input.disputeId), status: "success", metadata: { reason: input.reason, escalateTo: input.escalateTo } });
    return { id: updated.id, status: "escalated", assignedTo: input.escalateTo };
  }),
});
