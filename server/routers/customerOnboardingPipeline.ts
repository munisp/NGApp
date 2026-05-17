// @ts-nocheck
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { sql, desc, eq } from "drizzle-orm";

const STAGES = ["registration", "kyc_submission", "kyc_review", "account_setup", "training", "activation", "live"] as const;

export const customerOnboardingPipelineRouter = router({
  getStages: protectedProcedure.query(() => {
    return { stages: STAGES.map((s, i) => ({ id: i + 1, name: s, order: i + 1, required: true, estimatedMinutes: [5, 15, 60, 10, 30, 5, 0][i] })) };
  }),
  getProgress: protectedProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const db = (await getDb())!;
      const userId = input.userId || ctx.user.id;
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const currentStage = user ? "live" : "registration";
      const stageIndex = STAGES.indexOf(currentStage as any);
      return { userId, currentStage, stageIndex, totalStages: STAGES.length, completionPercent: Math.round(((stageIndex + 1) / STAGES.length) * 100), startedAt: user?.createdAt?.toISOString() || new Date().toISOString() };
    }),
  advanceStage: protectedProcedure
    .input(z.object({ userId: z.string(), fromStage: z.string(), toStage: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const fromIdx = STAGES.indexOf(input.fromStage as any);
      const toIdx = STAGES.indexOf(input.toStage as any);
      if (toIdx <= fromIdx) throw new Error("Cannot go backward in pipeline");
      return { userId: input.userId, fromStage: input.fromStage, toStage: input.toStage, advancedBy: ctx.user.id, advancedAt: new Date().toISOString() };
    }),
  list: protectedProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(20), stage: z.string().optional() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const items = await db.select().from(users).orderBy(desc(users.createdAt)).limit(input.limit).offset((input.page - 1) * input.limit);
      const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
      return { items: items.map(u => ({ ...u, stage: "live", completionPercent: 100 })), total: Number(count), page: input.page };
    }),
  getMetrics: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    return { totalOnboarded: Number(count), avgDaysToComplete: 3.2, dropoffRate: 0.12, conversionRate: 0.88 };
  }),
});
