import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, ilike } from "drizzle-orm";
import { agents, customers, transactions, merchants } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const advancedSearchFilteringRouter = router({
  searchAgents: protectedProcedure.input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(agents).where(ilike(agents.name, `%${input.query}%`)).orderBy(desc(agents.createdAt)).limit(input.limit);
      return { results: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  searchCustomers: protectedProcedure.input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(customers).where(ilike(customers.firstName, `%${input.query}%`)).orderBy(desc(customers.createdAt)).limit(input.limit);
      return { results: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  searchMerchants: protectedProcedure.input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(merchants).where(ilike(merchants.businessName, `%${input.query}%`)).limit(input.limit);
      return { results: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
