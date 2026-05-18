import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, sum, isNull, gte, lte, or, asc } from "drizzle-orm";
import { trainingCourses, trainingEnrollments, auditLog } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

export const complianceTrainingTrackerRouter = router({
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalModules: 0, completedModules: 0, overdueModules: 0, complianceRate: 0 };
    const [courseCount] = await db.select({ value: count() }).from(trainingCourses).limit(100);
    const [enrollCount] = await db.select({ value: count() }).from(trainingEnrollments).limit(100);
    const [completedCount] = await db.select({ value: count() }).from(trainingEnrollments).where(eq(trainingEnrollments.status, "completed")).limit(100);
    const total = Number(enrollCount.value);
    const completed = Number(completedCount.value);
    return { totalModules: Number(courseCount.value), completedModules: completed, overdueModules: 0, complianceRate: total > 0 ? Math.round(completed / total * 100) : 100 };
  }),
  listModules: protectedProcedure.input(z.object({ status: z.string().optional(), limit: z.number().default(20) }).optional()).query(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) return { modules: [], total: 0 };
      const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.createdAt)).limit(input?.limit ?? 20);
      return { modules: rows, total: rows.length };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
  trackCompletion: protectedProcedure.input(z.object({ agentId: z.number(), courseId: z.number(), score: z.number() })).mutation(async ({ input }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.insert(auditLog).values({ action: "compliance_training_completed", resource: "training", resourceId: String(input.courseId), status: "success", metadata: { agentId: input.agentId, score: input.score } });
      return { success: true, passed: input.score >= 70 };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Internal server error" });
    }
  }),
});
