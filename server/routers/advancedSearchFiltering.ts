import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and, ilike } from "drizzle-orm";
import { agents, customers, transactions, merchants } from "../../drizzle/schema";

export const advancedSearchFilteringRouter = router({
  searchAgents: protectedProcedure.input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(agents).where(ilike(agents.name, `%${input.query}%`)).orderBy(desc(agents.createdAt)).limit(input.limit);
    return { results: rows, total: rows.length };
  }),
  searchCustomers: protectedProcedure.input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(customers).where(ilike(customers.firstName, `%${input.query}%`)).orderBy(desc(customers.createdAt)).limit(input.limit);
    return { results: rows, total: rows.length };
  }),
  searchMerchants: protectedProcedure.input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(merchants).where(ilike(merchants.businessName, `%${input.query}%`)).limit(input.limit);
    return { results: rows, total: rows.length };
  }),
});
