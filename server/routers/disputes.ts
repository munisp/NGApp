import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { disputes, disputeMessages, disputeEvidence, auditLog } from "../../drizzle/schema";

export const disputesRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional(), agentId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(disputes.status, input.status));
    if (input?.agentId) conditions.push(eq(disputes.agentId, input.agentId));
    const rows = await db.select().from(disputes).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(disputes.createdAt)).limit(input?.limit ?? 50);
    return { disputes: rows, total: rows.length };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, input.id)).limit(1);
    const messages = await db.select().from(disputeMessages).where(eq(disputeMessages.disputeId, input.id)).orderBy(desc(disputeMessages.createdAt));
    const evidence = await db.select().from(disputeEvidence).where(eq(disputeEvidence.disputeId, input.id));
    return { dispute, messages, evidence };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(disputes);
    const [open] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "open"));
    const [totalAmt] = await db.select({ value: sum(disputes.amount) }).from(disputes);
    return { totalDisputes: Number(total.value), openDisputes: Number(open.value), totalAmount: Number(totalAmt.value ?? 0) };
  }),
});
