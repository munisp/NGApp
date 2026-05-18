import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { feeRules, feeAuditTrail, auditLog } from "../../drizzle/schema";

export const dynamicPricingEngineRouter = router({
  listRules: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(feeRules).orderBy(desc(feeRules.createdAt)).limit(input?.limit ?? 50);
    return { rules: rows, total: rows.length };
  }),
  getRule: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [rule] = await db.select().from(feeRules).where(eq(feeRules.id, input.id)).limit(1);
    return rule ?? null;
  }),
  calculatePrice: protectedProcedure.input(z.object({ amount: z.number().positive(), type: z.string(), channel: z.string().optional() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rules = await db.select().from(feeRules).where(eq(feeRules.transactionType, input.type)).limit(5);
    const applicableRule = rules[0];
    const fee = applicableRule ? (applicableRule.feeType === "percentage" ? input.amount * Number(applicableRule.feeValue) / 100 : Number(applicableRule.feeValue)) : 0;
    return { originalAmount: input.amount, fee: Math.round(fee * 100) / 100, totalAmount: input.amount + fee, ruleApplied: applicableRule?.id ?? null };
  }),
  createRule: protectedProcedure.input(z.object({ transactionType: z.string(), feeType: z.enum(["percentage", "flat"]), feeValue: z.number(), minAmount: z.number().optional(), maxAmount: z.number().optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [rule] = await db.insert(feeRules).values({ transactionType: input.transactionType, feeType: input.feeType, feeValue: String(input.feeValue), minAmount: input.minAmount ? String(input.minAmount) : null, maxAmount: input.maxAmount ? String(input.maxAmount) : null }).returning();
    await db.insert(auditLog).values({ action: "pricing_rule_created", resource: "fee_rules", resourceId: String(rule.id), status: "success", metadata: { transactionType: input.transactionType } });
    return rule;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(feeRules);
    const [totalAudit] = await db.select({ value: count() }).from(feeAuditTrail);
    return { totalRules: Number(total.value), totalFeeCalculations: Number(totalAudit.value) };
  }),
});
