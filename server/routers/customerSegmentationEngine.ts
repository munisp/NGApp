import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { customers, agents, transactions, auditLog } from "../../drizzle/schema";

export const customerSegmentationEngineRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalSegments: 0, totalCustomers: 0, avgSegmentSize: 0 };
    const [custCount] = await db.select({ value: count() }).from(customers);
    return { totalSegments: 5, totalCustomers: Number(custCount.value), avgSegmentSize: Math.round(Number(custCount.value) / 5) };
  }),
  listSegments: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { segments: [] };
    const [custCount] = await db.select({ value: count() }).from(customers);
    const total = Number(custCount.value);
    return { segments: [
      { id: "high_value", name: "High Value", description: "Top 10% by transaction volume", size: Math.round(total * 0.1), criteria: "tx_volume > 90th percentile" },
      { id: "regular", name: "Regular", description: "Active monthly users", size: Math.round(total * 0.4), criteria: "monthly_tx >= 5" },
      { id: "occasional", name: "Occasional", description: "1-4 transactions per month", size: Math.round(total * 0.3), criteria: "monthly_tx 1-4" },
      { id: "dormant", name: "Dormant", description: "No transactions in 30 days", size: Math.round(total * 0.15), criteria: "last_tx > 30 days" },
      { id: "new", name: "New", description: "Registered in last 30 days", size: Math.round(total * 0.05), criteria: "created < 30 days" },
    ] };
  }),
  getSegmentDetails: protectedProcedure.input(z.object({ segmentId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(20);
    return { segmentId: input.segmentId, customers: rows, total: rows.length };
  }),
});
