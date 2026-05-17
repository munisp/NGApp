import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const pnlData = [
  { id: "PNL-001", entity: "Lagos Region", type: "region", revenue: 125000000, costs: 42000000, profit: 83000000, margin: 66.4, transactions: 45000, period: "2026-04", trend: "up" },
  { id: "PNL-002", entity: "Abuja Region", type: "region", revenue: 89000000, costs: 31000000, profit: 58000000, margin: 65.2, transactions: 32000, period: "2026-04", trend: "up" },
  { id: "PNL-003", entity: "Kano Region", type: "region", revenue: 52000000, costs: 18000000, profit: 34000000, margin: 65.4, transactions: 18000, period: "2026-04", trend: "stable" },
  { id: "PNL-004", entity: "AGT-001 (Adebayo)", type: "agent", revenue: 8500000, costs: 2100000, profit: 6400000, margin: 75.3, transactions: 3200, period: "2026-04", trend: "up" },
  { id: "PNL-005", entity: "AGT-002 (Chioma)", type: "agent", revenue: 6200000, costs: 1800000, profit: 4400000, margin: 71.0, transactions: 2800, period: "2026-04", trend: "down" },
];
export const realtimePnlDashboardRouter = router({
  getStats: protectedProcedure.query(() => ({ totalRevenue: pnlData.reduce((s: any, p: any) => s + p.revenue, 0), totalCosts: pnlData.reduce((s: any, p: any) => s + p.costs, 0), totalProfit: pnlData.reduce((s: any, p: any) => s + p.profit, 0), avgMargin: pnlData.reduce((s: any, p: any) => s + p.margin, 0) / pnlData.length, totalTransactions: pnlData.reduce((s: any, p: any) => s + p.transactions, 0), regions: 3, topPerformer: "Lagos Region", profitGrowth: 12.5 })),
  listPnl: protectedProcedure.input(z.object({ type: z.string().optional() })).query(({ input }) => ({ data: input.type ? pnlData.filter(p => p.type === input.type) : pnlData, total: pnlData.length })),
  getPnlDetail: protectedProcedure.input(z.object({ entityId: z.string() })).query(({ input }) => pnlData.find(p => p.id === input.entityId) || null),
  generateReport: protectedProcedure.input(z.object({ period: z.string(), groupBy: z.string().default("region") })).mutation(({ input }) => ({ reportId: "RPT-" + Date.now(), ...input, generatedAt: new Date().toISOString(), downloadUrl: "/api/reports/pnl-" + input.period + ".pdf" })),
});
