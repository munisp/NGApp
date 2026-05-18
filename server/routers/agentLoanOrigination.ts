import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agentLoans, agents, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const agentLoanOriginationRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalLoans: 0, active: 0, defaulted: 0, totalDisbursed: "0" };
    const [total] = await db.select({ value: count() }).from(agentLoans).limit(100);
    const statusCounts = await db.select({ status: agentLoans.status, cnt: count() }).from(agentLoans).groupBy(agentLoans.status).limit(100);
    const byStatus: Record<string, number> = {};
    statusCounts.forEach(r => { byStatus[r.status] = Number(r.cnt); });
    return { totalLoans: Number(total.value), active: byStatus["disbursed"] ?? 0, defaulted: byStatus["defaulted"] ?? 0, totalDisbursed: "0" };
  }),
  listLoans: protectedProcedure.input(z.object({ agentId: z.number().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { loans: [], total: 0 };
      const conditions: any[] = [];
      if (input?.agentId) conditions.push(eq(agentLoans.agentId, input.agentId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(agentLoans).where(where).orderBy(desc(agentLoans.createdAt)).limit(input?.limit ?? 20);
      return { loans: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  applyForLoan: protectedProcedure.input(z.object({ agentId: z.number(), principalAmount: z.string(), loanType: z.string(), tenorDays: z.number().default(90) })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const rate = "5.00";
      const total = (Number(input.principalAmount) * (1 + Number(rate) / 100)).toFixed(2);
      const [loan] = await db.insert(agentLoans).values({ agentId: input.agentId, principalAmount: input.principalAmount, loanType: input.loanType, tenorDays: input.tenorDays, interestRate: rate, totalRepayable: total, status: "pending" }).returning();
      await db.insert(auditLog).values({ action: "loan_application", resource: "agent_loans", resourceId: String(loan.id), status: "success", metadata: { agentId: input.agentId, amount: input.principalAmount } });
      return { success: true, loan };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
