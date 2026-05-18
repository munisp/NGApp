import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { agentLoans, auditLog } from "../../drizzle/schema";

export const agentLoanAdvanceRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions = [];
    if (input?.status) conditions.push(eq(agentLoans.status, input.status as any));
    const rows = await db.select().from(agentLoans).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(agentLoans.createdAt)).limit(input?.limit ?? 50);
    return { loans: rows, total: rows.length };
  }),
  applyLoan: protectedProcedure.input(z.object({ agentId: z.number(), amount: z.number().positive(), purpose: z.string().min(3) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [loan] = await db.insert(agentLoans).values({ agentId: input.agentId, principalAmount: String(input.amount), interestRate: "5.00", tenorDays: 180, loanType: "advance", totalRepayable: String(input.amount * 1.05), status: "pending" }).returning();
    await db.insert(auditLog).values({ action: "loan_advance_applied", resource: "agent_loans", resourceId: String(loan.id), status: "success", metadata: { agentId: input.agentId, amount: input.amount } });
    return { id: loan.id, agentId: input.agentId, amount: input.amount, status: "pending" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(agentLoans);
    const [totalAmt] = await db.select({ value: sum(agentLoans.principalAmount) }).from(agentLoans);
    return { totalLoans: Number(total.value), totalPrincipal: Number(totalAmt.value ?? 0) };
  }),
});
