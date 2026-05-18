import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and, sql, count, avg } from "drizzle-orm";
import { trainingCourses, trainingEnrollments, agents, auditLog } from "../../drizzle/schema";

export const agentTrainingRouter = router({
  listCourses: protectedProcedure.input(z.object({ limit: z.number().default(50), status: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = (await getDb())!;
    const rows = await db.select().from(trainingCourses).orderBy(desc(trainingCourses.createdAt)).limit(input?.limit ?? 50);
    return { courses: rows, total: rows.length };
  }),
  getCourse: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [course] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, input.id)).limit(1);
    if (!course) return null;
    const [enrollCount] = await db.select({ value: count() }).from(trainingEnrollments).where(eq(trainingEnrollments.courseId, input.id));
    return { ...course, enrollmentCount: Number(enrollCount.value) };
  }),
  listEnrollments: protectedProcedure.input(z.object({ agentId: z.number().optional(), courseId: z.number().optional(), limit: z.number().default(50) })).query(async ({ input }) => {
    const db = (await getDb())!;
    let query = db.select().from(trainingEnrollments).orderBy(desc(trainingEnrollments.createdAt)).limit(input.limit);
    const rows = await query;
    return { enrollments: rows, total: rows.length };
  }),
  enroll: protectedProcedure.input(z.object({ agentId: z.number(), courseId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [enrollment] = await db.insert(trainingEnrollments).values({ agentId: input.agentId, courseId: input.courseId, status: "enrolled", progress: 0 }).returning();
    await db.insert(auditLog).values({ action: "training_enrollment", resource: "training_enrollments", resourceId: String(enrollment.id), status: "success", metadata: { agentId: input.agentId, courseId: input.courseId } });
    return enrollment;
  }),
  updateProgress: protectedProcedure.input(z.object({ enrollmentId: z.number(), progress: z.number().min(0).max(100) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const status = input.progress >= 100 ? "completed" : "in_progress";
    await db.update(trainingEnrollments).set({ progress: input.progress, status }).where(eq(trainingEnrollments.id, input.enrollmentId));
    await db.insert(auditLog).values({ action: "training_progress_update", resource: "training_enrollments", resourceId: String(input.enrollmentId), status: "success", metadata: { progress: input.progress } });
    return { success: true, progress: input.progress, status };
  }),
  getStats: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const [totalCourses] = await db.select({ value: count() }).from(trainingCourses);
    const [totalEnrollments] = await db.select({ value: count() }).from(trainingEnrollments);
    const [completed] = await db.select({ value: count() }).from(trainingEnrollments).where(eq(trainingEnrollments.status, "completed"));
    return { totalCourses: Number(totalCourses.value), totalEnrollments: Number(totalEnrollments.value), completedEnrollments: Number(completed.value), completionRate: Number(totalEnrollments.value) > 0 ? Math.round(Number(completed.value) / Number(totalEnrollments.value) * 100) : 0 };
  }),
});
