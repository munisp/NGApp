import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, gte } from "drizzle-orm";
import { agents, transactions, disputes, merchants, customers, auditLog } from "../../drizzle/schema";

export const executiveCommandCenterRouter = router({
  getDashboard: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [agentCount] = await db.select({ value: count() }).from(agents);
    const [activeAgents] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true));
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    const [disputeCount] = await db.select({ value: count() }).from(disputes).where(eq(disputes.status, "open"));
    const [merchantCount] = await db.select({ value: count() }).from(merchants);
    const [customerCount] = await db.select({ value: count() }).from(customers);
    return { agents: { total: Number(agentCount.value), active: Number(activeAgents.value) }, transactions: { total: Number(txCount.value), volume: Number(txVolume.value ?? 0) }, openDisputes: Number(disputeCount.value), totalMerchants: Number(merchantCount.value), totalCustomers: Number(customerCount.value) };
  }),
  getAlerts: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.status, "failure")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { alerts: rows, total: rows.length };
  }),
  getRevenueMetrics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(eq(transactions.status, "success"));
    const [todayVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions).where(sql`${transactions.status} = 'success' AND ${transactions.createdAt} >= CURRENT_DATE`);
    return { totalVolume: Number(totalVolume.value ?? 0), todayVolume: Number(todayVolume.value ?? 0) };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(transactions);
    return { totalTransactions: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
