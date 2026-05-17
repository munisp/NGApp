import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";
import { sql, desc, gte, and, eq } from "drizzle-orm";

export const aiCashFlowPredictorRouter = router({
  getPrediction: protectedProcedure
    .input(z.object({ agentId: z.string().optional(), days: z.number().min(1).max(90).default(30) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const cutoff = new Date(Date.now() - 90 * 86400000);
      const history = await db.select({
        date: sql<string>`DATE(${transactions.createdAt})`,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        count: sql<number>`COUNT(*)`
      }).from(transactions).where(gte(transactions.createdAt, cutoff))
        .groupBy(sql`DATE(${transactions.createdAt})`).orderBy(sql`DATE(${transactions.createdAt})`);
      const avgDaily = history.length > 0 ? history.reduce((s: any, h: any) => s + Number(h.total), 0) / history.length : 0;
      const trend = history.length >= 7 ? (Number(history[history.length-1]?.total||0) - Number(history[0]?.total||0)) / history.length : 0;
      const forecast: { date: string; predicted: number; lower: number; upper: number }[] = [];
      for (let i = 0; i < input.days; i++) {
        const projectedValue = avgDaily + trend * (i + 1);
        forecast.push({
          date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split("T")[0],
          predicted: Math.max(0, projectedValue),
          lower: Math.max(0, projectedValue * 0.8),
          upper: projectedValue * 1.2,
        });
      }
      return { forecast, avgDaily, trend, confidence: history.length > 30 ? "high" : history.length > 7 ? "medium" : "low", dataPoints: history.length };
    }),
  getSeasonality: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const weekly = await db.select({
      dayOfWeek: sql<number>`DAYOFWEEK(${transactions.createdAt})`,
      avg: sql<number>`AVG(${transactions.amount})`,
      count: sql<number>`COUNT(*)`
    }).from(transactions).groupBy(sql`DAYOFWEEK(${transactions.createdAt})`);
    return { weekly, peakDay: weekly.reduce((max: any, d: any) => Number(d.avg) > Number(max.avg) ? d : max, weekly[0] || { dayOfWeek: 1, avg: 0, count: 0 }) };
  }),
  getAnomalies: protectedProcedure
    .input(z.object({ threshold: z.number().default(2) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const daily = await db.select({
        date: sql<string>`DATE(${transactions.createdAt})`,
        total: sql<number>`SUM(${transactions.amount})`
      }).from(transactions).groupBy(sql`DATE(${transactions.createdAt})`).orderBy(desc(sql`DATE(${transactions.createdAt})`)).limit(90);
      const mean = daily.reduce((s: any, d: any) => s + Number(d.total), 0) / (daily.length || 1);
      const stdDev = Math.sqrt(daily.reduce((s: any, d: any) => s + Math.pow(Number(d.total) - mean, 2), 0) / (daily.length || 1));
      const anomalies = daily.filter(d => Math.abs(Number(d.total) - mean) > input.threshold * stdDev);
      return { anomalies, mean, stdDev, totalDays: daily.length };
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
