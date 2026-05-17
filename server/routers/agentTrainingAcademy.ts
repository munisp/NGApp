import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const courses = [
  { id: "CRS-001", title: "POS Operations Fundamentals", category: "operations", duration: "2 hours", modules: 8, enrolled: 850, completed: 720, passRate: 92, mandatory: true, certification: "POS-CERT-L1" },
  { id: "CRS-002", title: "AML/CFT Compliance", category: "compliance", duration: "3 hours", modules: 12, enrolled: 1200, completed: 1100, passRate: 88, mandatory: true, certification: "AML-CERT" },
  { id: "CRS-003", title: "Fraud Detection & Prevention", category: "security", duration: "1.5 hours", modules: 6, enrolled: 650, completed: 580, passRate: 95, mandatory: true, certification: "FRAUD-CERT" },
  { id: "CRS-004", title: "Customer Service Excellence", category: "soft_skills", duration: "1 hour", modules: 4, enrolled: 450, completed: 380, passRate: 97, mandatory: false, certification: "CS-CERT" },
  { id: "CRS-005", title: "Advanced Float Management", category: "finance", duration: "2.5 hours", modules: 10, enrolled: 320, completed: 250, passRate: 85, mandatory: false, certification: "FLOAT-CERT" },
];
export const agentTrainingAcademyRouter = router({
  getStats: protectedProcedure.query(() => ({ totalCourses: courses.length, totalEnrolled: courses.reduce((s: any, c: any) => s + c.enrolled, 0), totalCompleted: courses.reduce((s: any, c: any) => s + c.completed, 0), avgPassRate: courses.reduce((s: any, c: any) => s + c.passRate, 0) / courses.length, mandatoryCourses: courses.filter(c => c.mandatory).length, certificationsIssued: 2650, complianceTrainingRate: 91.7, avgCompletionTime: "2.1 hours" })),
  listCourses: protectedProcedure.query(() => ({ courses, total: courses.length })),
  getCourse: protectedProcedure.input(z.object({ courseId: z.string() })).query(({ input }) => courses.find(c => c.id === input.courseId) || null),
  enrollAgent: protectedProcedure.input(z.object({ agentId: z.string(), courseId: z.string() })).mutation(({ input }) => ({ enrollmentId: "ENR-" + Date.now(), status: "enrolled", ...input, startDate: new Date().toISOString() })),
  issueCertificate: protectedProcedure.input(z.object({ agentId: z.string(), courseId: z.string(), score: z.number() })).mutation(({ input }) => ({ certificateId: "CERT-" + Date.now(), ...input, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 365 * 86400000).toISOString() })),
});
