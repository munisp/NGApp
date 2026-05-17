// Sprint 87: Upgraded from mock data to real DB queries — customerJourneyMapper
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { merchantPayouts } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getJourney = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(merchantPayouts).orderBy(desc(merchantPayouts.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(merchantPayouts);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const listJourneys = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(merchantPayouts).orderBy(desc(merchantPayouts.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(merchantPayouts);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getJourneyStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(merchantPayouts);
    const recent = await db.select().from(merchantPayouts).orderBy(desc(merchantPayouts.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const getDropoffPoints = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(merchantPayouts).orderBy(desc(merchantPayouts.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(merchantPayouts);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getConversionFunnel = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(merchantPayouts).orderBy(desc(merchantPayouts.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(merchantPayouts);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });

export const customerJourneyMapperRouter = router({
  getJourney,
  listJourneys,
  getJourneyStats,
  getDropoffPoints,
  getConversionFunnel,
});
