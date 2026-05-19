import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { auditLog } from "../../drizzle/schema";
import { desc, eq, sql, and, gte, lte, count } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { getConfig, setConfig } from "../lib/runtimeConfig";
import { runArchivalJob, getArchivalStats } from "../lib/parquetArchival";

export const archivalAdminRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
      const results = await database
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.id))
        .limit(input.limit)
        .offset(input.offset);

      const [totalResult] = await database
        .select({ total: count() })
        .from(auditLog);

      return {
        data: results,
        total: totalResult?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
      const [record] = await database
        .select()
        .from(auditLog)
        .where(eq(auditLog.id, input.id))
        .limit(1);

      if (!record) {
        throw new Error(`Record with id ${input.id} not found`);
      }
      return record;
    }),

  getSummary: protectedProcedure.query(async () => {
    const database = await getDb();
    if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
    const [totalResult] = await database
      .select({ total: count() })
      .from(auditLog);

    return {
      totalRecords: totalResult?.total ?? 0,
      lastUpdated: new Date().toISOString(),
    };
  }),

  getRecent: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(7),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) return { data: [], total: 0, limit: 0, offset: 0 };
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const results = await database
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.id))
        .limit(input.limit);

      return results;
    }),

  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalArchived: 0, lastRun: null, schedule: null };
    const archivalStats = await getArchivalStats();
    const schedule = await getConfig("archival_schedule");
    return {
      ...archivalStats,
      schedule: schedule ?? "0 2 * * 0",
    };
  }),

  triggerArchival: protectedProcedure
    .input(
      z.object({
        triggeredBy: z.string().default("manual"),
        retentionDays: z.number().optional(),
        deleteAfterArchive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const startTime = Date.now();
      try {
        const result = await runArchivalJob({
          retentionDays: input.retentionDays,
          deleteAfterArchive: input.deleteAfterArchive,
        });
        const duration = Date.now() - startTime;
        await notifyOwner({
          title: `Archival Job Completed`,
          content: `Triggered by: ${input.triggeredBy}\nTotal archived: ${result.totalArchived} records\nDuration: ${duration}ms`,
        });
        return { ...result, duration };
      } catch (err: any) {
        const duration = Date.now() - startTime;
        await notifyOwner({
          title: `Archival Job Failed`,
          content: `Triggered by: ${input.triggeredBy}\nError: ${err.message}\nDuration: ${duration}ms`,
        });
        throw err;
      }
    }),

  updateSchedule: protectedProcedure
    .input(
      z.object({
        schedule: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await setConfig("archival_schedule", input.schedule);
      return { success: true, schedule: input.schedule };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const results = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "archival_job"))
        .orderBy(desc(auditLog.id))
        .limit(input.limit);
      return results;
    }),
});
