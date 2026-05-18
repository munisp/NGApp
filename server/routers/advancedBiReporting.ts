import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { biReportDefinitions, transactions, agents } from "../../drizzle/schema";

export const advancedBiReportingRouter = router({
  listReports: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(biReportDefinitions).orderBy(desc(biReportDefinitions.createdAt)).limit(input?.limit ?? 50);
    return { reports: rows, total: rows.length };
  }),
  getKpis: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const [txVolume] = await db.select({ value: sum(transactions.amount) }).from(transactions);
    const [agentCount] = await db.select({ value: count() }).from(agents);
    return { totalTransactions: Number(txCount.value), totalVolume: Number(txVolume.value ?? 0), totalAgents: Number(agentCount.value) };
  }),
});
