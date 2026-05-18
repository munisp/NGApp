import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { transactions, agents, merchants, auditLog } from "../../drizzle/schema";

export const nlAnalyticsQueryRouter = router({
  query: protectedProcedure.input(z.object({ question: z.string(), context: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const q = input.question.toLowerCase();
    let result: Record<string, unknown> = {};
    if (q.includes("agent") && (q.includes("count") || q.includes("how many"))) {
      const [cnt] = await db.select({ value: count() }).from(agents);
      result = { answer: `There are ${cnt.value} agents in the system.`, data: { agentCount: Number(cnt.value) } };
    } else if (q.includes("transaction") && (q.includes("volume") || q.includes("total"))) {
      const [vol] = await db.select({ value: sum(transactions.amount) }).from(transactions);
      result = { answer: `Total transaction volume is ${vol.value ?? 0}.`, data: { volume: Number(vol.value ?? 0) } };
    } else if (q.includes("merchant") && (q.includes("count") || q.includes("how many"))) {
      const [cnt] = await db.select({ value: count() }).from(merchants);
      result = { answer: `There are ${cnt.value} merchants.`, data: { merchantCount: Number(cnt.value) } };
    } else {
      result = { answer: "Query processed. Please try asking about agents, transactions, or merchants.", data: {} };
    }
    await db.insert(auditLog).values({ action: "nl_query", resource: "nl_analytics", resourceId: "query-" + crypto.randomUUID(), status: "success", metadata: { question: input.question } });
    return result;
  }),
  getHistory: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "nl_query")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { queries: rows.map(r => ({ id: r.id, question: (r.metadata as any)?.question, timestamp: r.createdAt })), total: rows.length };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "nl_query"));
    return { totalQueries: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
