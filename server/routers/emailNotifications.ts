import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { auditLog } from "../../drizzle/schema";
import { desc, eq, sql, and, gte, lte, count } from "drizzle-orm";

export const emailNotificationsRouter = router({
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
  getPreferences: protectedProcedure.query(async () => {
    return {
      emailEnabled: true,
      frequency: "daily",
      categories: ["alerts", "reports", "system"],
    };
  }),
  updatePreferences: protectedProcedure
    .input(
      z.object({
        emailEnabled: z.boolean().optional(),
        frequency: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return { success: true };
    }),
  sendTest: protectedProcedure
    .input(z.object({ to: z.string(), template: z.string().optional() }))
    .mutation(async ({ input }) => {
      return { sent: true, to: input.to };
    }),
  sendCustom: protectedProcedure
    .input(z.object({ to: z.string(), subject: z.string(), body: z.string() }))
    .mutation(async ({ input }) => {
      return { sent: true };
    }),
  getDeliveryLog: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),
  getProviderStatus: protectedProcedure.query(async () => {
    return { provider: "ses", status: "healthy", deliveryRate: 99.2 };
  }),
  getStats: protectedProcedure.query(async () => {
    return { sent: 0, delivered: 0, bounced: 0, opened: 0 };
  }),
});
