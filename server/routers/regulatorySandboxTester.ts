import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const sandboxes = [
  { id: "SB-001", name: "CBDC Pilot Program", regulation: "CBN eNaira Framework", status: "active", startDate: "2026-01-15", endDate: "2026-07-15", participants: 50, transactions: 12500, complianceScore: 98 },
  { id: "SB-002", name: "Open Banking API Test", regulation: "CBN Open Banking Guidelines", status: "active", startDate: "2026-02-01", endDate: "2026-08-01", participants: 25, transactions: 8900, complianceScore: 96 },
  { id: "SB-003", name: "Crypto Custody Trial", regulation: "SEC Digital Assets Framework", status: "pending", startDate: "2026-05-01", endDate: "2026-11-01", participants: 10, transactions: 0, complianceScore: 0 },
  { id: "SB-004", name: "Agent Micro-Lending", regulation: "CBN Microfinance Guidelines", status: "completed", startDate: "2025-10-01", endDate: "2026-04-01", participants: 100, transactions: 45000, complianceScore: 99 },
];
export const regulatorySandboxTesterRouter = router({
  getStats: protectedProcedure.query(() => ({ totalSandboxes: sandboxes.length, activeSandboxes: sandboxes.filter(s => s.status === "active").length, totalParticipants: sandboxes.reduce((s: any, sb: any) => s + sb.participants, 0), totalTransactions: sandboxes.reduce((s: any, sb: any) => s + sb.transactions, 0), avgComplianceScore: 97.7, regulationsTracked: 8 })),
  listSandboxes: protectedProcedure.query(() => ({ sandboxes, total: sandboxes.length })),
  getSandbox: protectedProcedure.input(z.object({ sandboxId: z.string() })).query(({ input }) => sandboxes.find(s => s.id === input.sandboxId) || null),
  createSandbox: protectedProcedure.input(z.object({ name: z.string(), regulation: z.string(), duration: z.number() })).mutation(({ input }) => ({ sandboxId: `SB-${Date.now()}`, status: "pending_approval", ...input })),
  runComplianceCheck: protectedProcedure.input(z.object({ sandboxId: z.string() })).mutation(({ input }) => ({ checkId: `CHK-${Date.now()}`, sandboxId: input.sandboxId, score: 97, findings: [{ severity: "low", description: "Minor documentation gap in API specs" }], passedAt: new Date().toISOString() })),
});
