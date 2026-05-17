import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const approvalQueue = [
  { id: "APR-001", applicationId: "WL-002", type: "document_review", priority: "high", assignedTo: "reviewer@54link.com", status: "pending", createdAt: "2026-04-10T08:00:00Z", slaDeadline: "2026-04-15T23:59:59Z", escalationLevel: 0, notes: [], checklist: [{ item: "Verify CAC registration", done: false }, { item: "Validate tax clearance", done: false }, { item: "Check director credentials", done: true }] },
  { id: "APR-002", applicationId: "WL-001", type: "branding_review", priority: "medium", assignedTo: "design@54link.com", status: "in_review", createdAt: "2026-04-01T09:00:00Z", slaDeadline: "2026-04-20T23:59:59Z", escalationLevel: 0, notes: [{ by: "design@54link.com", text: "Logo needs higher resolution", at: "2026-04-05T10:00:00Z" }], checklist: [{ item: "Logo quality check", done: false }, { item: "Color accessibility", done: true }, { item: "Brand guidelines compliance", done: true }] },
];

const slaConfig = { document_review: { hours: 120, escalateAfter: 96 }, compliance_check: { hours: 168, escalateAfter: 120 }, branding_review: { hours: 120, escalateAfter: 96 }, technical_review: { hours: 240, escalateAfter: 168 } };

export const whiteLabelApprovalRouter = router({
  getStats: protectedProcedure.query(() => ({ pendingApprovals: approvalQueue.filter(a => a.status === "pending").length, inReview: approvalQueue.filter(a => a.status === "in_review").length, avgApprovalTime: "3.2 days", slaBreaches: 0, escalations: 0 })),
  listQueue: protectedProcedure.input(z.object({ status: z.string().optional(), priority: z.string().optional(), assignedTo: z.string().optional() }).optional()).query(({ input }) => { let q = [...approvalQueue]; if (input?.status) q = q.filter(a => a.status === input.status); if (input?.priority) q = q.filter(a => a.priority === input.priority); return { queue: q, total: q.length }; }),
  getApproval: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) => approvalQueue.find(a => a.id === input.id) || null),
  approveItem: protectedProcedure.input(z.object({ approvalId: z.string(), notes: z.string().optional() })).mutation(({ input }) => ({ success: true, approvalId: input.approvalId, action: "approved", at: new Date().toISOString() })),
  rejectItem: protectedProcedure.input(z.object({ approvalId: z.string(), reason: z.string() })).mutation(({ input }) => ({ success: true, approvalId: input.approvalId, action: "rejected", reason: input.reason, at: new Date().toISOString() })),
  escalate: protectedProcedure.input(z.object({ approvalId: z.string(), escalateTo: z.string() })).mutation(({ input }) => ({ success: true, approvalId: input.approvalId, escalatedTo: input.escalateTo, at: new Date().toISOString() })),
  getSlaConfig: protectedProcedure.query(() => slaConfig),
});
