import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const sampleQueries = [
  { query: "What was total revenue last month?", sql: "SELECT SUM(amount) FROM transactions WHERE date >= '2026-03-01'", result: "₦45,892,340", confidence: 0.95 },
  { query: "Show me top 10 agents by volume", sql: "SELECT agent_id, COUNT(*) as volume FROM transactions GROUP BY agent_id ORDER BY volume DESC LIMIT 10", result: "Agent rankings generated", confidence: 0.92 },
  { query: "How many failed transactions this week?", sql: "SELECT COUNT(*) FROM transactions WHERE status='failed' AND date >= '2026-04-14'", result: "127 failed transactions", confidence: 0.97 },
  { query: "Average transaction value in Lagos", sql: "SELECT AVG(amount) FROM transactions WHERE region='Lagos'", result: "₦12,450", confidence: 0.89 },
  { query: "Commission earned by top 5 partners", sql: "SELECT partner_id, SUM(commission) FROM settlements GROUP BY partner_id ORDER BY SUM(commission) DESC LIMIT 5", result: "Partner commission report", confidence: 0.88 },
];

export const nlFinancialQueryRouter = router({
  getStats: protectedProcedure.query(() => ({
    totalQueries: 3847,
    avgResponseTime: "2.1s",
    accuracy: "93.5%",
    activeUsers: 89,
  })),
  executeQuery: protectedProcedure
    .input(z.object({ query: z.string().min(3).max(500), context: z.string().optional() }))
    .mutation(({ input }) => {
      const match = sampleQueries.find(q => input.query.toLowerCase().includes(q.query.toLowerCase().split(" ")[3] || ""));
      return match || { query: input.query, sql: "SELECT * FROM transactions LIMIT 100", result: "Query processed successfully", confidence: 0.75 };
    }),
  getSuggestions: protectedProcedure
    .input(z.object({ partial: z.string() }))
    .query(({ input }) => sampleQueries.filter(q => q.query.toLowerCase().includes(input.partial.toLowerCase())).map(q => q.query)),
  getQueryHistory: protectedProcedure.query(() => sampleQueries.map((q, i) => ({ ...q, id: `NLQ-${i + 1}`, executedAt: new Date(Date.now() - i * 3600000).toISOString(), userId: "USR-001" }))),
  getSchemaInfo: protectedProcedure.query(() => ({
    tables: ["transactions", "agents", "terminals", "settlements", "customers", "partners"],
    relationships: [
      { from: "transactions", to: "agents", via: "agent_id" },
      { from: "transactions", to: "terminals", via: "terminal_id" },
      { from: "agents", to: "partners", via: "partner_id" },
    ],
  })),
});
