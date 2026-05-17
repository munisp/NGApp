// @ts-nocheck
// Sprint 87: Upgraded from mock data to real DB queries — agentBenchmarking
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getBenchmarks = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getPeerComparison = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getPerformanceTrend = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agents).orderBy(desc(agents.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agents);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getRankings = protectedProcedure
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
  .input(z.object({ id: z.number(), data: z.record(z.any()).optional() }))
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

export const agentBenchmarkingRouter = router({
  getBenchmarks,
  getPeerComparison,
  getPerformanceTrend,
  getRankings,
  setTargets,
});
