import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { desc, eq, and, gte, lte, sql, sum, count } from "drizzle-orm";
import { transactions, platformBillingLedger, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const dailyPnlReportRouter = router({
  getReport: protectedProcedure.input(z.object({ date: z.string().optional(), agentId: z.number().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const targetDate = input?.date ? new Date(input.date) : new Date();
      const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
      const conditions = [gte(transactions.createdAt, startOfDay), lte(transactions.createdAt, endOfDay)];
      if (input?.agentId) conditions.push(eq(transactions.agentId, input.agentId));
      const [revenue] = await db.select({ totalAmount: sum(transactions.amount), totalFee: sum(transactions.fee), totalCommission: sum(transactions.commission), txCount: count() }).from(transactions).where(and(...conditions, eq(transactions.status, "success"))).limit(100);
      const [failed] = await db.select({ value: count() }).from(transactions).where(and(...conditions, eq(transactions.status, "failed"))).limit(100);
      const [billing] = await db.select({ totalBilled: sum(platformBillingLedger.platformRevenue) }).from(platformBillingLedger).where(and(gte(platformBillingLedger.createdAt, startOfDay), lte(platformBillingLedger.createdAt, endOfDay))).limit(100);
      return {
        date: targetDate.toISOString().split("T")[0],
        revenue: { totalAmount: Number(revenue.totalAmount ?? 0), totalFee: Number(revenue.totalFee ?? 0), totalCommission: Number(revenue.totalCommission ?? 0), transactionCount: Number(revenue.txCount) },
        failedTransactions: Number(failed.value),
        platformBilling: Number(billing.totalBilled ?? 0),
        netPnl: Number(revenue.totalFee ?? 0) - Number(billing.totalBilled ?? 0),
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  export: protectedProcedure.input(z.object({ startDate: z.string(), endDate: z.string(), format: z.enum(["csv", "json", "xlsx"]).default("csv") })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const start = new Date(input.startDate); const end = new Date(input.endDate);
      const rows = await db.select().from(transactions).where(and(gte(transactions.createdAt, start), lte(transactions.createdAt, end), eq(transactions.status, "success"))).orderBy(desc(transactions.createdAt)).limit(10000);
      await db.insert(auditLog).values({ action: "daily_pnl_export", resource: "transactions", status: "success", metadata: { startDate: input.startDate, endDate: input.endDate, format: input.format, rowCount: rows.length } });
      return { rows, format: input.format, totalRows: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
