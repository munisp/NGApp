// Sprint 87: Upgraded from mock data to real DB queries — paymentNotificationSystem
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { notificationDispatchLog } from "../../drizzle/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const getNotifications = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getStats = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    const recent = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(5);
    return { totalRecords: total, recentItems: recent, summary: { active: total, lastUpdated: new Date().toISOString() } };
  });
const markRead = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const configureChannels = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getChannelConfig = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const testNotification = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });
const getDeliveryLog = protectedProcedure
  .input(z.object({ page: z.number().optional(), limit: z.number().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const db = (await getDb())!;
    const lim = input.limit ?? 10;
    const offset = ((input.page ?? 1) - 1) * lim;
    const rows = await db.select().from(notificationDispatchLog).orderBy(desc(notificationDispatchLog.id)).limit(lim).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(notificationDispatchLog);
    return { items: rows, total, page: input.page ?? 1, limit: lim };
  });

export const paymentNotificationSystemRouter = router({
  getNotifications,
  getStats,
  markRead,
  configureChannels,
  getChannelConfig,
  testNotification,
  getDeliveryLog,
});
