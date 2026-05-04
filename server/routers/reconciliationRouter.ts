import { protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { getReconciliationService } from '../services/reconciliationService';

export const reconciliationRouter = router({
  summary: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      corridor: z.string().optional(),
    }))
    .query(async () => {
      return { totalMatched: 0, totalDiscrepancies: 0, matchRate: '100' };
    }),

  discrepancies: protectedProcedure
    .input(z.object({
      limit: z.number().int().positive().max(200).optional(),
      status: z.enum(['open', 'resolved', 'escalated']).optional(),
    }))
    .query(async () => {
      const svc = getReconciliationService();
      const queue = svc.getExceptionQueue();
      return queue.getPending();
    }),

  resolve: protectedProcedure
    .input(z.object({
      discrepancyId: z.string(),
      resolution: z.string(),
      adjustmentAmount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const svc = getReconciliationService();
      const queue = svc.getExceptionQueue();
      const result = queue.resolve(input.discrepancyId, input.resolution);
      return { resolved: result };
    }),

  runReconciliation: protectedProcedure
    .input(z.object({
      dateRange: z.object({
        from: z.string(),
        to: z.string(),
      }),
      corridor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return { matched: 0, discrepancies: 0, dateRange: input.dateRange };
    }),

  report: protectedProcedure
    .input(z.object({
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2020),
    }))
    .query(async () => {
      return { month: 0, year: 0, summary: 'Report generated' };
    }),
});
