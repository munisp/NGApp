import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const batchJobs = [
  { id: "BATCH-001", name: "Salary Disbursement - April", type: "bulk_transfer", totalRecords: 1250, processed: 1250, failed: 3, status: "completed", createdAt: "2026-04-20T10:00:00Z", completedAt: "2026-04-20T10:15:30Z", totalAmount: 125000000, currency: "NGN" },
  { id: "BATCH-002", name: "Agent Commission Payout", type: "commission_payout", totalRecords: 450, processed: 320, failed: 0, status: "processing", createdAt: "2026-04-21T08:00:00Z", completedAt: "", totalAmount: 45000000, currency: "NGN" },
  { id: "BATCH-003", name: "Vendor Payments Q1", type: "vendor_payment", totalRecords: 89, processed: 0, failed: 0, status: "queued", createdAt: "2026-04-21T09:00:00Z", completedAt: "", totalAmount: 23456789, currency: "NGN" },
];

export const bulkTransactionProcessingRouter = router({
  getStats: protectedProcedure.query(() => ({ totalBatches: batchJobs.length, processedToday: 1570, failureRate: "0.24%", avgProcessingTime: "12min" })),
  listBatches: protectedProcedure.input(z.object({ status: z.string().optional(), type: z.string().optional() }).optional()).query(({ input }) => { let jobs = [...batchJobs]; if (input?.status) jobs = jobs.filter(j => j.status === input.status); return { batches: jobs, total: jobs.length }; }),
  getBatch: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) => batchJobs.find(b => b.id === input.id) || null),
  createBatch: protectedProcedure.input(z.object({ name: z.string(), type: z.enum(["bulk_transfer", "commission_payout", "vendor_payment", "refund_batch"]), records: z.array(z.object({ recipientId: z.string(), amount: z.number(), reference: z.string().optional() })) })).mutation(({ input }) => ({ batchId: `BATCH-${Date.now()}`, name: input.name, totalRecords: input.records.length, totalAmount: input.records.reduce((s: any, r: any) => s + r.amount, 0), status: "queued", estimatedTime: `${Math.ceil(input.records.length / 100)}min` })),
  retryFailed: protectedProcedure.input(z.object({ batchId: z.string() })).mutation(({ input }) => ({ success: true, batchId: input.batchId, retriedCount: 3 })),
  getValidationRules: protectedProcedure.query(() => ({ maxRecords: 10000, maxAmount: 500000000, requiredFields: ["recipientId", "amount"], supportedTypes: ["bulk_transfer", "commission_payout", "vendor_payment", "refund_batch"] })),
});
