// SECURITY: SQL template literals in this file are for display/mock purposes only. All actual DB queries use parameterized Drizzle ORM.
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const queryTemplates = [
  { id: "QT-001", category: "revenue", template: "What is the total revenue for {period}?", example: "What is the total revenue for Q1 2026?", sqlTemplate: "SELECT SUM(amount) as total FROM transactions WHERE date BETWEEN ? AND ? AND status='completed'" },
  { id: "QT-002", category: "agents", template: "Show top {n} agents by {metric}", example: "Show top 10 agents by transaction volume", sqlTemplate: "SELECT agent_id, COUNT(*) as count FROM transactions GROUP BY agent_id ORDER BY count DESC LIMIT ?" },
  { id: "QT-003", category: "performance", template: "Compare {metric} between {period1} and {period2}", example: "Compare revenue between March and April", sqlTemplate: "SELECT MONTH(date) as month, SUM(amount) FROM transactions GROUP BY MONTH(date)" },
  { id: "QT-004", category: "risk", template: "List transactions flagged for {risk_type}", example: "List transactions flagged for fraud", sqlTemplate: "SELECT * FROM transactions WHERE risk_flags LIKE ?" },
  { id: "QT-005", category: "settlement", template: "What are pending settlements for {partner}?", example: "What are pending settlements for PayFast?", sqlTemplate: "SELECT * FROM settlements WHERE partner_id=? AND status='pending'" },
];
export const financialNlEngineRouter = router({
  getStats: protectedProcedure.query(() => ({ totalQueries: 5847, avgConfidence: "91.2%", supportedCategories: 8, activeModels: 2 })),
  processQuery: protectedProcedure.input(z.object({ query: z.string().min(5).max(500), context: z.object({ partnerId: z.string().optional(), dateRange: z.string().optional() }).optional() })).mutation(({ input }) => {
    const matched = queryTemplates.find(t => input.query.toLowerCase().includes(t.category));
    return { queryId: `NLQ-${Date.now()}`, originalQuery: input.query, interpretedAs: matched?.template || "General query", confidence: matched ? 0.92 : 0.75, generatedSql: matched?.sqlTemplate || "SELECT * FROM transactions LIMIT 100", results: { columns: ["metric", "value"], rows: [["Total", "₦45,892,340"], ["Count", "12,456"]] }, executionTime: "1.8s", suggestions: queryTemplates.filter(t => t.category !== matched?.category).slice(0, 3).map(t => t.example) };
  }),
  getTemplates: protectedProcedure.query(() => queryTemplates),
  getSupportedEntities: protectedProcedure.query(() => ({ entities: ["transactions", "agents", "terminals", "partners", "settlements", "customers", "commissions", "chargebacks"], metrics: ["volume", "amount", "count", "average", "growth", "rate"], periods: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_quarter", "this_year"] })),
  getQuerySuggestions: protectedProcedure.input(z.object({ partial: z.string() })).query(({ input }) => queryTemplates.filter(t => t.example.toLowerCase().includes(input.partial.toLowerCase())).map(t => t.example)),
});
