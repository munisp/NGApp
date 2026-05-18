import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { savingsAccounts, savingsTransactions, auditLog } from "../../drizzle/schema";

export const savingsProductsRouter = router({
  listProducts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "savings_product")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { products: rows.map(r => ({ id: r.resourceId, name: r.action, metadata: r.metadata, createdAt: r.createdAt })), total: rows.length };
  }),
  listAccounts: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(savingsAccounts).where(eq(savingsAccounts.status, input.status)).orderBy(desc(savingsAccounts.createdAt)).limit(input?.limit ?? 50) : await db.select().from(savingsAccounts).orderBy(desc(savingsAccounts.createdAt)).limit(input?.limit ?? 50);
    return { accounts: rows, total: rows.length };
  }),
  getAccount: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [account] = await db.select().from(savingsAccounts).where(eq(savingsAccounts.id, input.id)).limit(1);
    if (!account) return null;
    const txns = await db.select().from(savingsTransactions).where(eq(savingsTransactions.accountId, input.id)).orderBy(desc(savingsTransactions.createdAt)).limit(20);
    return { ...account, transactions: txns };
  }),
  deposit: protectedProcedure.input(z.object({ accountId: z.number(), amount: z.number().positive() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [tx] = await db.insert(savingsTransactions).values({ accountId: input.accountId, amount: String(input.amount), type: "deposit" }).returning();
    await db.update(savingsAccounts).set({ balance: sql`${savingsAccounts.balance} + ${input.amount}` }).where(eq(savingsAccounts.id, input.accountId));
    await db.insert(auditLog).values({ action: "savings_deposit", resource: "savings_transactions", resourceId: String(tx.id), status: "success", metadata: { accountId: input.accountId, amount: input.amount } });
    return tx;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(savingsAccounts);
    const [totalBalance] = await db.select({ value: sum(savingsAccounts.balance) }).from(savingsAccounts);
    return { totalAccounts: Number(total.value), totalBalance: Number(totalBalance.value ?? 0) };
  }),
});
