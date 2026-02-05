import { getDb } from '../db';
import { bnplApplications, bnplInstallments } from '../db/schema/bnpl';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

interface ReminderSchedule {
  installmentId: string;
  userId: string;
  dueDate: Date;
  amount: string;
  applicationId: string;
  studentName: string;
}

/**
 * Get all upcoming installments that need reminders (due in 3 days)
 */
export async function getUpcomingInstallments(): Promise<ReminderSchedule[]> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  // Get all installments due in 3 days that are still pending
  const upcomingInstallments = await db
    .select({
      installmentId: bnplInstallments.id,
      userId: bnplApplications.userId,
      dueDate: bnplInstallments.dueDate,
      amount: bnplInstallments.amount,
      applicationId: bnplApplications.id,
      studentName: bnplApplications.studentName,
    })
    .from(bnplInstallments)
    .innerJoin(bnplApplications, eq(bnplInstallments.applicationId, bnplApplications.id))
    .where(
      and(
        eq(bnplInstallments.status, 'pending'),
        sql`${bnplInstallments.dueDate} >= ${threeDaysFromNow.toISOString()}`,
        sql`${bnplInstallments.dueDate} <= ${fourDaysFromNow.toISOString()}`
      )
    );

  return upcomingInstallments.map((row) => ({
    installmentId: row.installmentId,
    userId: row.userId,
    dueDate: new Date(row.dueDate),
    amount: row.amount,
    applicationId: row.applicationId,
    studentName: row.studentName,
  }));
}

/**
 * Get all overdue installments for a user
 */
export async function getOverdueInstallments(userId: string): Promise<ReminderSchedule[]> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const now = new Date();

  const overdueInstallments = await db
    .select({
      installmentId: bnplInstallments.id,
      userId: bnplApplications.userId,
      dueDate: bnplInstallments.dueDate,
      amount: bnplInstallments.amount,
      applicationId: bnplApplications.id,
      studentName: bnplApplications.studentName,
    })
    .from(bnplInstallments)
    .innerJoin(bnplApplications, eq(bnplInstallments.applicationId, bnplApplications.id))
    .where(
      and(
        eq(bnplApplications.userId, userId),
        eq(bnplInstallments.status, 'pending'),
        sql`${bnplInstallments.dueDate} <= ${now.toISOString()}`
      )
    );

  return overdueInstallments.map((row) => ({
    installmentId: row.installmentId,
    userId: row.userId,
    dueDate: new Date(row.dueDate),
    amount: row.amount,
    applicationId: row.applicationId,
    studentName: row.studentName,
  }));
}

/**
 * Format reminder message for push notification
 */
export function formatReminderMessage(reminder: ReminderSchedule, isOverdue: boolean = false): {
  title: string;
  body: string;
  data: Record<string, string>;
} {
  const amount = parseFloat(reminder.amount).toLocaleString('en-NG', {
    style: 'currency',
    currency: 'NGN',
  });

  const daysUntilDue = Math.ceil(
    (reminder.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (isOverdue) {
    return {
      title: 'Payment Overdue',
      body: `Your BNPL payment of ${amount} is overdue. Please pay now to avoid late fees.`,
      data: {
        type: 'payment_reminder',
        installmentId: reminder.installmentId,
        applicationId: reminder.applicationId,
        isOverdue: 'true',
      },
    };
  }

  return {
    title: 'Payment Reminder',
    body: `Your BNPL payment of ${amount} is due in ${daysUntilDue} days. Tap to pay now.`,
    data: {
      type: 'payment_reminder',
      installmentId: reminder.installmentId,
      applicationId: reminder.applicationId,
      isOverdue: 'false',
    },
  };
}
