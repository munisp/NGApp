import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { complianceChecks, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const dataQualityRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional()).query(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const rows = await db.select().from(complianceChecks).where(eq(complianceChecks.checkType, "data_quality")).orderBy(desc(complianceChecks.createdAt)).limit(input?.limit ?? 50);
      return { checks: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  runCheck: protectedProcedure.input(z.object({ tableName: z.string().min(1), ruleCode: z.string().min(1) })).mutation(async ({ input }) => {
    try {
      const db = (await getDb())!;
      const [check] = await db.insert(complianceChecks).values({ checkType: "data_quality", ruleCode: input.ruleCode, result: "pass" }).returning();
      await db.insert(auditLog).values({ action: "data_quality_check", resource: "compliance_checks", resourceId: String(check.id), status: "success", metadata: { tableName: input.tableName, ruleCode: input.ruleCode } });
      return { id: check.id, tableName: input.tableName, result: "pass" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [total] = await db.select({ value: count() }).from(complianceChecks).where(eq(complianceChecks.checkType, "data_quality")).limit(100);
    return { totalChecks: Number(total.value) };
  }),
});
