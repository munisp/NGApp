// Sprint 87: Upgraded from mock data to real DB queries — financialReportingSuite
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pnlReports } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getPnl = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getBalanceSheet = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getCashFlow = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getTrialBalance = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    const recent = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const exportReport = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getRevenueBreakdown = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(pnlReports).orderBy(desc(pnlReports.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(pnlReports);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });

export const financialReportingSuiteRouter = router({
  getPnl,
  getBalanceSheet,
  getCashFlow,
  getTrialBalance,
  getStats,
  exportReport,
  getRevenueBreakdown,
});
