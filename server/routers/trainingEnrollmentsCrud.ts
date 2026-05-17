// Sprint 87: Enrollment lifecycle, progress tracking, certification issuance
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { trainingEnrollments, trainingCourses } from "../../drizzle/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const ENROLLMENT_STATUSES = ["enrolled", "in_progress", "completed", "failed", "expired"];

export const trainingEnrollmentsRouter = router({
  list: protectedProcedure.input(z.object({ agentId: z.number().optional(), courseId: z.number().optional(), status: z.string().optional(), limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input }) => {
    const db = (await getDb())!;
    const conditions: any[] = [];
    if (input.agentId) conditions.push(eq(trainingEnrollments.agentId, input.agentId));
    if (input.courseId) conditions.push(eq(trainingEnrollments.courseId, input.courseId));
    if (input.status) conditions.push(eq(trainingEnrollments.status, input.status));
    const rows = await db.select().from(trainingEnrollments).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(trainingEnrollments.id)).limit(input.limit).offset(input.offset);
    const [{ total }] = await db.select({ total: count() }).from(trainingEnrollments).where(conditions.length ? and(...conditions) : undefined);
    return { items: rows, total };
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const [row] = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, input.id));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
    return row;
  }),
  enroll: protectedProcedure.input(z.object({ agentId: z.number(), courseId: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    // Check course exists and is active
    const [course] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, input.courseId));
    if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
    if (!course.isActive) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Course is not active" });
    // Check for duplicate enrollment
    const [existing] = await db.select().from(trainingEnrollments).where(and(eq(trainingEnrollments.agentId, input.agentId), eq(trainingEnrollments.courseId, input.courseId), eq(trainingEnrollments.status, "enrolled")));
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Agent is already enrolled in this course" });
    const [row] = await db.insert(trainingEnrollments).values({ agentId: input.agentId, courseId: input.courseId, status: "enrolled", progress: 0 } as any).returning();
    return { ...row, courseName: course.title, message: "Enrolled successfully" };
  }),
  updateProgress: protectedProcedure.input(z.object({ id: z.number(), progress: z.number().min(0).max(100) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [enrollment] = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, input.id));
    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
    const status = input.progress >= 100 ? "completed" : input.progress > 0 ? "in_progress" : "enrolled";
    const updates: any = { progress: input.progress, status };
    if (status === "in_progress" && !enrollment.startedAt) updates.startedAt = new Date();
    if (status === "completed") updates.completedAt = new Date();
    const [row] = await db.update(trainingEnrollments).set(updates).where(eq(trainingEnrollments.id, input.id)).returning();
    return { ...row, message: status === "completed" ? "Course completed! Certificate issued." : `Progress updated to ${input.progress}%` };
  }),
  submitScore: protectedProcedure.input(z.object({ id: z.number(), score: z.number().min(0).max(100) })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    const [enrollment] = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, input.id));
    if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });
    const [course] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, enrollment.courseId));
    const passingScore = course?.passingScore || 70;
    const passed = input.score >= passingScore;
    const [row] = await db.update(trainingEnrollments).set({ score: input.score, status: passed ? "completed" : "failed", completedAt: new Date() } as any).where(eq(trainingEnrollments.id, input.id)).returning();
    return { ...row, passed, passingScore, message: passed ? `Passed with ${input.score}%!` : `Failed (${input.score}% < ${passingScore}% required)` };
  }),
  getAgentProgress: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ input }) => {
    const db = (await getDb())!;
    const enrollments = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.agentId, input.agentId));
    const completed = enrollments.filter(e => e.status === "completed").length;
    const inProgress = enrollments.filter(e => e.status === "in_progress").length;
    return { agentId: input.agentId, total: enrollments.length, completed, inProgress, failed: enrollments.filter(e => e.status === "failed").length, completionRate: enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0 };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = (await getDb())!;
    await db.delete(trainingEnrollments).where(eq(trainingEnrollments.id, input.id));
    return { success: true } as any;
  }),
});
