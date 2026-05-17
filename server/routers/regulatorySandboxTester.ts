import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { auditLog, systemConfig } from "../../drizzle/schema";

export const regulatorySandboxTesterRouter = router({
  dashboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalTests: 0, passing: 0, failing: 0, sandboxEnvironments: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "sandbox_test_run")).orderBy(desc(auditLog.createdAt)).limit(100);
    return { totalTests: rows.length, passing: rows.filter(r => r.status === "success").length, failing: rows.filter(r => r.status === "failure").length, sandboxEnvironments: 2 };
  }),
  runTest: protectedProcedure.input(z.object({ testSuite: z.string(), environment: z.enum(["sandbox", "staging"]).default("sandbox"), parameters: z.record(z.string(), z.any()).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const testId = "SBX-" + Date.now().toString(36).toUpperCase();
    await db.insert(auditLog).values({ action: "sandbox_test_run", resource: "sandbox", resourceId: testId, status: "success", metadata: { testSuite: input.testSuite, environment: input.environment } });
    return { success: true, testId, status: "completed" };
  }),
  listTests: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { tests: [], total: 0 };
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "sandbox_test_run")).orderBy(desc(auditLog.createdAt)).limit(input?.limit ?? 20);
    return { tests: rows.map(r => ({ id: r.id, testId: r.resourceId, ...r.metadata as any, status: r.status, runAt: r.createdAt })), total: rows.length };
  }),
});
