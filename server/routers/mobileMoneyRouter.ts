import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { createChildLogger } from '../lib/logger';
import {
  getMobileMoneyProviders,
  detectProviderFromPhone,
  validateMobileMoneyAccount,
  sendMobileMoneyTransfer,
  getMobileMoneyTransferStatus,
  checkMobileMoneyBalance,
  getMobileMoneyHistory,
} from '../services/mobileMoneyService';

const log = createChildLogger('mobileMoney');

export const mobileMoneyRouter = router({
  getProviders: protectedProcedure.query(() => {
    return getMobileMoneyProviders();
  }),

  detectProvider: protectedProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .query(({ input }) => {
      const provider = detectProviderFromPhone(input.phoneNumber);
      return { provider };
    }),

  validateAccount: protectedProcedure
    .input(z.object({
      provider: z.string(),
      phoneNumber: z.string(),
    }))
    .query(async ({ input }) => {
      return await validateMobileMoneyAccount({
        provider: input.provider,
        phoneNumber: input.phoneNumber,
      });
    }),

  transfer: protectedProcedure
    .input(z.object({
      provider: z.string(),
      recipientPhone: z.string(),
      amount: z.number().positive(),
      narration: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      log.info({ provider: input.provider, amount: input.amount, userId: ctx.user.id }, 'Mobile money transfer initiated');
      return await sendMobileMoneyTransfer({
        remittanceId: `REM-${Date.now()}`,
        provider: input.provider,
        recipientPhone: input.recipientPhone,
        amount: input.amount,
        narration: input.narration,
      });
    }),

  getTransferStatus: protectedProcedure
    .input(z.object({ reference: z.string() }))
    .query(async ({ input }) => {
      return await getMobileMoneyTransferStatus(input.reference);
    }),

  checkBalance: protectedProcedure
    .input(z.object({
      provider: z.string(),
      phoneNumber: z.string(),
    }))
    .query(async ({ input }) => {
      return await checkMobileMoneyBalance({
        provider: input.provider,
        phoneNumber: input.phoneNumber,
      });
    }),

  getHistory: protectedProcedure
    .input(z.object({
      provider: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(20),
    }).optional())
    .query(async ({ input }) => {
      return await getMobileMoneyHistory({
        provider: input?.provider,
        limit: input?.limit ?? 20,
      });
    }),
});
