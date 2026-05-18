import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { auditLog, transactions } from "../../drizzle/schema";

export const esgCarbonTrackerRouter = router({
  getFootprint: protectedProcedure.input(z.object({ period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly") }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const [txCount] = await db.select({ value: count() }).from(transactions);
    const estimatedCO2 = Number(txCount.value) * 0.0035;
    return { totalTransactions: Number(txCount.value), estimatedCO2Kg: Math.round(estimatedCO2 * 100) / 100, period: input?.period ?? "monthly", offsetCredits: 0 };
  }),
  getHistory: protectedProcedure.input(z.object({ limit: z.number().default(30) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(auditLog).where(eq(auditLog.resource, "esg_carbon")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 30);
    return { history: rows.map(r => ({ date: r.createdAt, metadata: r.metadata })), total: rows.length };
  }),
  recordOffset: protectedProcedure.input(z.object({ credits: z.number().positive(), provider: z.string(), certificateId: z.string().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.insert(auditLog).values({ action: "carbon_offset_recorded", resource: "esg_carbon", resourceId: "offset-" + crypto.randomUUID(), status: "success", metadata: { credits: input.credits, provider: input.provider, certificateId: input.certificateId } });
    return { success: true, credits: input.credits };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [offsets] = await db.select({ value: count() }).from(auditLog).where(eq(auditLog.action, "carbon_offset_recorded"));
    return { totalOffsets: Number(offsets.value), lastUpdated: new Date().toISOString() };
  }),
});
