import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { loadTestRuns, auditLog } from "../../drizzle/schema";

export const e2eTestFrameworkRouter = router({
  listSuites: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(loadTestRuns).orderBy(desc(loadTestRuns.createdAt)).limit(input?.limit ?? 20);
    return { suites: rows, total: rows.length };
  }),
  runSuite: protectedProcedure.input(z.object({ name: z.string(), environment: z.enum(["staging", "production"]).default("staging"), tags: z.array(z.string()).optional() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [run] = await db.insert(loadTestRuns).values({ name: input.name, status: "running", config: { environment: input.environment, tags: input.tags } }).returning();
    await db.insert(auditLog).values({ action: "e2e_test_started", resource: "load_test_runs", resourceId: String(run.id), status: "success", metadata: { name: input.name, environment: input.environment } });
    return run;
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(loadTestRuns);
    return { totalRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
