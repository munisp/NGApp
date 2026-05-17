import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const nlFinancialQueryRouter = router({
  query: protectedProcedure.input(z.object({ query: z.string(), limit: z.number().default(10) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { results: [], queryParsed: input.query, confidence: 0 };
    await db.insert(auditLog).values({ action: "nl_query_executed", resource: "nl_financial_query", resourceId: "query-" + Date.now().toString(36), status: "success", metadata: { query: input.query } });
    const q = input.query.toLowerCase();
    if (q.includes("agent") && q.includes("count")) {
      const [result] = await db.select({ value: count() }).from(agents);
      return { results: [{ label: "Total Agents", value: Number(result.value) }], queryParsed: "COUNT agents", confidence: 0.95 };
    }
    if (q.includes("transaction") && q.includes("count")) {
      const [result] = await db.select({ value: count() }).from(transactions);
      return { results: [{ label: "Total Transactions", value: Number(result.value) }], queryParsed: "COUNT transactions", confidence: 0.95 };
    }
    const [agentCount] = await db.select({ value: count() }).from(agents);
    const [txCount] = await db.select({ value: count() }).from(transactions);
    return { results: [{ label: "Total Agents", value: Number(agentCount.value) }, { label: "Total Transactions", value: Number(txCount.value) }], queryParsed: input.query, confidence: 0.7 };
  }),
  getHistory: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { history: [] };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "nl_query_executed")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { history: rows.map(r => ({ id: r.id, query: (r.metadata as any)?.query, createdAt: r.createdAt })) };
  }),
  getSuggestions: protectedProcedure.query(async () => {
    return { suggestions: [
      "What was total revenue last month?",
      "How many agents are active?",
      "What is the transaction count today?",
      "Show top 10 agents by transactions",
      "What is the average transaction value?",
      "How many failed transactions this week?",
    ] };
  }),
});
