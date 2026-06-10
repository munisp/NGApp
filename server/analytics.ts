import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  formatTransactionsForCSV,
  formatAnalyticsSummaryForCSV,
  formatTimeSeriesForCSV,
  formatPaymentMethodsForCSV,
  formatStatusBreakdownForCSV,
} from "./exportUtils";
import { transactions, paymentSessions } from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Analytics router for transaction data visualization
 */
export const analyticsRouter = router({
  /**
   * Get transaction volume over time
   */
  transactionVolume: protectedProcedure
    .input(
      z.object({
        merchantId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        groupBy: z.enum(["hour", "day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { merchantId, startDate, endDate, groupBy } = input;

      // Build date filter
      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(transactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        dateFilter.push(lte(transactions.createdAt, new Date(endDate)));
      }

      // Determine date format based on groupBy
      const dateFormat: Record<string, string> = {
        hour: "%Y-%m-%d %H:00:00",
        day: "%Y-%m-%d",
        week: "%Y-%U",
        month: "%Y-%m",
      };

      const result = await db
        .select({
          period: sql<string>`DATE_FORMAT(${transactions.createdAt}, ${dateFormat[groupBy]})`,
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.merchantId, merchantId),
            ...dateFilter
          )
        )
        .groupBy(sql`period`)
        .orderBy(sql`period ASC`);

      return result.map((row) => ({
        period: row.period,
        count: Number(row.count),
        totalAmount: Number(row.totalAmount),
      }));
    }),

  /**
   * Get revenue over time
   */
  revenueOverTime: protectedProcedure
    .input(
      z.object({
        merchantId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        groupBy: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { merchantId, startDate, endDate, groupBy } = input;

      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(transactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        dateFilter.push(lte(transactions.createdAt, new Date(endDate)));
      }

      const dateFormat: Record<string, string> = {
        day: "%Y-%m-%d",
        week: "%Y-%U",
        month: "%Y-%m",
      };

      const result = await db
        .select({
          period: sql<string>`DATE_FORMAT(${transactions.createdAt}, ${dateFormat[groupBy]})`,
          revenue: sql<number>`SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE 0 END)`,
          refunds: sql<number>`SUM(CASE WHEN ${transactions.status} = 'refunded' THEN ${transactions.amount} ELSE 0 END)`,
          netRevenue: sql<number>`SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} WHEN ${transactions.status} = 'refunded' THEN -${transactions.amount} ELSE 0 END)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.merchantId, merchantId),
            ...dateFilter
          )
        )
        .groupBy(sql`period`)
        .orderBy(sql`period ASC`);

      return result.map((row) => ({
        period: row.period,
        revenue: Number(row.revenue),
        refunds: Number(row.refunds),
        netRevenue: Number(row.netRevenue),
      }));
    }),

  /**
   * Get payment method distribution
   */
  paymentMethodDistribution: protectedProcedure
    .input(
      z.object({
        merchantId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { merchantId, startDate, endDate } = input;

      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(transactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        dateFilter.push(lte(transactions.createdAt, new Date(endDate)));
      }

      const result = await db
        .select({
          paymentMethod: transactions.paymentMethod,
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.merchantId, merchantId),
            ...dateFilter
          )
        )
        .groupBy(transactions.paymentMethod)
        .orderBy(desc(sql`count`));

      return result.map((row) => ({
        paymentMethod: row.paymentMethod,
        count: Number(row.count),
        totalAmount: Number(row.totalAmount),
        percentage: 0, // Will be calculated on frontend
      }));
    }),

  /**
   * Get transaction status breakdown
   */
  statusBreakdown: protectedProcedure
    .input(
      z.object({
        merchantId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { merchantId, startDate, endDate } = input;

      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(transactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        dateFilter.push(lte(transactions.createdAt, new Date(endDate)));
      }

      const result = await db
        .select({
          status: transactions.status,
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.merchantId, merchantId),
            ...dateFilter
          )
        )
        .groupBy(transactions.status)
        .orderBy(desc(sql`count`));

      return result.map((row) => ({
        status: row.status,
        count: Number(row.count),
        totalAmount: Number(row.totalAmount),
      }));
    }),

  /**
   * Get dashboard summary statistics
   */
  dashboardSummary: protectedProcedure
    .input(
      z.object({
        merchantId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { merchantId, startDate, endDate } = input;

      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(transactions.createdAt, new Date(startDate)));
      }
      if (endDate) {
        dateFilter.push(lte(transactions.createdAt, new Date(endDate)));
      }

      const result = await db
        .select({
          totalTransactions: sql<number>`COUNT(*)`,
          completedTransactions: sql<number>`SUM(CASE WHEN ${transactions.status} = 'completed' THEN 1 ELSE 0 END)`,
          failedTransactions: sql<number>`SUM(CASE WHEN ${transactions.status} = 'failed' THEN 1 ELSE 0 END)`,
          totalRevenue: sql<number>`SUM(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE 0 END)`,
          totalRefunds: sql<number>`SUM(CASE WHEN ${transactions.status} = 'refunded' THEN ${transactions.amount} ELSE 0 END)`,
          averageTransactionValue: sql<number>`AVG(CASE WHEN ${transactions.status} = 'completed' THEN ${transactions.amount} ELSE NULL END)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.merchantId, merchantId),
            ...dateFilter
          )
        );

      const stats = result[0];

      return {
        totalTransactions: Number(stats.totalTransactions),
        completedTransactions: Number(stats.completedTransactions),
        failedTransactions: Number(stats.failedTransactions),
        totalRevenue: Number(stats.totalRevenue),
        totalRefunds: Number(stats.totalRefunds),
        averageTransactionValue: Number(stats.averageTransactionValue) || 0,
        successRate:
          stats.totalTransactions > 0
            ? (Number(stats.completedTransactions) / Number(stats.totalTransactions)) * 100
            : 0,
      };
    }),

  /**
   * Get recent transactions
   */
  recentTransactions: protectedProcedure
    .input(
      z.object({
        merchantId: z.number(),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { merchantId, limit } = input;

      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.merchantId, merchantId))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);

      return result;
    }),

  // CSV Export endpoints
  exportTransactionsCSV: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const txns = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.merchantId, input.merchantId),
            gte(transactions.createdAt, new Date(input.startDate)),
            lte(transactions.createdAt, new Date(input.endDate))
          )
        );
      
      const csv = formatTransactionsForCSV(txns);
      return { csv, filename: `transactions_${input.merchantId}_${Date.now()}.csv` };
    }),

  exportSummaryCSV: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      // Reuse dashboardSummary logic
      const summary = await analyticsRouter.createCaller(ctx).dashboardSummary(input);
      
      const csv = formatAnalyticsSummaryForCSV(summary);
      return { csv, filename: `summary_${input.merchantId}_${Date.now()}.csv` };
    }),

  exportRevenueCSV: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      groupBy: z.enum(["day", "week", "month"]),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const data = await analyticsRouter.createCaller(ctx).revenueOverTime(input);
      
      const csv = formatTimeSeriesForCSV(data, 'revenue');
      return { csv, filename: `revenue_${input.merchantId}_${Date.now()}.csv` };
    }),

  exportVolumeCSV: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      groupBy: z.enum(["day", "week", "month"]),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const data = await analyticsRouter.createCaller(ctx).transactionVolume(input);
      
      const csv = formatTimeSeriesForCSV(data, 'volume');
      return { csv, filename: `volume_${input.merchantId}_${Date.now()}.csv` };
    }),

  exportPaymentMethodsCSV: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const data = await analyticsRouter.createCaller(ctx).paymentMethodDistribution(input);
      
      const csv = formatPaymentMethodsForCSV(data);
      return { csv, filename: `payment_methods_${input.merchantId}_${Date.now()}.csv` };
    }),
});
