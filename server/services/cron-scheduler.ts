import cron from 'node-cron';
import { getUpcomingInstallments, getOverdueInstallments, formatReminderMessage } from './payment-reminders';
import { getDb } from '../db';
import { recurringContributions, savingsGoals, savingsContributions, recurringContributionHistory, notificationPreferences, users } from '../../drizzle/schema';
import { bnplInstallments, bnplApplications } from '../db/schema/bnpl';
import { eq, and, lte, sql, isNotNull } from 'drizzle-orm';
import { sendPushNotification, sendBatchPushNotifications } from './push-notification';

/**
 * Schedule automated payment reminders to run daily at 9 AM
 * This will send push notifications to users with upcoming BNPL payments (due in 3 days)
 */
export function schedulePaymentReminders() {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Running payment reminders scheduler...');
    
    try {
      const upcomingInstallments = await getUpcomingInstallments();
      
      console.log(`[Cron] Found ${upcomingInstallments.length} upcoming payments`);
      
      // Send push notifications via Expo Push API
      const notifications = upcomingInstallments.map((reminder) => {
        const message = formatReminderMessage(reminder, false);
        return {
          userId: reminder.userId,
          title: message.title,
          body: message.body,
          data: message.data,
        };
      });

      if (notifications.length > 0) {
        const result = await sendBatchPushNotifications(notifications);
        console.log(`[Cron] Payment reminders sent: ${result.successful} successful, ${result.failed} failed`);
      }
      
      console.log('[Cron] Payment reminders completed');
    } catch (error) {
      console.error('[Cron] Error sending payment reminders:', error);
    }
  });
  
  console.log('[Cron] Payment reminders scheduler initialized (runs daily at 9 AM)');
}

/**
 * Schedule overdue payment reminders to run twice daily (9 AM and 5 PM)
 */
export function scheduleOverdueReminders() {
  // Run at 9:00 AM and 5:00 PM every day
  cron.schedule('0 9,17 * * *', async () => {
    console.log('[Cron] Running overdue payment reminders scheduler...');
    
    try {
      const db = await getDb();
      if (!db) {
        console.error('[Cron] Database not available for overdue reminders');
        return;
      }

      const now = new Date();

      // Get all users with overdue BNPL payments
      const overduePayments = await db
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
            sql`${bnplInstallments.dueDate} < ${now.toISOString()}`
          )
        );

      console.log(`[Cron] Found ${overduePayments.length} overdue payments`);

      if (overduePayments.length > 0) {
        // Group by user and send notifications
        const notifications = overduePayments.map((payment) => {
          const reminder = {
            installmentId: payment.installmentId,
            userId: payment.userId,
            dueDate: new Date(payment.dueDate),
            amount: payment.amount,
            applicationId: payment.applicationId,
            studentName: payment.studentName,
          };
          const message = formatReminderMessage(reminder, true);
          return {
            userId: payment.userId,
            title: message.title,
            body: message.body,
            data: message.data,
          };
        });

        const result = await sendBatchPushNotifications(notifications);
        console.log(`[Cron] Overdue reminders sent: ${result.successful} successful, ${result.failed} failed`);
      }

      console.log('[Cron] Overdue reminders completed');
    } catch (error) {
      console.error('[Cron] Error sending overdue reminders:', error);
    }
  });
  
  console.log('[Cron] Overdue reminders scheduler initialized (runs at 9 AM and 5 PM)');
}

/**
 * Schedule recurring contributions processing to run daily at 6 AM
 * This will process all due recurring contributions for all users
 */
export function scheduleRecurringContributions() {
  // Run every day at 6:00 AM (before payment reminders)
  cron.schedule('0 6 * * *', async () => {
    console.log('[Cron] Running recurring contributions processor...');
    
    try {
      const db = await getDb();
      if (!db) {
        console.error('[Cron] Database not available');
        return;
      }
      
      const now = new Date();
      
      // Get all due recurring contributions across all users
      const dueContributions = await db
        .select()
        .from(recurringContributions)
        .where(
          and(
            eq(recurringContributions.isActive, true),
            lte(recurringContributions.nextProcessDate, now)
          )
        );
      
      console.log(`[Cron] Found ${dueContributions.length} due recurring contributions`);
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const recurring of dueContributions) {
        try {
          // Check if end date has passed
          if (recurring.endDate && new Date(recurring.endDate) < now) {
            await db
              .update(recurringContributions)
              .set({ isActive: false, updatedAt: now })
              .where(eq(recurringContributions.id, recurring.id));
            
            console.log(`[Cron] Deactivated recurring contribution ${recurring.id} (end date reached)`);
            continue;
          }
          
          // Create contribution
          const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await db.insert(savingsContributions).values({
            id: contributionId,
            goalId: recurring.goalId,
            userId: recurring.userId,
            amount: recurring.amount,
            note: `Recurring contribution (${recurring.frequency})`,
          });
          
          // Update goal current amount
          const [goal] = await db
            .select()
            .from(savingsGoals)
            .where(eq(savingsGoals.id, recurring.goalId));
          
          if (goal) {
            const newCurrentAmount = parseFloat(goal.currentAmount) + parseFloat(recurring.amount);
            const targetAmount = parseFloat(goal.targetAmount);
            const isCompleted = newCurrentAmount >= targetAmount;
            
            await db
              .update(savingsGoals)
              .set({
                currentAmount: newCurrentAmount.toFixed(2),
                isCompleted,
                completedAt: isCompleted ? now : null,
                updatedAt: now,
              })
              .where(eq(savingsGoals.id, recurring.goalId));
          }
          
          // Calculate next process date
          let nextProcessDate = new Date(recurring.nextProcessDate);
          
          if (recurring.frequency === 'monthly') {
            nextProcessDate.setMonth(nextProcessDate.getMonth() + 1);
          } else if (recurring.frequency === 'weekly') {
            nextProcessDate.setDate(nextProcessDate.getDate() + 7);
          } else if (recurring.frequency === 'biweekly') {
            nextProcessDate.setDate(nextProcessDate.getDate() + 14);
          }
          
          // Update recurring contribution
          await db
            .update(recurringContributions)
            .set({
              lastProcessedAt: now,
              nextProcessDate,
              updatedAt: now,
            })
            .where(eq(recurringContributions.id, recurring.id));
          
          // Record history
          const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.insert(recurringContributionHistory).values({
            id: historyId,
            recurringContributionId: recurring.id,
            userId: recurring.userId,
            goalId: recurring.goalId,
            amount: recurring.amount,
            status: 'success',
            errorMessage: null,
          });
          
          successCount++;
          console.log(`[Cron] Processed recurring contribution ${recurring.id}: ₦${recurring.amount}`);
        } catch (error) {
          failureCount++;
          console.error(`[Cron] Error processing recurring contribution ${recurring.id}:`, error);
          
          // Record failure
          const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.insert(recurringContributionHistory).values({
            id: historyId,
            recurringContributionId: recurring.id,
            userId: recurring.userId,
            goalId: recurring.goalId,
            amount: recurring.amount,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      console.log(`[Cron] Recurring contributions completed: ${successCount} success, ${failureCount} failed`);
    } catch (error) {
      console.error('[Cron] Error in recurring contributions processor:', error);
    }
  });
  
  console.log('[Cron] Recurring contributions scheduler initialized (runs daily at 6 AM)');
}

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  scheduleRecurringContributions();
  schedulePaymentReminders();
  scheduleOverdueReminders();
  console.log('[Cron] All cron jobs initialized');
}
