import { protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { getBillCategories, validateBillDetails, processBillPayment, getBillPaymentHistory, getBillPaymentStatus } from '../services/billPaymentService';

export const billPaymentRouter = router({
  categories: protectedProcedure
    .query(async () => {
      return getBillCategories();
    }),

  validate: protectedProcedure
    .input(z.object({
      providerId: z.string(),
      accountNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      return validateBillDetails({
        providerId: input.providerId,
        fields: { accountNumber: input.accountNumber },
      });
    }),

  pay: protectedProcedure
    .input(z.object({
      providerId: z.string(),
      accountNumber: z.string(),
      amount: z.number().positive(),
      categoryId: z.string().default('utility'),
    }))
    .mutation(async ({ input }) => {
      return processBillPayment({
        remittanceId: `bill_${Date.now()}`,
        providerId: input.providerId,
        categoryId: input.categoryId,
        fields: { accountNumber: input.accountNumber },
        amount: input.amount,
      });
    }),

  history: protectedProcedure
    .input(z.object({
      limit: z.number().int().positive().max(100).optional(),
      providerId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getBillPaymentHistory({
        providerId: input.providerId,
        limit: input.limit,
      });
    }),

  status: protectedProcedure
    .input(z.object({
      reference: z.string(),
    }))
    .query(async ({ input }) => {
      return getBillPaymentStatus(input.reference);
    }),
});
