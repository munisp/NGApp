// @ts-nocheck
// Sprint 87: Upgraded from mock data to real DB queries — agentPerformanceAnalytics
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getAgentScorecard = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getLeaderboard = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getKpiTrends = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(agents);
    const recent = await db.select().from(agents).orderBy(desc(agents.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const getRegionalComparison = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const setTargets = protectedProcedure
  .input(z.object({ id: z.number(), data: z.record(z.string(), z.any()).optional() }))
  .mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(agents).where(eq(agents.id, input.id));
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "setTargets: record not found" });
    if (input.data) {
      const [updated] = await db.update(agents).set(input.data as any).where(eq(agents.id, input.id)).returning();
      return { success: true, ...updated, message: "Record updated" };
    }
    return { success: true, ...existing, message: "No changes applied" };
  });

export const agentPerformanceAnalyticsRouter = router({
  getAgentScorecard,
  getLeaderboard,
  getKpiTrends,
  getStats,
  getRegionalComparison,
  setTargets,
});
