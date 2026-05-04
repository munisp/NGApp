/**
 * Notification Preferences tRPC Router
 * 
 * Provides API endpoints for managing notification preferences
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import * as notificationPreferencesService from '../services/notificationPreferencesService';

export const notificationPreferencesRouter = router({
  /**
   * Get current user's notification preferences
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await notificationPreferencesService.getNotificationPreferences(ctx.user.id);
    
    if (!prefs) {
      // Return defaults if not found
      return {
        emailNotifications: true,
        smsNotifications: false,
        newDeviceAlerts: true,
        suspiciousActivityAlerts: true,
        loginAlerts: false,
        passwordChangeAlerts: true,
        twoFactorChangeAlerts: true,
      };
    }

    // Convert string enums to booleans for frontend
    return {
      emailNotifications: prefs.emailNotifications === 'true',
      smsNotifications: prefs.smsNotifications === 'true',
      newDeviceAlerts: prefs.newDeviceAlerts === 'true',
      suspiciousActivityAlerts: prefs.suspiciousActivityAlerts === 'true',
      loginAlerts: prefs.loginAlerts === 'true',
      passwordChangeAlerts: prefs.passwordChangeAlerts === 'true',
      twoFactorChangeAlerts: prefs.twoFactorChangeAlerts === 'true',
    };
  }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        emailNotifications: z.boolean().optional(),
        smsNotifications: z.boolean().optional(),
        newDeviceAlerts: z.boolean().optional(),
        suspiciousActivityAlerts: z.boolean().optional(),
        loginAlerts: z.boolean().optional(),
        passwordChangeAlerts: z.boolean().optional(),
        twoFactorChangeAlerts: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Convert booleans to string enums for database
      const updates: Record<string, 'true' | 'false'> = {};
      
      if (input.emailNotifications !== undefined) {
        updates.emailNotifications = input.emailNotifications ? 'true' : 'false';
      }
      if (input.smsNotifications !== undefined) {
        updates.smsNotifications = input.smsNotifications ? 'true' : 'false';
      }
      if (input.newDeviceAlerts !== undefined) {
        updates.newDeviceAlerts = input.newDeviceAlerts ? 'true' : 'false';
      }
      if (input.suspiciousActivityAlerts !== undefined) {
        updates.suspiciousActivityAlerts = input.suspiciousActivityAlerts ? 'true' : 'false';
      }
      if (input.loginAlerts !== undefined) {
        updates.loginAlerts = input.loginAlerts ? 'true' : 'false';
      }
      if (input.passwordChangeAlerts !== undefined) {
        updates.passwordChangeAlerts = input.passwordChangeAlerts ? 'true' : 'false';
      }
      if (input.twoFactorChangeAlerts !== undefined) {
        updates.twoFactorChangeAlerts = input.twoFactorChangeAlerts ? 'true' : 'false';
      }

      const result = await notificationPreferencesService.updateNotificationPreferences(
        ctx.user.id,
        updates
      );

      return result;
    }),

  /**
   * Reset preferences to defaults
   */
  resetPreferences: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await notificationPreferencesService.resetNotificationPreferences(ctx.user.id);
    return result;
  }),
});
