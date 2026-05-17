import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const policies = [
  { id: "INS-001", agentId: "AGT-001", type: "Float Protection", premium: 15000, coverage: 5000000, status: "active", startDate: "2026-01-01", endDate: "2026-12-31", claims: 0, provider: "Leadway Assurance" },
  { id: "INS-002", agentId: "AGT-002", type: "Device Insurance", premium: 8000, coverage: 500000, status: "active", startDate: "2026-02-01", endDate: "2027-01-31", claims: 1, provider: "AXA Mansard" },
  { id: "INS-003", agentId: "AGT-003", type: "Transaction Fraud Cover", premium: 25000, coverage: 10000000, status: "active", startDate: "2026-01-15", endDate: "2027-01-14", claims: 0, provider: "Custodian Insurance" },
  { id: "INS-004", agentId: "AGT-005", type: "Float Protection", premium: 12000, coverage: 3000000, status: "lapsed", startDate: "2025-06-01", endDate: "2026-05-31", claims: 2, provider: "Leadway Assurance" },
];
export const agentMicroInsuranceRouter = router({
  getStats: protectedProcedure.query(() => ({ totalPolicies: policies.length, activePolicies: policies.filter(p => p.status === "active").length, totalPremiums: policies.reduce((s: any, p: any) => s + p.premium, 0), totalCoverage: policies.reduce((s: any, p: any) => s + p.coverage, 0), totalClaims: policies.reduce((s: any, p: any) => s + p.claims, 0), claimRatio: 0.08, providers: 3, penetrationRate: 32 })),
  listPolicies: protectedProcedure.query(() => ({ policies, total: policies.length })),
  getPolicy: protectedProcedure.input(z.object({ policyId: z.string() })).query(({ input }) => policies.find(p => p.id === input.policyId) || null),
  createPolicy: protectedProcedure.input(z.object({ agentId: z.string(), type: z.string(), coverageAmount: z.number() })).mutation(({ input }) => ({ policyId: `INS-${Date.now()}`, status: "pending_underwriting", premium: Math.floor(input.coverageAmount * 0.003), ...input })),
  fileClaim: protectedProcedure.input(z.object({ policyId: z.string(), amount: z.number(), description: z.string() })).mutation(({ input }) => ({ claimId: `CLM-${Date.now()}`, status: "under_review", ...input, estimatedProcessing: "5-7 business days" })),
});
