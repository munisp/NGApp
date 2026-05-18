import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, gte, lte, count, sum } from "drizzle-orm";
import { transactions } from "../../drizzle/schema";

export const transactionMonitoringRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional(), type: z.string().optional(), agentId: z.number().optional(), startDate: z.string().optional(), endDate: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(transactions.status, input.status as any));
    if (input?.type) conditions.push(eq(transactions.type, input.type as any));
    if (input?.agentId) conditions.push(eq(transactions.agentId, input.agentId));
    if (input?.startDate) conditions.push(gte(transactions.createdAt, new Date(input.startDate)));
    if (input?.endDate) conditions.push(lte(transactions.createdAt, new Date(input.endDate)));
    const rows = await db.select().from(transactions).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    const [total] = await db.select({ value: count() }).from(transactions).where(conditions.length ? and(...conditions) : undefined);
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(conditions.length ? and(...conditions) : undefined);
    return { transactions: rows, total: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
