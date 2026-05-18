import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { customers, transactions, auditLog } from "../../drizzle/schema";

export const customerWalletSystemRouter = router({
  getBalance: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) return null;
    const [credits] = await db.select({ total: sum(transactions.amount) }).from(transactions).where(and(eq(transactions.customerId, input.customerId), eq(transactions.type, "Cash In")));
    const [debits] = await db.select({ total: sum(transactions.amount) }).from(transactions).where(and(eq(transactions.customerId, input.customerId), eq(transactions.type, "Cash Out")));
    return { customerId: input.customerId, balance: Number(credits.total ?? 0) - Number(debits.total ?? 0), currency: "NGN" };
  }),
  getTransactions: protectedProcedure.input(z.object({ customerId: z.number(), limit: z.number().default(50) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(transactions).where(eq(transactions.customerId, input.customerId)).orderBy(desc(transactions.createdAt)).limit(input.limit);
    return { transactions: rows, total: rows.length };
  }),
  topUp: protectedProcedure.input(z.object({ customerId: z.number(), amount: z.number().positive(), source: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [tx] = await db.insert(transactions).values({ customerId: input.customerId, amount: String(input.amount), type: "Cash In", status: "success", channel: "App", reference: "TOP-" + crypto.randomUUID() }).returning();
    await db.insert(auditLog).values({ action: "wallet_topup", resource: "transactions", resourceId: String(tx.id), status: "success", metadata: { customerId: input.customerId, amount: input.amount, source: input.source } });
    return { success: true, transactionId: tx.id, amount: input.amount };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalCustomers] = await db.select({ value: count() }).from(customers);
    const [totalVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    return { totalWallets: Number(totalCustomers.value), totalVolume: Number(totalVolume.value ?? 0) };
  }),
});
