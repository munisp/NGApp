import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, count } from "drizzle-orm";
import { transactions } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const multiCurrencyExchangeRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db)
        return {
          items: [],
          total: 0,
          limit: input.limit,
          offset: input.offset,
        };
      try {
        const rows = await db
          .select()
          .from(transactions)
          .orderBy(desc(transactions.id))
          .limit(input.limit)
          .offset(input.offset);
        const countArr = await db
          .select({ cnt: count() })
          .from(transactions)
          .limit(1);
        return {
          items: rows,
          total: Number(countArr?.[0]?.cnt ?? 0),
          limit: input.limit,
          offset: input.offset,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    }),

  getCorridors: protectedProcedure.query(async () => {
    return { items: [], total: 0 };
  }),

  getRates: protectedProcedure.query(async () => {
    return { rates: {}, updatedAt: new Date().toISOString() };
  }),

  convert: protectedProcedure
    .input(
      z.object({
        fromCurrency: z.string(),
        toCurrency: z.string(),
        amount: z.number().positive(),
      })
    )
    .mutation(async ({ input }) => {
      return {
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        amount: input.amount,
        convertedAmount: input.amount,
        rate: 1.0,
        fee: 0,
        timestamp: new Date().toISOString(),
      };
    }),

  setSpread: protectedProcedure
    .input(z.object({ corridorId: z.string(), spread: z.number() }))
    .mutation(async () => {
      return { success: true };
    }),

  getStats: protectedProcedure.query(async () => {
    return { totalVolume: 0, totalTransactions: 0, avgRate: 0, corridors: 0 };
  }),
});
