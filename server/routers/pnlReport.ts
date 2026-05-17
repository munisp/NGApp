// Sprint 87: Regenerated — pnlReport with real DB queries
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pnlReports } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const list = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getByPeriod = protectedProcedure
  .input(z.object({ id: z.number().optional(), page: z.number().optional(), limit: z.number().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    if (input.id) {
      const [row] = await db.select().from(pnlReports).where(eq(pnlReports.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "getByPeriod: record not found" });
      return row;
    }
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(input.limit ?? 10).offset(((input.page ?? 1) - 1) * (input.limit ?? 10));
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: input.limit ?? 10 };
  });
const getSummary = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    const recent = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const getStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    const recent = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });

export const pnlReportRouter = router({
  list,
  getByPeriod,
  getSummary,
  getStats,
});
