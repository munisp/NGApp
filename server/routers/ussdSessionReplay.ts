import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { transactions } from "../../drizzle/schema";

export const ussdSessionReplayRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(transactions).where(eq(transactions.channel, "USSD" as any)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 50);
    return { sessions: rows.map(r => ({ id: r.id, ref: r.ref, amount: r.amount, type: r.type, status: r.status, agentId: r.agentId, createdAt: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).where(eq(transactions.channel, "USSD" as any));
    const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.channel, "USSD" as any));
    return { totalSessions: Number(total.value), totalVolume: Number(volume.value ?? 0) };
  }),
});
