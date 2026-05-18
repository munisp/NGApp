import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count } from "drizzle-orm";
import { loadTestRuns, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const e2eTestFrameworkRouter = router({
  listSuites: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(loadTestRuns).orderBy(desc(loadTestRuns.createdAt)).limit(input?.limit ?? 20);
      return { suites: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  runSuite: protectedProcedure.input(z.object({ name: z.string(), environment: z.enum(["staging", "production"]).default("staging"), tags: z.array(z.string()).optional() })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [run] = await db.insert(loadTestRuns).values({ name: input.name, status: "running", config: { environment: input.environment, tags: input.tags } }).returning();
      await db.insert(auditLog).values({ action: "e2e_test_started", resource: "load_test_runs", resourceId: String(run.id), status: "success", metadata: { name: input.name, environment: input.environment } });
      return run;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(loadTestRuns).limit(100);
    return { totalRuns: Number(total.value), lastUpdated: new Date().toISOString() };
  }),
});
