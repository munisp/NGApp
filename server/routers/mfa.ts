import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  enableMfa,
  verifyAndActivateMfa,
  verifyMfaForLogin,
  disableMfa,
  regenerateBackupCodes,
  isMfaEnabled,
  getMfaStatus,
} from '../services/mfa';
import { deliverWebhookEvent } from '../services/webhook-delivery';

/**
 * MFA Router
 * Handles multi-factor authentication operations
 */
export const mfaRouter = router({
  /**
   * Get MFA status for current user
   */
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const status = await getMfaStatus(userId);
      
      return {
        success: true,
        status,
      };
    }),
  
  /**
   * Enable MFA for current user
   * Returns TOTP secret, QR code URI, and backup codes
   */
  enable: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const email = ctx.user.email || 'user@example.com';
      
      const { secret, qrCodeUri, backupCodes } = await enableMfa(userId, email);
      
      return {
        success: true,
        secret,
        qrCodeUri,
        backupCodes,
      };
    }),
  
  /**
   * Verify TOTP code and activate MFA
   */
  verify: protectedProcedure
    .input(z.object({
      code: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const isValid = await verifyAndActivateMfa(userId, input.code);
      
      if (!isValid) {
        throw new Error('Invalid verification code');
      }
      
      // Fire webhook event for MFA enrollment
      await deliverWebhookEvent(
        'mfa.enrolled',
        {
          userId: String(userId),
          enrolledAt: new Date().toISOString(),
          method: 'totp',
        },
        String(userId)
      );
      
      return {
        success: true,
        message: 'MFA activated successfully',
      };
    }),
  
  /**
   * Verify MFA code for login
   */
  verifyLogin: protectedProcedure
    .input(z.object({
      code: z.string().min(6).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const isValid = await verifyMfaForLogin(userId, input.code);
      
      if (!isValid) {
        throw new Error('Invalid MFA code');
      }
      
      return {
        success: true,
        message: 'MFA verification successful',
      };
    }),
  
  /**
   * Disable MFA for current user
   */
  disable: protectedProcedure
    .input(z.object({
      code: z.string().min(6).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Verify code before disabling
      const isValid = await verifyMfaForLogin(userId, input.code);
      
      if (!isValid) {
        throw new Error('Invalid MFA code');
      }
      
      await disableMfa(userId);
      
      // Fire webhook event for MFA disabled
      await deliverWebhookEvent(
        'mfa.disabled',
        {
          userId: String(userId),
          disabledAt: new Date().toISOString(),
        },
        String(userId)
      );
      
      return {
        success: true,
        message: 'MFA disabled successfully',
      };
    }),
  
  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes: protectedProcedure
    .input(z.object({
      code: z.string().min(6).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Verify code before regenerating
      const isValid = await verifyMfaForLogin(userId, input.code);
      
      if (!isValid) {
        throw new Error('Invalid MFA code');
      }
      
      const backupCodes = await regenerateBackupCodes(userId);
      
      return {
        success: true,
        backupCodes,
      };
    }),
  
  /**
   * Check if MFA is required for current user
   */
  isRequired: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const isEnabled = await isMfaEnabled(userId);
      
      // Require MFA for admin users
      const isAdmin = ctx.user.role === 'admin';
      
      return {
        success: true,
        isEnabled,
        isRequired: isAdmin,
      };
    }),
});
