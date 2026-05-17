// @ts-ignore
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

interface DisbursementItem {
  recipientId: string;
  recipientName: string;
  amount: number;
  channel: string;
  accountNumber: string;
}

interface BatchResult {
  batchId: string;
  totalAmount: number;
  totalRecipients: number;
  status: "pending" | "processing" | "completed" | "partial_failure";
  successCount: number;
  failureCount: number;
  createdAt: string;
}

function validateDisbursementBatch(items: DisbursementItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (items.length === 0) errors.push("Batch cannot be empty");
  if (items.length > 10000) errors.push("Batch exceeds maximum 10,000 recipients");
  const totalAmount = items.reduce((sum: any, i: any) => sum + i.amount, 0);
  if (totalAmount > 50000000) errors.push("Batch total exceeds KES 50M limit");
  for (const item of items) {
    if (item.amount <= 0) errors.push(`Invalid amount for \${item.recipientId}`);
    if (!item.accountNumber) errors.push(`Missing account for \${item.recipientId}`);
  }
  return { valid: errors.length === 0, errors };
}

function calculateDisbursementFees(items: DisbursementItem[]): { totalFees: number; perItemFee: number } {
  const baseFee = 15;
  const volumeDiscount = items.length > 100 ? 0.8 : items.length > 50 ? 0.9 : 1.0;
  const perItemFee = Math.round(baseFee * volumeDiscount);
  return { totalFees: perItemFee * items.length, perItemFee };
}

export const bulkDisbursementEngineRouter = router({
  createBatch: protectedProcedure
    .input(z.object({
      name: z.string(),
      items: z.array(z.object({
        recipientId: z.string(),
        recipientName: z.string(),
        amount: z.number().positive(),
        channel: z.enum(["mpesa", "bank", "airtel"]),
        accountNumber: z.string(),
      })),
      scheduledAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const validation = validateDisbursementBatch(input.items);
      if (!validation.valid) return { success: false, errors: validation.errors };
      const fees = calculateDisbursementFees(input.items);
      const batchId = `BATCH-\${Date.now()}`;
      const totalAmount = input.items.reduce((sum: any, i: any) => sum + i.amount, 0);
      return {
        success: true,
        batchId,
        totalAmount,
        totalRecipients: input.items.length,
        totalFees: fees.totalFees,
        perItemFee: fees.perItemFee,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
    }),

  getBatchStatus: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input }) => {
      return { batchId: input.batchId, status: "processing", progress: 75, successCount: 0, failureCount: 0 };
    }),

  listBatches: protectedProcedure
    .input(z.object({ limit: z.number().default(20), status: z.string().optional() }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const rows = await db.select().from(transactions).limit(input.limit).orderBy(desc(transactions.createdAt));
      return { batches: rows.map(r => ({ id: r.id, status: "completed", createdAt: r.createdAt })), total: rows.length };
    }),

  validateBatch: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        recipientId: z.string(),
        recipientName: z.string(),
        amount: z.number(),
        channel: z.string(),
        accountNumber: z.string(),
      })),
    }))
    .query(async ({ input }) => {
      const validation = validateDisbursementBatch(input.items as DisbursementItem[]);
      const fees = calculateDisbursementFees(input.items as DisbursementItem[]);
      return { ...validation, fees };
    }),
  getStats: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return {} as any;
    }),
});
