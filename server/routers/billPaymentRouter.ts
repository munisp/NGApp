import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { createChildLogger } from '../lib/logger';
import {
  getBillCategories,
  validateBillDetails,
  processBillPayment,
  getBillPaymentStatus,
  getBillPaymentHistory,
} from '../services/billPaymentService';

const log = createChildLogger('billPaymentRouter');

export const billPaymentRouter = router({
  getCategories: protectedProcedure.query(() => {
    return getBillCategories();
  }),

  validate: protectedProcedure
    .input(z.object({
      providerId: z.string(),
      customerId: z.string(),
      amount: z.number().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      log.info({ provider: input.providerId }, 'Validating bill details');
      return await validateBillDetails({
        providerId: input.providerId,
        fields: { customerId: input.customerId, ...(input.amount ? { amount: String(input.amount) } : {}) },
      });
    }),

  pay: protectedProcedure
    .input(z.object({
      providerId: z.string(),
      customerId: z.string(),
      amount: z.number().positive(),
      phoneNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      log.info({ provider: input.providerId, amount: input.amount, userId: ctx.user.id }, 'Processing bill payment');
      return await processBillPayment({
        remittanceId: `REM-${Date.now()}`,
        providerId: input.providerId,
        categoryId: 'default',
        fields: { customerId: input.customerId, ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}) },
        amount: input.amount,
      });
    }),

  getStatus: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      return await getBillPaymentStatus(input.reference);
    }),

  getHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional().default(20),
      offset: z.number().min(0).optional().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      return await getBillPaymentHistory({
        limit: input?.limit ?? 20,
      });
    }),
});
