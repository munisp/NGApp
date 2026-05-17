import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const loans = [
  { id: "LOAN-001", agentId: "AGT-001", agentName: "Adebayo Ogundimu", amount: 2000000, tenure: 12, interestRate: 18, monthlyPayment: 183333, status: "active", disbursedAt: "2026-01-15", nextPayment: "2026-05-15", outstandingBalance: 1466667, creditScore: 780 },
  { id: "LOAN-002", agentId: "AGT-002", agentName: "Chioma Eze", amount: 1000000, tenure: 6, interestRate: 15, monthlyPayment: 183333, status: "active", disbursedAt: "2026-02-01", nextPayment: "2026-05-01", outstandingBalance: 500000, creditScore: 720 },
  { id: "LOAN-003", agentId: "AGT-003", agentName: "Ibrahim Musa", amount: 5000000, tenure: 24, interestRate: 20, monthlyPayment: 254167, status: "pending_approval", disbursedAt: null, nextPayment: null, outstandingBalance: 0, creditScore: 695 },
  { id: "LOAN-004", agentId: "AGT-005", agentName: "Ngozi Obi", amount: 500000, tenure: 3, interestRate: 12, monthlyPayment: 176667, status: "fully_paid", disbursedAt: "2025-12-01", nextPayment: null, outstandingBalance: 0, creditScore: 810 },
];
export const agentLoanOriginationRouter = router({
  getStats: protectedProcedure.query(() => ({ totalLoans: loans.length, activeLoans: loans.filter(l => l.status === "active").length, totalDisbursed: loans.filter(l => l.status !== "pending_approval").reduce((s: any, l: any) => s + l.amount, 0), totalOutstanding: loans.reduce((s: any, l: any) => s + l.outstandingBalance, 0), avgInterestRate: loans.reduce((s: any, l: any) => s + l.interestRate, 0) / loans.length, defaultRate: 0, pendingApproval: 1, avgCreditScore: loans.reduce((s: any, l: any) => s + l.creditScore, 0) / loans.length })),
  listLoans: protectedProcedure.input(z.object({ status: z.string().optional() })).query(({ input }) => ({ loans: input.status ? loans.filter(l => l.status === input.status) : loans, total: loans.length })),
  getLoan: protectedProcedure.input(z.object({ loanId: z.string() })).query(({ input }) => loans.find(l => l.id === input.loanId) || null),
  applyForLoan: protectedProcedure.input(z.object({ agentId: z.string(), amount: z.number(), tenure: z.number(), purpose: z.string() })).mutation(({ input }) => ({ loanId: "LOAN-" + Date.now(), status: "pending_approval", ...input, estimatedRate: 18, estimatedMonthly: Math.round(input.amount / input.tenure * 1.015) })),
  approveLoan: protectedProcedure.input(z.object({ loanId: z.string(), approvedAmount: z.number(), interestRate: z.number() })).mutation(({ input }) => ({ status: "approved", ...input, disbursementDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) })),
});
