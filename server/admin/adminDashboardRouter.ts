import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import {
  getDashboardStatistics,
  getAllParticipantsProgress,
  getParticipantDetailedProgress,
} from './adminDashboardService';
import { getDb } from '../db';
import { users, participantApplications } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Admin-only procedure
 * Ensures only users with admin role can access these endpoints
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

export const adminDashboardRouter = router({
  /**
   * Get dashboard overview statistics
   */
  getStats: adminProcedure.query(async () => {
    return await getDashboardStatistics();
  }),

  /**
   * List all participants with pagination and filtering
   */
  listParticipants: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        statusFilter: z.enum(['pending', 'approved', 'rejected']).optional(),
      })
    )
    .query(async ({ input }) => {
      return await getAllParticipantsProgress(
        input.page,
        input.limit,
        input.statusFilter
      );
    }),

  /**
   * Get detailed progress for a specific participant
   */
  getParticipantDetails: adminProcedure
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      return await getParticipantDetailedProgress(input.applicationId);
    }),

  /**
   * Update user role (promote to admin or demote to user)
   */
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(['user', 'admin']),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Approve or reject participant application
   */
  updateApplicationStatus: adminProcedure
    .input(
      z.object({
        applicationId: z.number(),
        status: z.enum(['approved', 'rejected']),
        reviewNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      await db
        .update(participantApplications)
        .set({
          status: input.status,
          reviewNotes: input.reviewNotes,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(participantApplications.id, input.applicationId));

      return { success: true };
    }),

  /**
   * Get all users (for user management)
   */
  listAllUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const offset = (input.page - 1) * input.limit;

      const usersList = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          loginMethod: users.loginMethod,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .limit(input.limit)
        .offset(offset);

      return { users: usersList };
    }),

  /**
   * Export participant data to CSV
   */
  exportParticipantData: adminProcedure
    .input(
      z.object({
        statusFilter: z.enum(['pending', 'approved', 'rejected']).optional(),
      })
    )
    .query(async ({ input }) => {
      const { participants } = await getAllParticipantsProgress(
        1,
        10000, // Get all participants
        input.statusFilter
      );

      // Convert to CSV format
      const headers = [
        'Organization Name',
        'Business Type',
        'Contact Name',
        'Contact Email',
        'Registration Status',
        'Technical Status',
        'Certification Status',
        'Production Status',
        'Current Step',
        'Completion %',
        'Created At',
      ];

      const rows = participants.map((p) => [
        p.organizationName,
        p.businessType,
        p.userName,
        p.userEmail,
        p.registrationStatus,
        p.technicalStatus || 'N/A',
        p.certificationStatus || 'N/A',
        p.productionStatus || 'N/A',
        p.currentStep.toString(),
        p.completionPercentage.toString(),
        p.createdAt.toISOString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      return { csvContent };
    }),
});
