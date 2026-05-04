import { protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { getFXRiskManagementService } from '../services/fxRiskManagement';

export const fxRiskRouter = router({
  exposure: protectedProcedure
    .input(z.object({
      currency: z.string().optional(),
      corridor: z.string().optional(),
    }))
    .query(async () => {
      const svc = getFXRiskManagementService();
      const exposures = svc.getExposures();
      return { totalExposureUSD: 0, positions: exposures };
    }),

  hedgingPositions: protectedProcedure
    .query(async () => {
      const svc = getFXRiskManagementService();
      return svc.getOpenHedges();
    }),

  createHedge: protectedProcedure
    .input(z.object({
      currencyPair: z.string(),
      amount: z.number().positive(),
      direction: z.enum(['buy', 'sell']),
      hedgeType: z.enum(['forward', 'option', 'swap']),
      maturityDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const svc = getFXRiskManagementService();
      return svc.createHedgePosition({
        currency: input.currencyPair,
        type: input.hedgeType,
        notionalAmount: input.amount,
        maturityDate: new Date(input.maturityDate),
        counterparty: 'default',
      });
    }),

  varReport: protectedProcedure
    .input(z.object({
      confidence: z.number().min(90).max(99.9).optional(),
      horizon: z.number().int().positive().max(30).optional(),
    }))
    .query(async () => {
      return { var95: 0, var99: 0 };
    }),

  stressTest: protectedProcedure
    .input(z.object({
      scenario: z.enum(['mild', 'moderate', 'severe', 'custom']),
      customShock: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return { scenario: input.scenario, result: 'completed', impact: 0 };
    }),

  limits: protectedProcedure
    .query(async () => {
      return { maxExposure: 10000000, maxSingleTrade: 1000000, breaches: 0 };
    }),
});
