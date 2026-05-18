import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { loadTestRuns, auditLog } from "../../drizzle/schema";

export const loadTestMetricsRouter = router({
  listRuns: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(loadTestRuns).orderBy(desc(loadTestRuns.createdAt)).limit(input?.limit ?? 20);
    return { runs: rows, total: rows.length };
  }),
  getRun: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [run] = await db.select().from(loadTestRuns).where(eq(loadTestRuns.id, input.id)).limit(1);
    return run ?? null;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(loadTestRuns);
    return { totalRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
