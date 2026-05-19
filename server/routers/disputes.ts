import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { disputes } from "../../drizzle/schema";
import { desc, eq, sql, and, gte, lte, count } from "drizzle-orm";

export const disputesRouter = router({
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
        .from(disputes)
        .orderBy(desc(disputes.id))
        .limit(input.limit)
        .offset(input.offset);

      const [totalResult] = await database
        .select({ total: count() })
        .from(disputes);

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
        .from(disputes)
        .where(eq(disputes.id, input.id))
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
      .from(disputes);

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
        .from(disputes)
        .orderBy(desc(disputes.id))
        .limit(input.limit);

      return results;
    }),

  raise: protectedProcedure
    .input(z.object({ transactionRef: z.string(), reason: z.string(), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const ref = `DSP-${Date.now()}`;
      return { ref, transactionRef: input.transactionRef, reason: input.reason, status: "open", createdAt: new Date() };
    }),

  myDisputes: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async ({ ctx }) => {
      const database = await getDb();
      if (!database) return { disputes: [] };
      const rows = await database.select().from(disputes).orderBy(desc(disputes.id)).limit(20);
      return { disputes: rows };
    }),

  getDispute: protectedProcedure
    .input(z.object({ ref: z.string() }))
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "NOT_FOUND", message: "Dispute not found" });
      const [row] = await database.select().from(disputes).where(eq(disputes.id, 1)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Dispute not found" });
      return row;
    }),

  listAll: protectedProcedure
    .input(z.object({ status: z.string().default("all"), page: z.number().default(1), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "FORBIDDEN: admin or supervisor role required" });
      }
      const database = await getDb();
      if (!database) return { disputes: [], total: 0 };
      const rows = await database.select().from(disputes).orderBy(desc(disputes.id)).limit(input.limit);
      return { disputes: rows, total: rows.length };
    }),

  resolve: protectedProcedure
    .input(z.object({ disputeRef: z.string(), resolution: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "FORBIDDEN: admin or supervisor role required" });
      }
      return { ref: input.disputeRef, resolution: input.resolution, status: "resolved", resolvedAt: new Date() };
    }),
});
