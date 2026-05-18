import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const transactionGraphAnalyzerRouter = router({
  getGraph: protectedProcedure.input(z.object({ agentId: z.number().optional(), limit: z.number().default(100) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = input?.agentId ? await db.select().from(transactions).where(eq(transactions.agentId, input.agentId)).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 100) : await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(input?.limit ?? 100);
      const nodes = new Map<number, { id: number; type: string }>();
      const edges: Array<{ from: number; to: number; amount: string }> = [];
      for (const tx of rows) {
        if (tx.agentId) nodes.set(tx.agentId, { id: tx.agentId, type: "agent" });
        if (tx.customerId) nodes.set(tx.customerId + 100000, { id: tx.customerId, type: "customer" });
        if (tx.agentId && tx.customerId) edges.push({ from: tx.agentId, to: tx.customerId + 100000, amount: tx.amount });
      }
      return { nodes: Array.from(nodes.values()), edges, totalTransactions: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getCluster: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [txCount] = await db.select({ value: count() }).from(transactions).where(eq(transactions.agentId, input.agentId)).limit(100);
      const [volume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.agentId, input.agentId)).limit(100);
      return { agentId: input.agentId, transactionCount: Number(txCount.value), volume: Number(volume.value ?? 0) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions).limit(100);
    return { totalTransactions: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
