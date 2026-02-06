import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { bnplApplications, bnplInstallments } from '../../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
import { deliverWebhookEvent, WebhookEvents } from '../services/webhook-delivery';

const BNPL_SERVICE_URL = process.env.BNPL_SERVICE_URL || 'http://127.0.0.1:8112';

async function forwardToBNPLService(path: string, method: string = 'GET', body?: unknown): Promise<unknown> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BNPL_SERVICE_URL}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'BNPL service error' }));
    throw new Error((error as { detail?: string }).detail || 'BNPL service error');
  }
  return response.json();
}

export const bnplRouter = router({
  createApplication: protectedProcedure
    .input(z.object({
      student_name: z.string().min(1),
      school_name: z.string().min(1),
      grade: z.string().min(1),
      school_fees_amount: z.number().positive(),
      installment_plan: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]),
      employment_status: z.string().min(1),
      monthly_income: z.number().positive(),
      documents: z.object({
        id: z.string().nullable(),
        proofOfIncome: z.string().nullable(),
        studentId: z.string().nullable(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.openId || 'anonymous';

      const result = await forwardToBNPLService('/bnpl/apply', 'POST', {
        user_id: userId,
        category: 'school_fees',
        merchant_name: input.school_name,
        amount: input.school_fees_amount,
        installment_months: input.installment_plan,
        student_name: input.student_name,
        school_name: input.school_name,
        grade: input.grade,
        employment_status: input.employment_status,
        monthly_income: input.monthly_income,
        documents: input.documents,
      });

      const typedResult = result as { application_id: string; status: string; message: string };

      const db = await getDb();
      if (db) {
        const now = new Date();
        const interestRate = 0.02;
        const totalAmount = input.school_fees_amount * (1 + interestRate);
        const monthlyPayment = totalAmount / input.installment_plan;

        await db.insert(bnplApplications).values({
          id: typedResult.application_id,
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

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() + 1);
        const installmentValues = [];
        for (let i = 0; i < input.installment_plan; i++) {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          installmentValues.push({
            applicationId: typedResult.application_id,
            installmentNumber: i + 1,
            amount: monthlyPayment.toString(),
            dueDate,
            status: 'pending' as const,
            createdAt: now,
          });
        }
        await db.insert(bnplInstallments).values(installmentValues);
      }

      return {
        success: true,
        applicationId: typedResult.application_id,
        message: typedResult.message || 'Application submitted successfully',
      };
    }),

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

  payInstallment: protectedProcedure
    .input(z.object({
      installmentId: z.string(),
      applicationId: z.string(),
      paymentMethod: z.enum(['wallet', 'card', 'bank_transfer', 'mobile_money', 'auto_debit']),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.openId || 'anonymous';

      const result = await forwardToBNPLService('/bnpl/pay', 'POST', {
        application_id: input.applicationId,
        installment_id: input.installmentId,
        payment_method: input.paymentMethod,
      });

      const typedResult = result as { success: boolean; payment_id: string; amount_paid: number; application_status: string };

      const db = await getDb();
      if (db) {
        const now = new Date();
        await db
          .update(bnplInstallments)
          .set({
            status: 'paid',
            paidAt: now,
            paymentMethod: input.paymentMethod,
          })
          .where(eq(bnplInstallments.id, input.installmentId));

        await deliverWebhookEvent(
          WebhookEvents.PAYMENT_SUCCESS,
          {
            installmentId: input.installmentId,
            applicationId: input.applicationId,
            paymentMethod: input.paymentMethod,
            paidAt: now.toISOString(),
          },
          userId
        );

        if (typedResult.application_status === 'completed') {
          await db
            .update(bnplApplications)
            .set({ status: 'completed', updatedAt: now })
            .where(eq(bnplApplications.id, input.applicationId));
        }
      }

      return {
        success: true,
        message: 'Payment successful',
      };
    }),

  getPaymentHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const userId = ctx.user?.openId || 'anonymous';

      const userApplications = await db
        .select()
        .from(bnplApplications)
        .where(eq(bnplApplications.userId, userId));

      if (userApplications.length === 0) {
        return [];
      }

      const applicationIds = userApplications.map((app) => app.id);

      const paidInstallments = await db
        .select()
        .from(bnplInstallments)
        .where(eq(bnplInstallments.status, 'paid'))
        .orderBy(desc(bnplInstallments.paidAt));

      const filtered = paidInstallments.filter((inst) =>
        applicationIds.includes(inst.applicationId)
      );

      return filtered;
    }),

  getAvailablePlans: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
    }))
    .query(async ({ input }) => {
      const result = await forwardToBNPLService(`/bnpl/plans?amount=${input.amount}&credit_score=500`);
      return result as { plans: Array<{ months: number; interest_rate: number; monthly_payment: number; total_amount: number; total_interest: number; first_payment_date: string }> };
    }),

  getPendingApplications: protectedProcedure
    .query(async () => {
      const result = await forwardToBNPLService('/bnpl/pending');
      return result as { applications: Array<Record<string, unknown>>; total: number };
    }),

  reviewApplication: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      action: z.enum(['approve', 'reject']),
      notes: z.string().optional(),
      rejectionReason: z.string().optional(),
      adjustedAmount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reviewerId = ctx.user?.openId || 'admin';
      const result = await forwardToBNPLService('/bnpl/review', 'POST', {
        application_id: input.applicationId,
        reviewer_id: reviewerId,
        action: input.action,
        notes: input.notes,
        rejection_reason: input.rejectionReason,
        adjusted_amount: input.adjustedAmount,
      });
      return result as { success: boolean; status: string; message: string };
    }),

  disburse: protectedProcedure
    .input(z.object({
      applicationId: z.string(),
      method: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await forwardToBNPLService('/bnpl/disburse', 'POST', {
        application_id: input.applicationId,
        disbursement_method: input.method || 'bank_transfer',
      });
      return result as { success: boolean; disbursement_id: string };
    }),

  getAnalytics: protectedProcedure
    .query(async () => {
      const result = await forwardToBNPLService('/bnpl/analytics/summary');
      return result as Record<string, unknown>;
    }),
});
