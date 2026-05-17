// Sprint 87: Regenerated — agentPerformanceScorecard with real DB queries
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agentPerformanceScores } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const list = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agentPerformanceScores).orderBy(desc(agentPerformanceScores.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agentPerformanceScores);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getById = protectedProcedure
  .input(z.object({ id: z.number().optional(), page: z.number().optional(), limit: z.number().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    if (input.id) {
      const [row] = await db.select().from(agentPerformanceScores).where(eq(agentPerformanceScores.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "getById: record not found" });
      return row;
    }
    const rows = await db.select().from(agentPerformanceScores).orderBy(desc(agentPerformanceScores.id)).limit(input.limit ?? 10).offset(((input.page ?? 1) - 1) * (input.limit ?? 10));
    const [{ total }] = await db.select({ total: count() }).from(agentPerformanceScores);
    return { items: rows, total, page: input.page ?? 1, limit: input.limit ?? 10 };
  });
const getLeaderboard = protectedProcedure
  .input(z.object({ id: z.number().optional(), page: z.number().optional(), limit: z.number().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    if (input.id) {
      const [row] = await db.select().from(agentPerformanceScores).where(eq(agentPerformanceScores.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "getLeaderboard: record not found" });
      return row;
    }
    const rows = await db.select().from(agentPerformanceScores).orderBy(desc(agentPerformanceScores.id)).limit(input.limit ?? 10).offset(((input.page ?? 1) - 1) * (input.limit ?? 10));
    const [{ total }] = await db.select({ total: count() }).from(agentPerformanceScores);
    return { items: rows, total, page: input.page ?? 1, limit: input.limit ?? 10 };
  });
const getStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(agentPerformanceScores);
    const recent = await db.select().from(agentPerformanceScores).orderBy(desc(agentPerformanceScores.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });

export const agentPerformanceScorecardRouter = router({
  list,
  getById,
  getLeaderboard,
  getStats,
});
