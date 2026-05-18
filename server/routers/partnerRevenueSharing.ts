import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import { commissionRules, commissionPayouts, auditLog } from "../../drizzle/schema";

export const partnerRevenueSharingRouter = router({
  listPartners: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(commissionRules).orderBy(desc(commissionRules.createdAt)).limit(input?.limit ?? 50);
    return { partners: rows, total: rows.length };
  }),
  getPayouts: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = input?.status ? await db.select().from(commissionPayouts).where(eq(commissionPayouts.status, input.status)).orderBy(desc(commissionPayouts.createdAt)).limit(input?.limit ?? 50) : await db.select().from(commissionPayouts).orderBy(desc(commissionPayouts.createdAt)).limit(input?.limit ?? 50);
    return { payouts: rows, total: rows.length };
  }),
  createRule: protectedProcedure.input(z.object({ name: z.string(), transactionType: z.string(), percentage: z.number().min(0).max(100) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [rule] = await db.insert(commissionRules).values({ name: input.name, transactionType: input.transactionType, percentage: String(input.percentage) }).returning();
    await db.insert(auditLog).values({ action: "revenue_sharing_rule_created", resource: "commission_rules", resourceId: String(rule.id), status: "success", metadata: { name: input.name, percentage: input.percentage } });
    return rule;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalRules] = await db.select({ value: count() }).from(commissionRules);
    const [totalPayouts] = await db.select({ value: count() }).from(commissionPayouts);
    const [totalPaid] = await db.select({ value: sum(commissionPayouts.amount) }).from(commissionPayouts).where(eq(commissionPayouts.status, "paid"));
    return { totalRules: Number(totalRules.value), totalPayouts: Number(totalPayouts.value), totalPaid: Number(totalPaid.value ?? 0) };
  }),
});
