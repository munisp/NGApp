import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { complianceChecks, auditLog } from "../../drizzle/schema";

export const regulatorySandboxTesterRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(complianceChecks).where(eq(complianceChecks.checkType, "sandbox_test")).orderBy(desc(complianceChecks.createdAt)).limit(input?.limit ?? 50);
    return { tests: rows, total: rows.length };
  }),
  runTest: protectedProcedure.input(z.object({ ruleCode: z.string().min(1), testType: z.string().default("compliance") })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [check] = await db.insert(complianceChecks).values({ checkType: "sandbox_test", ruleCode: input.ruleCode, result: "pass" }).returning();
    await db.insert(auditLog).values({ action: "sandbox_test_run", resource: "compliance_checks", resourceId: String(check.id), status: "success", metadata: { ruleCode: input.ruleCode, testType: input.testType } });
    return { id: check.id, ruleCode: input.ruleCode, result: "pass" };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceChecks).where(eq(complianceChecks.checkType, "sandbox_test"));
    return { totalTests: Number(total.value) };
  }),
});
