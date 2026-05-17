import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { transactions, agents, auditLog } from "../../drizzle/schema";

export const financialNlEngineRouter = router({
  query: protectedProcedure.input(z.object({ question: z.string(), context: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) return { answer: "Database not available", confidence: 0, data: [] };
    await db.insert(auditLog).values({ action: "financial_nl_query", resource: "nl_engine", resourceId: "query-" + Date.now().toString(36), status: "success", metadata: { question: input.question } });
    const q = input.question.toLowerCase();
    if (q.includes("agent")) {
      const [result] = await db.select({ value: count() }).from(agents);
      return { answer: "Total agents: " + result.value, confidence: 0.95, data: [{ metric: "Total Agents", value: Number(result.value) }] };
    }
    if (q.includes("transaction")) {
      const [result] = await db.select({ value: count() }).from(transactions);
      return { answer: "Total transactions: " + result.value, confidence: 0.95, data: [{ metric: "Total Transactions", value: Number(result.value) }] };
    }
    return { answer: "Query processed. Please refine your question.", confidence: 0.5, data: [] };
  }),
  getSuggestions: protectedProcedure.query(async () => {
    return { suggestions: ["What is total revenue?", "How many active agents?", "Transaction volume today?", "Top performing regions?", "Commission payout summary?"] };
  }),
});
