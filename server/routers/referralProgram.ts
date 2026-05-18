import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, sum, and } from "drizzle-orm";
import { referrals, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const referralProgramRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const conditions = [];
      if (input?.status) conditions.push(eq(referrals.status, input.status as any));
      const rows = await db.select().from(referrals).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(referrals.createdAt)).limit(input?.limit ?? 50);
      return { referrals: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  create: protectedProcedure.input(z.object({ referrerAgentId: z.number(), referralCode: z.string().min(4).max(16) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const code = input.referralCode.toUpperCase();
      const [ref] = await db.insert(referrals).values({ referrerAgentId: input.referrerAgentId, referrerCode: "AGT-" + input.referrerAgentId, referralCode: code, status: "pending" as any, bonusPoints: 0, bonusCash: "0" }).returning();
      await db.insert(auditLog).values({ action: "referral_created", resource: "referrals", resourceId: String(ref.id), status: "success", metadata: { referrerAgentId: input.referrerAgentId, code } });
      return { id: ref.id, referralCode: code, status: "pending" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(referrals).limit(100);
    const [active] = await db.select({ value: count() }).from(referrals).where(eq(referrals.status, "active" as any)).limit(100);
    const [totalCash] = await db.select({ value: sum(referrals.bonusCash) }).from(referrals).limit(100);
    return { totalReferrals: Number(total.value), activeReferrals: Number(active.value), totalBonusCash: Number(totalCash.value ?? 0) };
  }),
});
