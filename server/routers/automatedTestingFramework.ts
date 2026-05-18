import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { loadTestRuns, auditLog } from "../../drizzle/schema";

export const automatedTestingFrameworkRouter = router({
  listTestRuns: protectedProcedure.input(z.object({ limit: z.number().default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(loadTestRuns).orderBy(desc(loadTestRuns.createdAt)).limit(input?.limit ?? 50);
    return { testRuns: rows, total: rows.length };
  }),
  getTestRun: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [run] = await db.select().from(loadTestRuns).where(eq(loadTestRuns.id, input.id)).limit(1);
    return run ?? null;
  }),
  createTestRun: protectedProcedure.input(z.object({ name: z.string(), testType: z.string(), config: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [run] = await db.insert(loadTestRuns).values({ name: input.name, status: "running", config: input.config ?? {} }).returning();
    await db.insert(auditLog).values({ action: "test_run_started", resource: "load_test_runs", resourceId: String(run.id), status: "success", metadata: { name: input.name, testType: input.testType } });
    return run;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(loadTestRuns);
    return { totalTestRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
