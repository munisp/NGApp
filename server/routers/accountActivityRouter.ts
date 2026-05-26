/**
 * Account Activity tRPC Router
 * 
 * Provides API endpoints for login history and session management
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import * as accountActivityService from '../services/accountActivityService';

export const accountActivityRouter = router({
  /**
   * Get login history for current user
   */
  getLoginHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
        successOnly: z.boolean().optional(),
        since: z.date().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const history = await accountActivityService.getLoginHistory({
        userId: ctx.user.id,
        limit: input?.limit,
        offset: input?.offset,
        successOnly: input?.successOnly,
        since: input?.since,
      });

      // Convert string enums to booleans for frontend
      return history.map(record => ({
        ...record,
        success: record.success === 'true',
        isTrustedDevice: record.isTrustedDevice === 'true',
        isSuspicious: record.isSuspicious === 'true',
        requiresTwoFactor: record.requiresTwoFactor === 'true',
        twoFactorCompleted: record.twoFactorCompleted === 'true',
        sessionActive: record.sessionActive === 'true',
      }));
    }),

  /**
   * Get active sessions for current user
   */
  getActiveSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await accountActivityService.getActiveSessions(ctx.user.id);

    return sessions.map(session => ({
      ...session,
      success: session.success === 'true',
      isTrustedDevice: session.isTrustedDevice === 'true',
      isSuspicious: session.isSuspicious === 'true',
      requiresTwoFactor: session.requiresTwoFactor === 'true',
      twoFactorCompleted: session.twoFactorCompleted === 'true',
      sessionActive: session.sessionActive === 'true',
    }));
  }),

  /**
   * End a specific session
   */
  endSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await accountActivityService.endSession({
        userId: ctx.user.id,
        sessionId: input.sessionId,
      });

      return result;
    }),

  /**
   * End all sessions except current
   */
  endAllSessions: protectedProcedure
    .input(
      z.object({
        exceptSessionId: z.string().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const result = await accountActivityService.endAllSessions({
        userId: ctx.user.id,
        exceptSessionId: input?.exceptSessionId,
      });

      return result;
    }),
});
