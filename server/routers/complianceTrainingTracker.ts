import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
const trainings = [
  { id: "TRN-001", agentId: "AGT-001", agentName: "Adebayo Ogundimu", course: "AML/CFT Annual Refresher", status: "completed", completedAt: "2026-03-15", score: 92, certificate: "CERT-AML-001", expiresAt: "2027-03-15", mandatory: true },
  { id: "TRN-002", agentId: "AGT-002", agentName: "Chioma Eze", course: "AML/CFT Annual Refresher", status: "in_progress", completedAt: null, score: 0, certificate: null, expiresAt: null, mandatory: true },
  { id: "TRN-003", agentId: "AGT-003", agentName: "Ibrahim Musa", course: "Data Protection (NDPR)", status: "completed", completedAt: "2026-02-20", score: 88, certificate: "CERT-NDPR-001", expiresAt: "2027-02-20", mandatory: true },
  { id: "TRN-004", agentId: "AGT-005", agentName: "Ngozi Obi", course: "AML/CFT Annual Refresher", status: "overdue", completedAt: null, score: 0, certificate: null, expiresAt: null, mandatory: true },
  { id: "TRN-005", agentId: "AGT-001", agentName: "Adebayo Ogundimu", course: "Fraud Prevention Workshop", status: "completed", completedAt: "2026-04-01", score: 95, certificate: "CERT-FP-001", expiresAt: "2027-04-01", mandatory: false },
];
export const complianceTrainingTrackerRouter = router({
  getStats: protectedProcedure.query(() => ({ totalTrainings: trainings.length, completed: trainings.filter(t => t.status === "completed").length, inProgress: trainings.filter(t => t.status === "in_progress").length, overdue: trainings.filter(t => t.status === "overdue").length, avgScore: trainings.filter(t => t.score > 0).reduce((s: any, t: any) => s + t.score, 0) / trainings.filter(t => t.score > 0).length, complianceRate: 60, certificatesActive: 3, expiringIn30Days: 0 })),
  listTrainings: protectedProcedure.input(z.object({ status: z.string().optional(), agentId: z.string().optional() })).query(({ input }) => ({ trainings: trainings.filter(t => (!input.status || t.status === input.status) && (!input.agentId || t.agentId === input.agentId)), total: trainings.length })),
  getTraining: protectedProcedure.input(z.object({ trainingId: z.string() })).query(({ input }) => trainings.find(t => t.id === input.trainingId) || null),
  assignTraining: protectedProcedure.input(z.object({ agentId: z.string(), courseId: z.string(), dueDate: z.string() })).mutation(({ input }) => ({ trainingId: "TRN-" + Date.now(), status: "assigned", ...input })),
  recordCompletion: protectedProcedure.input(z.object({ trainingId: z.string(), score: z.number() })).mutation(({ input }) => ({ trainingId: input.trainingId, status: input.score >= 70 ? "completed" : "failed", score: input.score, certificate: input.score >= 70 ? "CERT-" + Date.now() : null })),
});
