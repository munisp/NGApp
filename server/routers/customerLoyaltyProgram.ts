import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { loyaltyHistory, customers, auditLog } from "../../drizzle/schema";

export const customerLoyaltyProgramRouter = router({
  getBalance: protectedProcedure.input(z.object({ customerId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [earned] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(and(eq(loyaltyHistory.agentId, input.customerId), eq(loyaltyHistory.type, "earned")));
    const [redeemed] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(and(eq(loyaltyHistory.agentId, input.customerId), eq(loyaltyHistory.type, "redeemed")));
    return { customerId: input.customerId, earned: Number(earned.total ?? 0), redeemed: Number(redeemed.total ?? 0), balance: Number(earned.total ?? 0) - Number(redeemed.total ?? 0) };
  }),
  getHistory: protectedProcedure.input(z.object({ customerId: z.number(), limit: z.number().default(50) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(loyaltyHistory).where(eq(loyaltyHistory.agentId, input.customerId)).orderBy(desc(loyaltyHistory.createdAt)).limit(input.limit);
    return { history: rows, total: rows.length };
  }),
  earnPoints: protectedProcedure.input(z.object({ customerId: z.number(), points: z.number().positive(), reason: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [entry] = await db.insert(loyaltyHistory).values({ customerId: input.customerId, points: input.points, type: "earned", description: input.reason }).returning();
    await db.insert(auditLog).values({ action: "loyalty_points_earned", resource: "loyalty_history", resourceId: String(entry.id), status: "success", metadata: { customerId: input.customerId, points: input.points } });
    return entry;
  }),
  redeemPoints: protectedProcedure.input(z.object({ customerId: z.number(), points: z.number().positive(), reward: z.string() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [earned] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(and(eq(loyaltyHistory.agentId, input.customerId), eq(loyaltyHistory.type, "earned")));
    const [redeemed] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(and(eq(loyaltyHistory.agentId, input.customerId), eq(loyaltyHistory.type, "redeemed")));
    const balance = Number(earned.total ?? 0) - Number(redeemed.total ?? 0);
    if (balance < input.points) throw new Error("Insufficient loyalty points");
    const [entry] = await db.insert(loyaltyHistory).values({ customerId: input.customerId, points: -input.points, type: "redeemed", description: input.reward }).returning();
    await db.insert(auditLog).values({ action: "loyalty_points_redeemed", resource: "loyalty_history", resourceId: String(entry.id), status: "success", metadata: { customerId: input.customerId, points: input.points, reward: input.reward } });
    return entry;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalEarned] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(eq(loyaltyHistory.type, "earned"));
    const [totalRedeemed] = await db.select({ total: sum(loyaltyHistory.points) }).from(loyaltyHistory).where(eq(loyaltyHistory.type, "redeemed"));
    const [memberCount] = await db.select({ value: count() }).from(customers);
    return { totalPointsEarned: Number(totalEarned.total ?? 0), totalPointsRedeemed: Number(totalRedeemed.total ?? 0), totalMembers: Number(memberCount.value) };
  }),
});
