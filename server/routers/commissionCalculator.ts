import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { commissionTiers, commissionRules, commissionPayouts, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const commissionCalculatorRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRules: 0, totalTiers: 0, totalPayouts: 0, totalCommission: "0" };
    const [ruleCount] = await db.select({ value: count() }).from(commissionRules).limit(100);
    const [tierCount] = await db.select({ value: count() }).from(commissionTiers).limit(100);
    const [payoutCount] = await db.select({ value: count() }).from(commissionPayouts).limit(100);
    return { totalRules: Number(ruleCount.value), totalTiers: Number(tierCount.value), totalPayouts: Number(payoutCount.value), totalCommission: "0" };
  }),
  listTiers: protectedProcedure.input(z.object({ transactionType: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { tiers: [], total: 0 };
      const conditions: any[] = [];
      if (input?.transactionType) conditions.push(eq(commissionTiers.transactionType, input.transactionType));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db.select().from(commissionTiers).where(where).limit(input?.limit ?? 20);
      return { tiers: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  calculate: protectedProcedure.input(z.object({ transactionType: z.string(), amount: z.number(), agentTier: z.string().optional() })).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { commission: 0, rate: 0, tier: null };
      const tiers = await db.select().from(commissionTiers).where(eq(commissionTiers.transactionType, input.transactionType)).limit(10);
      const matchedTier = tiers.find(t => input.amount >= Number(t.minVolume) && input.amount <= Number(t.maxVolume));
      if (!matchedTier) return { commission: 0, rate: 0, tier: null };
      const rate = Number(matchedTier.rate);
      const commission = input.amount * rate / 100 + Number(matchedTier.flatFee);
      return { commission, rate, tier: matchedTier };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
