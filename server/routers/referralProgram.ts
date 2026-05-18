import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agents, auditLog } from "../../drizzle/schema";

export const referralProgramRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalReferrals: 0, pendingReferrals: 0, completedReferrals: 0, totalRewards: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "referral_created")).orderBy(desc(auditLog.createdAt)).limit(500);
    const completed = rows.filter(r => (r.metadata as any)?.status === "completed").length;
    return { totalReferrals: rows.length, pendingReferrals: rows.length - completed, completedReferrals: completed, totalRewards: completed * 500 };
  }),
  listReferrals: protectedProcedure.input(z.object({ agentId: z.number().optional(), status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { referrals: [], total: 0 };
    const conditions: any[] = [eq(auditLog.action, "referral_created")];
    if (input?.agentId) conditions.push(sql`${auditLog.metadata}->>'referrerId' = ${String(input.agentId)}`);
    const rows = await db.select().from(auditLog).where(and(...conditions)).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { referrals: rows.map(r => ({ id: r.id, ...r.metadata as any, createdAt: r.createdAt })), total: rows.length };
  }),
  createReferral: protectedProcedure.input(z.object({ referrerId: z.number(), referredName: z.string(), referredPhone: z.string(), referredEmail: z.string().optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const referralCode = "REF-" + crypto.randomUUID().toUpperCase();
    await db.insert(auditLog).values({ action: "referral_created", resource: "referrals", resourceId: referralCode, status: "success", metadata: { referrerId: input.referrerId, referredName: input.referredName, referredPhone: input.referredPhone, referredEmail: input.referredEmail, status: "pending", rewardAmount: 500 } });
    return { success: true, referralCode };
  }),
  completeReferral: protectedProcedure.input(z.object({ referralCode: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.insert(auditLog).values({ action: "referral_completed", resource: "referrals", resourceId: input.referralCode, status: "success", metadata: { status: "completed", completedAt: new Date().toISOString() } });
    return { success: true };
  }),
});
