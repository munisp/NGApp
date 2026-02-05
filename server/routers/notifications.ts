import { router, protectedProcedure } from "../_core/trpc.js";
import { z } from 'zod';
import { getDb } from '../db.js';
import { notificationPreferences } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';

interface NotificationTrigger {
  userId: string;
  type: "transaction" | "bill" | "goal" | "balance" | "security";
  title: string;
  message: string;
  data?: any;
}

// In-memory notification storage (replace with database in production)
const notifications: Map<string, any[]> = new Map();

export const notificationsRouter = router({
  /**
   * Get all notifications for the current user
   */
  getNotifications: protectedProcedure.query(async ({ ctx }) => {
    const userId = String(ctx.user?.id || 'anonymous');
    const userNotifications = notifications.get(userId) || [];
    
    return {
      success: true,
      notifications: userNotifications,
      unreadCount: userNotifications.filter((n) => !n.read).length,
    };
  }),

  /**
   * Mark notification as read
   */
  markAsRead: protectedProcedure
    .input(
      z.object({
        notificationId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const userNotifications = notifications.get(userId) || [];
      
      const notification = userNotifications.find((n) => n.id === input.notificationId);
      if (notification) {
        notification.read = true;
      }
      
      return {
        success: true,
        message: 'Notification marked as read',
      };
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = String(ctx.user?.id || 'anonymous');
    const userNotifications = notifications.get(userId) || [];
    
    userNotifications.forEach((n) => {
      n.read = true;
    });
    
    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }),

  /**
   * Delete a notification
   */
  deleteNotification: protectedProcedure
    .input(
      z.object({
        notificationId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      const userNotifications = notifications.get(userId) || [];
      
      const index = userNotifications.findIndex((n) => n.id === input.notificationId);
      if (index !== -1) {
        userNotifications.splice(index, 1);
      }
      
      return {
        success: true,
        message: 'Notification deleted',
      };
    }),

  /**
   * Send a notification (internal use)
   */
  sendNotification: protectedProcedure
    .input(
      z.object({
        type: z.enum(["transaction", "bill", "goal", "balance", "security"]),
        title: z.string(),
        message: z.string(),
        data: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = String(ctx.user?.id || 'anonymous');
      
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
        read: false,
        createdAt: new Date().toISOString(),
      };
      
      if (!notifications.has(userId)) {
        notifications.set(userId, []);
      }
      
      notifications.get(userId)!.push(notification);
      
      return {
        success: true,
        notification,
      };
    }),

  /**
   * Get notification preferences
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    // Get or create preferences
    let [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (!prefs) {
      // Create default preferences
      [prefs] = await db
        .insert(notificationPreferences)
        .values({
          userId,
          pushEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
          transactionNotifications: true,
          billNotifications: true,
          goalNotifications: true,
          balanceNotifications: true,
          securityNotifications: true,
        })
        .returning();
    }

    return {
      success: true,
      preferences: {
        pushEnabled: prefs.pushEnabled,
        emailEnabled: prefs.emailEnabled,
        smsEnabled: prefs.smsEnabled,
        categories: {
          transaction: prefs.transactionNotifications,
          bill: prefs.billNotifications,
          goal: prefs.goalNotifications,
          balance: prefs.balanceNotifications,
          security: prefs.securityNotifications,
        },
      },
    };
  }),

  /**
   * Save push notification token
   */
  savePushToken: protectedProcedure
    .input(
      z.object({
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      // Update or create user's push token
      await db
        .insert(notificationPreferences)
        .values({
          userId,
          pushToken: input.token,
          pushEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
          transactionNotifications: true,
          billNotifications: true,
          goalNotifications: true,
          balanceNotifications: true,
          securityNotifications: true,
        })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: {
            pushToken: input.token,
            updatedAt: new Date(),
          },
        });

      return { success: true, message: 'Push token saved successfully' };
    }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        pushEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        smsEnabled: z.boolean().optional(),
        categories: z
          .object({
            transaction: z.boolean().optional(),
            bill: z.boolean().optional(),
            goal: z.boolean().optional(),
            balance: z.boolean().optional(),
            security: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      // Build update data
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.pushEnabled !== undefined) updateData.pushEnabled = input.pushEnabled;
      if (input.emailEnabled !== undefined) updateData.emailEnabled = input.emailEnabled;
      if (input.smsEnabled !== undefined) updateData.smsEnabled = input.smsEnabled;

      if (input.categories) {
        if (input.categories.transaction !== undefined) {
          updateData.transactionNotifications = input.categories.transaction;
        }
        if (input.categories.bill !== undefined) {
          updateData.billNotifications = input.categories.bill;
        }
        if (input.categories.goal !== undefined) {
          updateData.goalNotifications = input.categories.goal;
        }
        if (input.categories.balance !== undefined) {
          updateData.balanceNotifications = input.categories.balance;
        }
        if (input.categories.security !== undefined) {
          updateData.securityNotifications = input.categories.security;
        }
      }

      // Update preferences
      await db
        .update(notificationPreferences)
        .set(updateData)
        .where(eq(notificationPreferences.userId, userId));

      return {
        success: true,
        message: 'Notification preferences updated',
      };
    }),
});

// Helper functions for triggering notifications
export function triggerTransactionNotification(
  userId: string,
  amount: number,
  type: "sent" | "received",
  recipient?: string
) {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: "transaction" as const,
    title: type === "sent" ? "Payment Sent" : "Payment Received",
    message:
      type === "sent"
        ? `You sent $${amount.toFixed(2)}${recipient ? ` to ${recipient}` : ""}`
        : `You received $${amount.toFixed(2)}${recipient ? ` from ${recipient}` : ""}`,
    data: { amount, type, recipient },
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (!notifications.has(userId)) {
    notifications.set(userId, []);
  }
  notifications.get(userId)!.push(notification);
  console.log(`[Transaction Notification] Triggered:`, notification);
}

export function triggerBillDueNotification(
  userId: string,
  billName: string,
  amount: number,
  dueDate: string
) {
  const daysUntilDue = Math.ceil(
    (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: "bill" as const,
    title: "Bill Due Soon",
    message: `Your ${billName} bill of $${amount.toFixed(2)} is due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`,
    data: { billName, amount, dueDate, daysUntilDue },
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (!notifications.has(userId)) {
    notifications.set(userId, []);
  }
  notifications.get(userId)!.push(notification);
  console.log(`[Bill Notification] Triggered:`, notification);
}

export function triggerGoalMilestoneNotification(
  userId: string,
  goalName: string,
  progress: number,
  targetAmount: number
) {
  const percentage = Math.round((progress / targetAmount) * 100);

  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: "goal" as const,
    title: "Goal Milestone Reached",
    message: `You've reached ${percentage}% of your ${goalName} goal!`,
    data: { goalName, progress, targetAmount, percentage },
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (!notifications.has(userId)) {
    notifications.set(userId, []);
  }
  notifications.get(userId)!.push(notification);
  console.log(`[Goal Notification] Triggered:`, notification);
}

export function triggerLowBalanceNotification(
  userId: string,
  accountName: string,
  balance: number,
  threshold: number
) {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: "balance" as const,
    title: "Low Balance Alert",
    message: `Your ${accountName} balance is $${balance.toFixed(2)}, below your threshold of $${threshold.toFixed(2)}`,
    data: { accountName, balance, threshold },
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (!notifications.has(userId)) {
    notifications.set(userId, []);
  }
  notifications.get(userId)!.push(notification);
  console.log(`[Balance Notification] Triggered:`, notification);
}

export default notificationsRouter;
