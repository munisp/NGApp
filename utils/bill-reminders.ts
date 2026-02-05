import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface BillReminder {
  id: string;
  bill_id: string;
  bill_name: string;
  biller_name: string;
  amount: number;
  due_date: number;
  reminder_days_before: number;
  auto_pay_enabled: boolean;
  auto_pay_account_id?: string;
  is_recurring: boolean;
  recurrence_frequency?: "monthly" | "quarterly" | "yearly";
  last_paid?: number;
  next_due_date?: number;
  notification_id?: string;
  created_at: number;
  status: "pending" | "reminded" | "paid" | "overdue";
}

const REMINDERS_STORAGE_KEY = "bill_reminders";

/**
 * Get all bill reminders
 */
export async function getBillReminders(): Promise<BillReminder[]> {
  try {
    const remindersJson = await AsyncStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!remindersJson) return [];
    return JSON.parse(remindersJson);
  } catch (error) {
    console.error("Failed to get bill reminders:", error);
    return [];
  }
}

/**
 * Save bill reminders
 */
async function saveBillReminders(reminders: BillReminder[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  } catch (error) {
    console.error("Failed to save bill reminders:", error);
    throw error;
  }
}

/**
 * Create a bill reminder
 */
export async function createBillReminder(
  reminder: Omit<BillReminder, "id" | "created_at" | "status">
): Promise<BillReminder> {
  const reminders = await getBillReminders();
  
  const newReminder: BillReminder = {
    ...reminder,
    id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: Date.now(),
    status: "pending",
  };
  
  // Schedule notification
  if (newReminder.reminder_days_before > 0) {
    const notificationId = await scheduleReminderNotification(newReminder);
    newReminder.notification_id = notificationId;
  }
  
  reminders.push(newReminder);
  await saveBillReminders(reminders);
  
  return newReminder;
}

/**
 * Update bill reminder
 */
export async function updateBillReminder(
  reminderId: string,
  updates: Partial<BillReminder>
): Promise<BillReminder | null> {
  const reminders = await getBillReminders();
  const index = reminders.findIndex((r) => r.id === reminderId);
  
  if (index === -1) return null;
  
  const reminder = reminders[index];
  
  // Cancel old notification if reminder time changed
  if (updates.reminder_days_before !== undefined && reminder.notification_id) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notification_id);
  }
  
  reminders[index] = { ...reminder, ...updates };
  
  // Schedule new notification if needed
  if (updates.reminder_days_before !== undefined && updates.reminder_days_before > 0) {
    const notificationId = await scheduleReminderNotification(reminders[index]);
    reminders[index].notification_id = notificationId;
  }
  
  await saveBillReminders(reminders);
  
  return reminders[index];
}

/**
 * Delete bill reminder
 */
export async function deleteBillReminder(reminderId: string): Promise<boolean> {
  const reminders = await getBillReminders();
  const reminder = reminders.find((r) => r.id === reminderId);
  
  if (!reminder) return false;
  
  // Cancel notification
  if (reminder.notification_id) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notification_id);
  }
  
  const filtered = reminders.filter((r) => r.id !== reminderId);
  await saveBillReminders(filtered);
  
  return true;
}

/**
 * Enable auto-pay for a reminder
 */
export async function enableAutoPay(
  reminderId: string,
  accountId: string
): Promise<boolean> {
  return await updateBillReminder(reminderId, {
    auto_pay_enabled: true,
    auto_pay_account_id: accountId,
  }) !== null;
}

/**
 * Disable auto-pay for a reminder
 */
export async function disableAutoPay(reminderId: string): Promise<boolean> {
  return await updateBillReminder(reminderId, {
    auto_pay_enabled: false,
    auto_pay_account_id: undefined,
  }) !== null;
}

/**
 * Schedule reminder notification
 */
async function scheduleReminderNotification(reminder: BillReminder): Promise<string> {
  const reminderDate = new Date(reminder.due_date);
  reminderDate.setDate(reminderDate.getDate() - reminder.reminder_days_before);
  reminderDate.setHours(9, 0, 0, 0); // 9 AM
  
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Bill Payment Reminder",
      body: `${reminder.bill_name} payment of $${reminder.amount.toFixed(2)} is due in ${reminder.reminder_days_before} ${reminder.reminder_days_before === 1 ? 'day' : 'days'}`,
      data: {
        type: "bill_reminder",
        reminder_id: reminder.id,
        bill_id: reminder.bill_id,
      },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.floor((reminderDate.getTime() - Date.now()) / 1000) },
  });
  
  return notificationId;
}

/**
 * Get upcoming reminders (within next 7 days)
 */
export async function getUpcomingReminders(): Promise<BillReminder[]> {
  const reminders = await getBillReminders();
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
  
  return reminders.filter(
    (r) => r.status === "pending" && r.due_date >= now && r.due_date <= sevenDaysFromNow
  );
}

/**
 * Get overdue reminders
 */
export async function getOverdueReminders(): Promise<BillReminder[]> {
  const reminders = await getBillReminders();
  const now = Date.now();
  
  return reminders.filter((r) => r.status === "pending" && r.due_date < now);
}

/**
 * Mark reminder as paid
 */
