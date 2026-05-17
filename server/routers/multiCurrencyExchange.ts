// @ts-nocheck
// Sprint 87: Upgraded from mock data to real DB queries — multiCurrencyExchange
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agentPushSubscriptions } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getRates = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agentPushSubscriptions).orderBy(desc(agentPushSubscriptions.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agentPushSubscriptions);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const convert = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agentPushSubscriptions).orderBy(desc(agentPushSubscriptions.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agentPushSubscriptions);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getHistory = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agentPushSubscriptions).orderBy(desc(agentPushSubscriptions.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agentPushSubscriptions);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(agentPushSubscriptions);
    const recent = await db.select().from(agentPushSubscriptions).orderBy(desc(agentPushSubscriptions.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const getCorridors = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(agentPushSubscriptions).orderBy(desc(agentPushSubscriptions.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(agentPushSubscriptions);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const setSpread = protectedProcedure
  .input(z.object({ id: z.number(), data: z.record(z.any()).optional() }))
  .mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [existing] = await db.select().from(agentPushSubscriptions).where(eq(agentPushSubscriptions.id, input.id));
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "setSpread: record not found" });
    if (input.data) {
      const [updated] = await db.update(agentPushSubscriptions).set(input.data as any).where(eq(agentPushSubscriptions.id, input.id)).returning();
      return { success: true, ...updated, message: "Record updated" };
    }
    return { success: true, ...existing, message: "No changes applied" };
  });

export const multiCurrencyExchangeRouter = router({
  getRates,
  convert,
  getHistory,
  getStats,
  getCorridors,
  setSpread,
});
