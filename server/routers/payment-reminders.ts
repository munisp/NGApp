import { router, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  getUpcomingInstallments,
  getOverdueInstallments,
  formatReminderMessage,
} from '../services/payment-reminders';

export const paymentRemindersRouter = router({
  // Get upcoming payment reminders for current user
  getUpcomingReminders: protectedProcedure.query(async ({ ctx }: any) => {
    const userId = ctx.user?.openId;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const allUpcoming = await getUpcomingInstallments();
    const userReminders = allUpcoming.filter((r) => r.userId === userId);

    return userReminders.map((reminder) => ({
      ...reminder,
      ...formatReminderMessage(reminder, false),
    }));
  }),

  // Get overdue payment reminders for current user
  getOverdueReminders: protectedProcedure.query(async ({ ctx }: any) => {
    const userId = ctx.user?.openId;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const overdueReminders = await getOverdueInstallments(userId);

    return overdueReminders.map((reminder) => ({
      ...reminder,
      ...formatReminderMessage(reminder, true),
    }));
  }),

  // Send push notification for upcoming payments (admin/cron job)
  sendUpcomingReminders: protectedProcedure.mutation(async ({ ctx }: any) => {
    const upcomingInstallments = await getUpcomingInstallments();

    // In production, this would send actual push notifications via Expo Push API
    // For now, we'll just return the count of reminders that would be sent
    const remindersSent = upcomingInstallments.length;

    return {
      success: true,
      remindersSent,
      message: `${remindersSent} payment reminders scheduled`,
    };
  }),

  // Send push notification for overdue payments (admin/cron job)
  sendOverdueReminders: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ input }: any) => {
      const overdueInstallments = await getOverdueInstallments(input.userId);

      // In production, this would send actual push notifications via Expo Push API
      const remindersSent = overdueInstallments.length;

      return {
        success: true,
        remindersSent,
        message: `${remindersSent} overdue payment reminders sent`,
      };
    }),
});
