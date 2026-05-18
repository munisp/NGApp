import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";

export const savingsProductsRouter = router({
  listProducts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "savings_product")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { products: rows.map(r => ({ id: r.resourceId, name: (r.metadata as Record<string, unknown>)?.name ?? r.action, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  listAccounts: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "savings_accounts")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 50);
    let accounts = rows.map(r => ({ id: r.id, accountId: r.resourceId, status: (r.metadata as Record<string, unknown>)?.status ?? "active", metadata: r.metadata, createdAt: r.createdAt }));
    if (input?.status) accounts = accounts.filter(a => a.status === input.status);
    return { accounts, total: accounts.length };
  }),
  getAccount: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [account] = await db.select().from(auditLog).where(eq(auditLog.id, input.id)).limit(1);
    if (!account) return null;
    const txns = await db.select().from(auditLog).where(sql`${auditLog.resource} = 'savings_transactions' AND (${auditLog.metadata}->>'accountId')::int = ${input.id}`).orderBy(desc(auditLog.createdAt)).limit(20);
    return { id: account.id, accountId: account.resourceId, metadata: account.metadata, createdAt: account.createdAt, transactions: txns.map(t => ({ id: t.id, amount: (t.metadata as Record<string, unknown>)?.amount, type: (t.metadata as Record<string, unknown>)?.type, createdAt: t.createdAt })) };
  }),
  deposit: protectedProcedure.input(z.object({ accountId: z.number(), amount: z.number().positive() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [tx] = await db.insert(auditLog).values({ action: "savings_deposit", resource: "savings_transactions", resourceId: String(input.accountId), status: "success", metadata: { accountId: input.accountId, amount: input.amount, type: "deposit" } }).returning();
    return { id: tx.id, accountId: input.accountId, amount: input.amount, type: "deposit", createdAt: tx.createdAt };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.resource, "savings_accounts"));
    const [totalDeposits] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "savings_deposit"));
    return { totalAccounts: Number(total.value), totalDeposits: Number(totalDeposits.value) };
  }),
});
