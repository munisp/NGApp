import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, auditLog, systemConfig } from "../../drizzle/schema";

export const remittanceRouter = router({
  listTransfers: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(transactions).where(sql`${transactions.type} = 'Transfer' AND ${transactions.status} = ${input.status}`).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50) : await db.select().from(transactions).where(eq(transactions.type, "Transfer")).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { transfers: rows, total: rows.length };
  }),
  initiateTransfer: protectedProcedure.input(z.object({ senderAgentId: z.number(), recipientName: z.string(), recipientPhone: z.string(), amount: z.number().positive(), currency: z.string().default("NGN"), destinationCountry: z.string().default("NG"), corridor: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const ref = "REM-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const [tx] = await db.insert(transactions).values({ agentId: input.senderAgentId, amount: String(input.amount), type: "Transfer", status: "pending", channel: "Cash", ref }).returning();
    await db.insert(auditLog).values({ action: "remittance_initiated", resource: "transactions", resourceId: String(tx.id), status: "success", metadata: { recipientName: input.recipientName, amount: input.amount, destinationCountry: input.destinationCountry } });
    return { transactionId: tx.id, status: "pending", amount: input.amount, ref: tx.ref };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
        const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.type, "Transfer"));
        const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.type, "Transfer"));
    return { totalTransfers: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
