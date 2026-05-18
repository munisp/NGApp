import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { transactions, feeAuditTrail, auditLog } from "../../drizzle/schema";

export const revenueForecastingEngineRouter = router({
  getForecast: protectedProcedure.input(z.object({ months: z.number().default(6) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select({ month: sql<string>`TO_CHAR(${transactions.createdAt}, 'YYYY-MM')`, volume: sum(transactions.amount), cnt: count() }).from(transactions).where(eq(transactions.status, "success")).groupBy(sql`TO_CHAR(${transactions.createdAt}, 'YYYY-MM')`).orderBy(sql`TO_CHAR(${transactions.createdAt}, 'YYYY-MM')`).limit(12);
    const historical = rows.map(r => ({ month: r.month, volume: Number(r.volume ?? 0), count: Number(r.cnt) }));
    const avgGrowth = historical.length > 1 ? (Number(historical[historical.length - 1]?.volume ?? 0) - Number(historical[0]?.volume ?? 0)) / historical.length : 0;
    return { historical, forecastMonths: input?.months ?? 6, projectedGrowthRate: avgGrowth > 0 ? 0.05 : 0, confidence: 0.75 };
  }),
  getScenarios: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [currentVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.status, "success"));
    const base = Number(currentVolume.value ?? 0);
    return { scenarios: [{ name: "pessimistic", growthRate: -0.05, projectedVolume: base * 0.95 }, { name: "base", growthRate: 0.05, projectedVolume: base * 1.05 }, { name: "optimistic", growthRate: 0.15, projectedVolume: base * 1.15 }] };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    return { totalHistoricalVolume: Number(total.value ?? 0), lastUpdated: new Date().toISOString() };
  }),
});
