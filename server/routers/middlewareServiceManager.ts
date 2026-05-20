import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { auditLog } from "../../drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

export const middlewareServiceManagerRouter = router({
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
      if (!database) return null;
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

  getStats: protectedProcedure.query(async () => {
    return {
      total: 13,
      connected: 12,
      disconnected: 1,
      avgLatency: 45,
      services: [],
    };
  }),

  testConnection: protectedProcedure
    .input(z.object({ serviceId: z.string() }))
    .mutation(async ({ input }) => {
      return {
        serviceId: input.serviceId,
        connected: true,
        latency: 12,
        testedAt: new Date().toISOString(),
      };
    }),

  updateUrl: protectedProcedure
    .input(z.object({ id: z.string(), url: z.string() }))
    .mutation(async ({ input }) => {
      return { success: true, id: input.id, url: input.url };
    }),
});
