import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { bnplApplications, bnplInstallments } from '../../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
import { deliverWebhookEvent, WebhookEvents } from '../services/webhook-delivery';

export const bnplRouter = router({
  // Create BNPL application
  createApplication: protectedProcedure
    .input(z.object({
      student_name: z.string().min(1),
      school_name: z.string().min(1),
      grade: z.string().min(1),
      school_fees_amount: z.number().positive(),
      installment_plan: z.union([z.literal(3), z.literal(6), z.literal(12)]),
      employment_status: z.string().min(1),
      monthly_income: z.number().positive(),
      documents: z.object({
        id: z.string().nullable(),
        proofOfIncome: z.string().nullable(),
        studentId: z.string().nullable(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Calculate total amount with 2% interest
      const interestRate = 0.02;
      const totalAmount = input.school_fees_amount * (1 + interestRate);
      const monthlyPayment = totalAmount / input.installment_plan;

      const now = new Date();

      // Create application
      const applicationId = crypto.randomUUID();
      await db.insert(bnplApplications).values({
        id: applicationId,
        userId,
        studentName: input.student_name,
        schoolName: input.school_name,
        grade: input.grade,
        schoolFeesAmount: input.school_fees_amount.toString(),
        totalAmount: totalAmount.toString(),
        installmentPlan: input.installment_plan,
        monthlyPayment: monthlyPayment.toString(),
        employmentStatus: input.employment_status,
        monthlyIncome: input.monthly_income.toString(),
        documents: input.documents,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      // Create installment records
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + 1); // First payment next month

      const installmentValues = [];
      for (let i = 0; i < input.installment_plan; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        installmentValues.push({
          applicationId,
          installmentNumber: i + 1,
          amount: monthlyPayment.toString(),
          dueDate,
          status: 'pending' as const,
          createdAt: now,
        });
      }

      await db.insert(bnplInstallments).values(installmentValues);

      return {
        success: true,
        applicationId,
        message: 'Application submitted successfully',
      };
    }),

  // Get user's BNPL applications
  getApplications: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      const userApplications = await db
        .select()
        .from(bnplApplications)
        .where(eq(bnplApplications.userId, userId))
        .orderBy(desc(bnplApplications.createdAt));

      return userApplications;
    }),

  // Get application details with installments
  getApplicationDetails: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      const [application] = await db
        .select()
        .from(bnplApplications)
        .where(
          and(
            eq(bnplApplications.id, input.applicationId),
            eq(bnplApplications.userId, userId)
          )
        )
        .limit(1);

      if (!application) {
        throw new Error('Application not found');
      }

      const appInstallments = await db
        .select()
        .from(bnplInstallments)
        .where(eq(bnplInstallments.applicationId, input.applicationId))
        .orderBy(bnplInstallments.installmentNumber);

      return {
        ...application,
        installments: appInstallments,
      };
    }),

  // Pay installment
  payInstallment: protectedProcedure
    .input(z.object({
      installmentId: z.string(),
      paymentMethod: z.enum(['wallet', 'card', 'bank_transfer']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Get installment
      const [installment] = await db
        .select()
        .from(bnplInstallments)
        .where(eq(bnplInstallments.id, input.installmentId))
        .limit(1);

      if (!installment) {
        throw new Error('Installment not found');
      }

      // Verify application belongs to user
      const [application] = await db
        .select()
        .from(bnplApplications)
        .where(
          and(
            eq(bnplApplications.id, installment.applicationId),
            eq(bnplApplications.userId, userId)
          )
        )
        .limit(1);

      if (!application) {
        throw new Error('Application not found');
      }

      if (installment.status === 'paid') {
        throw new Error('Installment already paid');
      }

      // Mark as paid
      const now = new Date();
      await db
        .update(bnplInstallments)
        .set({
          status: 'paid',
          paidAt: now,
          paymentMethod: input.paymentMethod,
        })
        .where(eq(bnplInstallments.id, input.installmentId));

      // Fire webhook event for payment success
      await deliverWebhookEvent(
        WebhookEvents.PAYMENT_SUCCESS,
        {
          installmentId: input.installmentId,
          applicationId: installment.applicationId,
          amount: installment.amount,
          installmentNumber: installment.installmentNumber,
          paymentMethod: input.paymentMethod,
          paidAt: now.toISOString(),
        },
        userId
      );

      // Check if all installments are paid
      const allInstallments = await db
        .select()
        .from(bnplInstallments)
        .where(eq(bnplInstallments.applicationId, installment.applicationId));

      const allPaid = allInstallments.every((inst) => inst.status === 'paid');

      if (allPaid) {
        // Update application status to completed
        await db
          .update(bnplApplications)
          .set({
            status: 'completed',
            updatedAt: now,
          })
          .where(eq(bnplApplications.id, installment.applicationId));
      }

      return {
        success: true,
        message: 'Payment successful',
      };
    }),

  // Get payment history
  getPaymentHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      // Get all user applications
      const userApplications = await db
        .select()
        .from(bnplApplications)
        .where(eq(bnplApplications.userId, userId));

      if (userApplications.length === 0) {
        return [];
      }

      const applicationIds = userApplications.map((app) => app.id);

      // Get all paid installments
      const paidInstallments = await db
        .select()
        .from(bnplInstallments)
        .where(
          and(
            eq(bnplInstallments.status, 'paid'),
            // Note: Drizzle doesn't have a direct "IN" operator for arrays in this context
            // We'll need to use a workaround or fetch all and filter
          )
        )
        .orderBy(desc(bnplInstallments.paidAt));

      // Filter by application IDs
      const filtered = paidInstallments.filter((inst) =>
        applicationIds.includes(inst.applicationId)
      );

      return filtered;
    }),
});
