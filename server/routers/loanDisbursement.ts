import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { agentLoans, creditApplications, agents, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const loanDisbursementRouter = router({
  listDisbursements: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = input?.status ? await db.select().from(creditApplications).where(eq(creditApplications.status, input.status as any)).orderBy(desc(creditApplications.createdAt)).limit(input?.limit ?? 50) : await db.select().from(creditApplications).orderBy(desc(creditApplications.createdAt)).limit(input?.limit ?? 50);
      return { disbursements: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getDisbursement: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [app] = await db.select().from(creditApplications).where(eq(creditApplications.id, input.id)).limit(1);
      return app ?? null;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  approveDisbursement: protectedProcedure.input(z.object({ applicationId: z.number(), amount: z.number().positive(), disbursementMethod: z.string().default("bank_transfer") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      await db.update(creditApplications).set({ status: "disbursed", approvedAmount: String(input.amount) }).where(eq(creditApplications.id, input.applicationId));
      await db.insert(auditLog).values({ action: "loan_disbursed", resource: "credit_applications", resourceId: String(input.applicationId), status: "success", metadata: { amount: input.amount, method: input.disbursementMethod } });
      return { success: true, applicationId: input.applicationId, amount: input.amount };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(creditApplications).limit(100);
    const [disbursed] = await db.select({ value: count() }).from(creditApplications).where(eq(creditApplications.status, "disbursed")).limit(100);
    const [totalAmount] = await db.select({ value: sum(creditApplications.approvedAmount) }).from(creditApplications).where(eq(creditApplications.status, "disbursed")).limit(100);
    return { totalApplications: Number(total.value), disbursedCount: Number(disbursed.value), totalDisbursed: Number(totalAmount.value ?? 0) };
  }),
});
