import { protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { getMobileMoneyProviders, sendMobileMoneyTransfer, getMobileMoneyTransferStatus, getMobileMoneyHistory } from '../services/mobileMoneyService';

export const mobileMoneyRouter = router({
  providers: protectedProcedure
    .query(async () => {
      return getMobileMoneyProviders();
    }),

  transfer: protectedProcedure
    .input(z.object({
      providerId: z.string(),
      recipientPhone: z.string(),
      amount: z.number().positive(),
      narration: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return sendMobileMoneyTransfer({
        remittanceId: `mm_${Date.now()}`,
        provider: input.providerId,
        recipientPhone: input.recipientPhone,
        amount: input.amount,
        narration: input.narration,
      });
    }),

  status: protectedProcedure
    .input(z.object({
      reference: z.string(),
    }))
    .query(async ({ input }) => {
      return getMobileMoneyTransferStatus(input.reference);
    }),

  history: protectedProcedure
    .input(z.object({
      limit: z.number().int().positive().max(100).optional(),
      provider: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getMobileMoneyHistory({
        provider: input.provider,
        limit: input.limit,
      });
    }),
});
