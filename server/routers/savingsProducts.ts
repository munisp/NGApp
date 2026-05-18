import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const savingsProductsRouter = router({
  listAccounts: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), agentId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(transactions.type, "Savings")];
    if (input?.agentId) conditions.push(eq(transactions.agentId, input.agentId));
    const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { accounts: rows, total: rows.length };
  }),
  deposit: protectedProcedure.input(z.object({ accountId: z.number(), amount: z.number().positive().max(10_000_000), agentId: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const reference = "SAV-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const [tx] = await db.insert(transactions).values({ agentId: input.agentId ?? input.accountId, amount: String(input.amount), type: "Savings", status: "success", channel: "POS", reference }).returning();
    await db.insert(auditLog).values({ action: "savings_deposit", resource: "savings_transactions", resourceId: String(tx.id), status: "success", metadata: { accountId: input.accountId, amount: input.amount, type: "deposit" } });
    return { id: tx.id, accountId: input.accountId, amount: input.amount, type: "deposit", reference, status: "success" };
  }),
  withdraw: protectedProcedure.input(z.object({ accountId: z.number(), amount: z.number().positive().max(5_000_000), agentId: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const reference = "SAV-W-" + crypto.randomUUID().slice(0, 12).toUpperCase();
    const [tx] = await db.insert(transactions).values({ agentId: input.agentId ?? input.accountId, amount: String(-input.amount), type: "Savings", status: "success", channel: "POS", reference }).returning();
    await db.insert(auditLog).values({ action: "savings_withdrawal", resource: "savings_transactions", resourceId: String(tx.id), status: "success", metadata: { accountId: input.accountId, amount: input.amount, type: "withdrawal" } });
    return { id: tx.id, accountId: input.accountId, amount: input.amount, type: "withdrawal", reference, status: "success" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [deposits] = await db.select({ total: count(), volume: sum(sql`CAST(amount AS numeric)`) }).from(transactions).where(eq(transactions.type, "Savings"));
    return { totalAccounts: 0, totalDeposits: Number(deposits.total), totalVolume: Number(deposits.volume ?? 0) };
  }),
});
