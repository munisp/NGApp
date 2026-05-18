import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, sql, sum, count } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const floatManagementRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), agentId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [eq(transactions.type, "Cash In" as any)];
    if (input?.agentId) conditions.push(eq(transactions.agentId, input.agentId));
    const rows = await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    const [total] = await db.select({ value: count() }).from(transactions).where(and(...conditions));

    const agentBalances = await db.select({
      agentId: transactions.agentId,
      totalFloat: sum(transactions.amount),
      txCount: count(),
    }).from(transactions).where(eq(transactions.type, "Cash In" as any)).groupBy(transactions.agentId).limit(50);

    return { floatTransactions: rows, total: Number(total.value), agentBalances };
  }),
});
