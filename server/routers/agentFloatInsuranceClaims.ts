import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const claims = [
  { id: "CLM-001", policyId: "INS-001", agentId: "AGT-001", type: "float_theft", amount: 2500000, status: "approved", filedAt: "2026-04-10", reviewedAt: "2026-04-15", paidAt: "2026-04-18", paidAmount: 2375000, deductible: 125000 },
  { id: "CLM-002", policyId: "INS-002", agentId: "AGT-002", type: "device_damage", amount: 350000, status: "under_review", filedAt: "2026-04-18", reviewedAt: null, paidAt: null, paidAmount: 0, deductible: 50000 },
  { id: "CLM-003", policyId: "INS-003", agentId: "AGT-003", type: "fraud_loss", amount: 1800000, status: "investigating", filedAt: "2026-04-19", reviewedAt: null, paidAt: null, paidAmount: 0, deductible: 180000 },
  { id: "CLM-004", policyId: "INS-001", agentId: "AGT-005", type: "float_theft", amount: 500000, status: "rejected", filedAt: "2026-04-05", reviewedAt: "2026-04-08", paidAt: null, paidAmount: 0, deductible: 0 },
];
export const agentFloatInsuranceClaimsRouter = router({
  getStats: protectedProcedure.query(() => ({ totalClaims: claims.length, approvedClaims: claims.filter(c => c.status === "approved").length, pendingClaims: claims.filter(c => ["under_review", "investigating"].includes(c.status)).length, rejectedClaims: claims.filter(c => c.status === "rejected").length, totalClaimedAmount: claims.reduce((s: any, c: any) => s + c.amount, 0), totalPaidAmount: claims.reduce((s: any, c: any) => s + c.paidAmount, 0), avgProcessingTime: "5.2 days", claimApprovalRate: 75 })),
  listClaims: protectedProcedure.input(z.object({ status: z.string().optional() })).query(({ input }) => ({ claims: input.status ? claims.filter(c => c.status === input.status) : claims, total: claims.length })),
  getClaim: protectedProcedure.input(z.object({ claimId: z.string() })).query(({ input }) => claims.find(c => c.id === input.claimId) || null),
  fileClaim: protectedProcedure.input(z.object({ policyId: z.string(), type: z.string(), amount: z.number(), description: z.string() })).mutation(({ input }) => ({ claimId: "CLM-" + Date.now(), status: "filed", ...input })),
  reviewClaim: protectedProcedure.input(z.object({ claimId: z.string(), decision: z.enum(["approve", "reject"]), notes: z.string() })).mutation(({ input }) => ({ claimId: input.claimId, status: input.decision === "approve" ? "approved" : "rejected", reviewedAt: new Date().toISOString() })),
});
