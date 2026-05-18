import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { disputes, disputeMessages, disputeEvidence, transactions, auditLog } from "../../drizzle/schema";

export const customerDisputePortalRouter = router({
  listMyDisputes: protectedProcedure.input(z.object({ customerId: z.number(), limit: z.number().default(20), status: z.string().optional() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input.status ? await db.select().from(disputes).where(and(eq(disputes.agentId, input.customerId), eq(disputes.status, input.status))).orderBy(desc(disputes.createdAt)).limit(input.limit) : await db.select().from(disputes).where(eq(disputes.agentId, input.customerId)).orderBy(desc(disputes.createdAt)).limit(input.limit);
    return { disputes: rows, total: rows.length };
  }),
  getDispute: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, input.id)).limit(1);
    if (!dispute) return null;
    const messages = await db.select().from(disputeMessages).where(eq(disputeMessages.disputeId, input.id)).orderBy(disputeMessages.createdAt);
    const evidence = await db.select().from(disputeEvidence).where(eq(disputeEvidence.disputeId, input.id));
    return { ...dispute, messages, evidence };
  }),
  fileDispute: protectedProcedure.input(z.object({ customerId: z.number(), transactionId: z.number(), reason: z.string(), description: z.string(), amount: z.number().positive() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [dispute] = await db.insert(disputes).values({ customerId: input.customerId, transactionId: input.transactionId, reason: input.reason, description: input.description, amount: String(input.amount), status: "open", type: "customer" }).returning();
    await db.insert(auditLog).values({ action: "customer_dispute_filed", resource: "disputes", resourceId: String(dispute.id), status: "success", metadata: { customerId: input.customerId, transactionId: input.transactionId } });
    return dispute;
  }),
  addMessage: protectedProcedure.input(z.object({ disputeId: z.number(), content: z.string(), senderType: z.string().default("customer") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [msg] = await db.insert(disputeMessages).values({ disputeId: input.disputeId, content: input.content, senderType: input.senderType }).returning();
    return msg;
  }),
  getStats: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(disputes).where(eq(disputes.agentId, input.customerId));
    const [open] = await db.select({ value: count() }).from(disputes).where(and(eq(disputes.agentId, input.customerId), eq(disputes.status, "open")));
    return { totalDisputes: Number(total.value), openDisputes: Number(open.value) };
  }),
});
