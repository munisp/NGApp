import { protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { findNearbyAgents, getCollectionStatus, cancelCollection, getAgentNetworkStats } from '../services/agentCashService';

export const agentCashRouter = router({
  findAgents: protectedProcedure
    .input(z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radius: z.number().positive().optional(),
      provider: z.enum(['paga', 'opay', 'kudi', 'all']).optional(),
      limit: z.number().int().positive().max(100).optional(),
    }))
    .query(async ({ input }) => {
      return findNearbyAgents(input);
    }),

  checkStatus: protectedProcedure
    .input(z.object({
      collectionCode: z.string(),
    }))
    .query(async ({ input }) => {
      return getCollectionStatus(input.collectionCode);
    }),

  cancel: protectedProcedure
    .input(z.object({
      collectionCode: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return cancelCollection(input.collectionCode, ctx.user.id, input.reason);
    }),

  networkStats: protectedProcedure
    .query(async () => {
      return getAgentNetworkStats();
    }),
});
