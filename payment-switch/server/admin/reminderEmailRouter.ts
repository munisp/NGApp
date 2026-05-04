import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import {
  getAllReminderConfigs,
  getReminderConfigForStage,
  updateReminderConfig,
  getStuckParticipants,
  sendReminderEmail,
  getReminderLog,
  processAutomatedReminders,
} from './reminderEmailService';

/**
 * Admin-only procedure
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({ ctx });
});

const stageEnum = z.enum(['registration', 'technical', 'integration', 'testing', 'production']);

export const reminderEmailRouter = router({
  /**
   * Get all reminder configurations
   */
  getAllConfigs: adminProcedure.query(async () => {
    return await getAllReminderConfigs();
  }),

  /**
   * Get reminder configuration for a specific stage
   */
  getConfig: adminProcedure
    .input(z.object({ stage: stageEnum }))
    .query(async ({ input }) => {
      return await getReminderConfigForStage(input.stage);
    }),

  /**
   * Update reminder configuration
   */
  updateConfig: adminProcedure
    .input(
      z.object({
        stage: stageEnum,
        enabled: z.boolean().optional(),
        thresholdDays: z.number().min(1).max(90).optional(),
        reminderIntervalDays: z.number().min(1).max(30).optional(),
        maxReminders: z.number().min(1).max(10).optional(),
        emailSubject: z.string().min(1).max(255).optional(),
        emailTemplate: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { stage, ...config } = input;
      return await updateReminderConfig(stage, config);
    }),

  /**
   * Get list of stuck participants
   */
  getStuckParticipants: adminProcedure
    .input(
      z.object({
        stage: stageEnum.optional(),
      })
    )
    .query(async ({ input }) => {
      return await getStuckParticipants(input.stage);
    }),

  /**
   * Send manual reminder to a participant
   */
  sendManualReminder: adminProcedure
    .input(
      z.object({
        applicationId: z.number(),
        stage: stageEnum,
      })
    )
    .mutation(async ({ input }) => {
      return await sendReminderEmail(input.applicationId, input.stage, true);
    }),

  /**
   * Get reminder email log
   */
  getReminderLog: adminProcedure
    .input(
      z.object({
        applicationId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getReminderLog(input.applicationId);
    }),

  /**
   * Trigger automated reminder processing (manual trigger)
   */
  processReminders: adminProcedure.mutation(async () => {
    return await processAutomatedReminders();
  }),

  /**
   * Initialize default reminder configurations
   */
  initializeDefaults: adminProcedure.mutation(async () => {
    const stages: Array<'registration' | 'technical' | 'integration' | 'testing' | 'production'> = [
      'registration',
      'technical',
      'integration',
      'testing',
      'production',
    ];

    for (const stage of stages) {
      await updateReminderConfig(stage, {
        enabled: true,
        thresholdDays: 7,
        reminderIntervalDays: 3,
        maxReminders: 3,
      });
    }

    return { success: true, message: 'Default configurations initialized' };
  }),
});
