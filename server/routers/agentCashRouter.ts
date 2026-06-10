import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { createChildLogger } from '../lib/logger';
import {
  findNearbyAgents,
  generateCollectionCode,
  getCollectionCodeStatus,
  cancelCollectionCode,
  getAgentDetails,
  calculateAgentFee,
} from '../services/agentCashService';

const log = createChildLogger('agentCashRouter');

export const agentCashRouter = router({
  findAgents: protectedProcedure
    .input(z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().min(0.5).max(50).optional().default(5),
      provider: z.enum(['paga', 'opay', 'kudi', 'all']).optional().default('all'),
    }))
    .query(async ({ input }) => {
      return await findNearbyAgents({
        latitude: input.latitude,
        longitude: input.longitude,
        radius: input.radiusKm,
        provider: input.provider === 'all' ? undefined : input.provider,
      });
    }),

  generateCode: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      provider: z.enum(['paga', 'opay', 'kudi']),
      recipientPhone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      log.info({ amount: input.amount, provider: input.provider, userId: ctx.user.id }, 'Collection code generated');
      return await generateCollectionCode({
        remittanceId: `REM-${Date.now()}`,
        amount: input.amount,
        currency: 'NGN',
        provider: input.provider,
        recipientPhone: input.recipientPhone || '',
      });
    }),

  getCodeStatus: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      return await getCollectionCodeStatus(input.code);
    }),

  cancelCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      log.info({ code: input.code, userId: ctx.user.id }, 'Collection code cancelled');
      return await cancelCollectionCode(input.code);
    }),

  getAgentDetails: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return await getAgentDetails(input.agentId);
    }),

  calculateFee: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      provider: z.enum(['paga', 'opay', 'kudi']),
    }))
    .query(({ input }) => {
      return { fee: calculateAgentFee(input.amount, input.provider) };
    }),
});
