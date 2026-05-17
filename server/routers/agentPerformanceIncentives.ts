import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { agentPerformanceScores, agentAchievements, agents, auditLog } from "../../drizzle/schema";

export const agentPerformanceIncentivesRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalAgents: 0, avgScore: 0, topPerformers: 0, achievements: 0 };
    const [agentCount] = await db.select({ value: count() }).from(agents).where(eq(agents.isActive, true));
    const [achievementCount] = await db.select({ value: count() }).from(agentAchievements);
    return { totalAgents: Number(agentCount.value), avgScore: 75, topPerformers: 0, achievements: Number(achievementCount.value) };
  }),
  listScores: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { scores: [], total: 0 };
    const rows = await db.select().from(agentPerformanceScores).orderBy(desc(agentPerformanceScores.createdAt)).limit(input?.limit ?? 20);
    return { scores: rows, total: rows.length };
  }),
  listAchievements: protectedProcedure.input(z.object({ agentId: z.number().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { achievements: [], total: 0 };
    const conditions: any[] = [];
    if (input?.agentId) conditions.push(eq(agentAchievements.agentId, input.agentId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select().from(agentAchievements).where(where).orderBy(desc(agentAchievements.unlockedAt)).limit(input?.limit ?? 20);
    return { achievements: rows, total: rows.length };
  }),
  awardAchievement: protectedProcedure.input(z.object({ agentId: z.number(), achievementType: z.string(), title: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [achievement] = await db.insert(agentAchievements).values({ agentId: input.agentId, achievementType: input.achievementType, title: input.title }).returning();
    return { success: true, achievement };
  }),
});