export async function markReminderAsPaid(reminderId: string): Promise<boolean> {
  const reminders = await getBillReminders();
  const reminder = reminders.find((r) => r.id === reminderId);
  
  if (!reminder) return false;
  
  reminder.status = "paid";
  reminder.last_paid = Date.now();
  
  // If recurring, calculate next due date
  if (reminder.is_recurring && reminder.recurrence_frequency) {
    const nextDueDate = calculateNextDueDate(reminder.due_date, reminder.recurrence_frequency);
    reminder.next_due_date = nextDueDate;
    reminder.due_date = nextDueDate;
    reminder.status = "pending";
    
    // Schedule new notification
    if (reminder.reminder_days_before > 0) {
      const notificationId = await scheduleReminderNotification(reminder);
      reminder.notification_id = notificationId;
    }
  }
  
  await saveBillReminders(reminders);
  
  return true;
}

/**
 * Calculate next due date for recurring bills
 */
function calculateNextDueDate(currentDueDate: number, frequency: "monthly" | "quarterly" | "yearly"): number {
  const date = new Date(currentDueDate);
  
  switch (frequency) {
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.getTime();
}

/**
 * Execute auto-pay for due reminders
 */
export async function executeAutoPay(reminderId: string): Promise<{
  success: boolean;
  message: string;
  transaction_id?: string;
}> {
  const reminders = await getBillReminders();
  const reminder = reminders.find((r) => r.id === reminderId);
  
  if (!reminder) {
    return { success: false, message: "Reminder not found" };
  }
  
  if (!reminder.auto_pay_enabled || !reminder.auto_pay_account_id) {
    return { success: false, message: "Auto-pay not enabled" };
  }
  
  // Check if due (within 1 day of due date)
  const now = Date.now();
  const oneDayBeforeDue = reminder.due_date - 24 * 60 * 60 * 1000;
  
  if (now < oneDayBeforeDue) {
    return { success: false, message: "Not yet due for payment" };
  }
  
  try {
    // In production, this would call the actual payment API
    // For now, simulate payment
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Mark as paid
    await markReminderAsPaid(reminderId);
    
    // Send success notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Auto-Pay Successful",
        body: `${reminder.bill_name} payment of $${reminder.amount.toFixed(2)} has been processed`,
        data: {
          type: "auto_pay_success",
          reminder_id: reminderId,
          transaction_id: transactionId,
        },
      },
      trigger: null, // Send immediately
    });
    
    return {
      success: true,
      message: "Payment processed successfully",
      transaction_id: transactionId,
    };
  } catch (error: any) {
    // Send failure notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Auto-Pay Failed",
        body: `Failed to process ${reminder.bill_name} payment. Please pay manually.`,
        data: {
          type: "auto_pay_failure",
          reminder_id: reminderId,
        },
      },
      trigger: null,
    });
    
    return {
      success: false,
      message: error.message || "Payment failed",
    };
  }
}

/**
 * Check and execute auto-pay for all due reminders
 */
export async function checkAndExecuteAutoPay(): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  const reminders = await getBillReminders();
  const now = Date.now();
  const oneDayFromNow = now + 24 * 60 * 60 * 1000;
  
  const dueReminders = reminders.filter(
    (r) =>
      r.status === "pending" &&
      r.auto_pay_enabled &&
      r.due_date >= now &&
      r.due_date <= oneDayFromNow
  );
  
  let successful = 0;
  let failed = 0;
  
  for (const reminder of dueReminders) {
    const result = await executeAutoPay(reminder.id);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }
  
  return {
    processed: dueReminders.length,
    successful,
    failed,
  };
}

/**
 * Get reminders by status
 */
export async function getRemindersByStatus(status: BillReminder["status"]): Promise<BillReminder[]> {
  const reminders = await getBillReminders();
  return reminders.filter((r) => r.status === status);
}

/**
 * Get auto-pay enabled reminders
 */
export async function getAutoPayReminders(): Promise<BillReminder[]> {
  const reminders = await getBillReminders();
  return reminders.filter((r) => r.auto_pay_enabled);
}

/**
 * Update reminder status based on due date
 */
export async function updateReminderStatuses(): Promise<void> {
  const reminders = await getBillReminders();
  const now = Date.now();
  let updated = false;
  
  for (const reminder of reminders) {
    if (reminder.status === "pending" && reminder.due_date < now) {
      reminder.status = "overdue";
      updated = true;
    }
  }
  
  if (updated) {
    await saveBillReminders(reminders);
  }
}

/**
 * Get reminder statistics
 */
export async function getReminderStatistics(): Promise<{
  total: number;
  pending: number;
  overdue: number;
  paid: number;
  auto_pay_enabled: number;
  upcoming_7_days: number;
  total_amount_due: number;
}> {
  const reminders = await getBillReminders();
  const upcoming = await getUpcomingReminders();
  
  const stats = {
    total: reminders.length,
    pending: reminders.filter((r) => r.status === "pending").length,
    overdue: reminders.filter((r) => r.status === "overdue").length,
    paid: reminders.filter((r) => r.status === "paid").length,
    auto_pay_enabled: reminders.filter((r) => r.auto_pay_enabled).length,
    upcoming_7_days: upcoming.length,
    total_amount_due: reminders
      .filter((r) => r.status === "pending" || r.status === "overdue")
      .reduce((sum, r) => sum + r.amount, 0),
  };
  
  return stats;
}
