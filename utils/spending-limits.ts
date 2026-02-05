import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";

export interface SpendingLimit {
  id: string;
  name: string;
  limit_amount: number;
  period: "daily" | "weekly" | "monthly";
  category?: string; // Optional: limit for specific category
  current_spending: number;
  period_start: number;
  period_end: number;
  alert_threshold: number; // Percentage (e.g., 80 for 80%)
  alert_sent: boolean;
  exceeded_alert_sent: boolean;
  is_active: boolean;
  created_at: number;
}

const LIMITS_STORAGE_KEY = "spending_limits";
const TRANSACTIONS_TRACKER_KEY = "spending_tracker";

/**
 * Get all spending limits
 */
export async function getSpendingLimits(): Promise<SpendingLimit[]> {
  try {
    const limitsJson = await AsyncStorage.getItem(LIMITS_STORAGE_KEY);
    if (!limitsJson) return [];
    return JSON.parse(limitsJson);
  } catch (error) {
    console.error("Failed to get spending limits:", error);
    return [];
  }
}

/**
 * Save spending limits
 */
async function saveSpendingLimits(limits: SpendingLimit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LIMITS_STORAGE_KEY, JSON.stringify(limits));
  } catch (error) {
    console.error("Failed to save spending limits:", error);
    throw error;
  }
}

/**
 * Calculate period dates
 */
function calculatePeriodDates(period: "daily" | "weekly" | "monthly"): { start: number; end: number } {
  const now = new Date();
  let start: Date;
  let end: Date;
  
  switch (period) {
    case "daily":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case "weekly":
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
  }
  
  return {
    start: start.getTime(),
    end: end.getTime(),
  };
}

/**
 * Create spending limit
 */
export async function createSpendingLimit(
  limit: Omit<SpendingLimit, "id" | "current_spending" | "period_start" | "period_end" | "alert_sent" | "exceeded_alert_sent" | "created_at">
): Promise<SpendingLimit> {
  const limits = await getSpendingLimits();
  
  const { start, end } = calculatePeriodDates(limit.period);
  
  const newLimit: SpendingLimit = {
    ...limit,
    id: `limit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    current_spending: 0,
    period_start: start,
    period_end: end,
    alert_sent: false,
    exceeded_alert_sent: false,
    created_at: Date.now(),
  };
  
  limits.push(newLimit);
  await saveSpendingLimits(limits);
  
  return newLimit;
}

/**
 * Update spending limit
 */
export async function updateSpendingLimit(
  limitId: string,
  updates: Partial<SpendingLimit>
): Promise<SpendingLimit | null> {
  const limits = await getSpendingLimits();
  const index = limits.findIndex((l) => l.id === limitId);
  
  if (index === -1) return null;
  
  limits[index] = { ...limits[index], ...updates };
  await saveSpendingLimits(limits);
  
  return limits[index];
}

/**
 * Delete spending limit
 */
export async function deleteSpendingLimit(limitId: string): Promise<boolean> {
  const limits = await getSpendingLimits();
  const filtered = limits.filter((l) => l.id !== limitId);
  
  if (filtered.length === limits.length) return false;
  
  await saveSpendingLimits(filtered);
  return true;
}

/**
 * Track transaction against limits
 */
export async function trackTransaction(
  amount: number,
  category?: string
): Promise<{
  alerts: Array<{ limit: SpendingLimit; type: "approaching" | "exceeded" }>;
}> {
  const limits = await getSpendingLimits();
  const now = Date.now();
  const alerts: Array<{ limit: SpendingLimit; type: "approaching" | "exceeded" }> = [];
  
  for (const limit of limits) {
    if (!limit.is_active) continue;
    
    // Check if limit applies to this transaction
    if (limit.category && limit.category !== category) continue;
    
    // Check if period needs reset
    if (now > limit.period_end) {
      const { start, end } = calculatePeriodDates(limit.period);
      limit.period_start = start;
      limit.period_end = end;
      limit.current_spending = 0;
      limit.alert_sent = false;
      limit.exceeded_alert_sent = false;
    }
    
    // Add transaction to current spending
    limit.current_spending += amount;
    
    // Check thresholds
    const percentageUsed = (limit.current_spending / limit.limit_amount) * 100;
    
    // Approaching threshold alert
    if (percentageUsed >= limit.alert_threshold && !limit.alert_sent) {
      limit.alert_sent = true;
      alerts.push({ limit, type: "approaching" });
      
      await sendApproachingAlert(limit, percentageUsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    // Exceeded alert
    if (percentageUsed >= 100 && !limit.exceeded_alert_sent) {
      limit.exceeded_alert_sent = true;
      alerts.push({ limit, type: "exceeded" });
      
      await sendExceededAlert(limit);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }
  
  await saveSpendingLimits(limits);
  
  return { alerts };
}

/**
 * Send approaching threshold alert
 */
async function sendApproachingAlert(limit: SpendingLimit, percentageUsed: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Spending Alert",
      body: `You've used ${percentageUsed.toFixed(0)}% of your ${limit.period} ${limit.name} limit ($${limit.current_spending.toFixed(2)} of $${limit.limit_amount.toFixed(2)})`,
      data: {
        type: "spending_approaching",
        limit_id: limit.id,
      },
    },
    trigger: null, // Send immediately
  });
}

/**
 * Send exceeded alert
 */
async function sendExceededAlert(limit: SpendingLimit): Promise<void> {
  const overAmount = limit.current_spending - limit.limit_amount;
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Spending Limit Exceeded",
      body: `You've exceeded your ${limit.period} ${limit.name} limit by $${overAmount.toFixed(2)}`,
      data: {
        type: "spending_exceeded",
        limit_id: limit.id,
      },
    },
    trigger: null,
  });
}

/**
 * Get active limits
 */
export async function getActiveLimits(): Promise<SpendingLimit[]> {
  const limits = await getSpendingLimits();
  return limits.filter((l) => l.is_active);
}

/**
 * Get limits by period
 */
export async function getLimitsByPeriod(period: "daily" | "weekly" | "monthly"): Promise<SpendingLimit[]> {
  const limits = await getSpendingLimits();
  return limits.filter((l) => l.period === period);
}

/**
 * Get limits approaching threshold
 */
export async function getLimitsApproachingThreshold(): Promise<SpendingLimit[]> {
  const limits = await getActiveLimits();
  return limits.filter((l) => {
    const percentageUsed = (l.current_spending / l.limit_amount) * 100;
    return percentageUsed >= l.alert_threshold && percentageUsed < 100;
  });
}

/**
 * Get exceeded limits
 */
export async function getExceededLimits(): Promise<SpendingLimit[]> {
  const limits = await getActiveLimits();
  return limits.filter((l) => l.current_spending >= l.limit_amount);
}

/**
 * Reset limit period
 */
export async function resetLimitPeriod(limitId: string): Promise<boolean> {
  const limits = await getSpendingLimits();
  const limit = limits.find((l) => l.id === limitId);
  
  if (!limit) return false;
  
  const { start, end } = calculatePeriodDates(limit.period);
  
  limit.period_start = start;
  limit.period_end = end;
  limit.current_spending = 0;
  limit.alert_sent = false;
  limit.exceeded_alert_sent = false;
  
  await saveSpendingLimits(limits);
  
  return true;
}

/**
 * Check and reset expired periods
 */
export async function checkAndResetExpiredPeriods(): Promise<number> {
  const limits = await getSpendingLimits();
  const now = Date.now();
  let resetCount = 0;
  
  for (const limit of limits) {
    if (now > limit.period_end) {
      const { start, end } = calculatePeriodDates(limit.period);
      limit.period_start = start;
      limit.period_end = end;
      limit.current_spending = 0;
      limit.alert_sent = false;
      limit.exceeded_alert_sent = false;
      resetCount++;
    }
  }
  
  if (resetCount > 0) {
    await saveSpendingLimits(limits);
  }
  
  return resetCount;
}

/**
 * Get spending limit statistics
 */
export async function getSpendingLimitStatistics(): Promise<{
  total: number;
  active: number;
  approaching: number;
  exceeded: number;
  total_limit_amount: number;
  total_current_spending: number;
  average_usage_percentage: number;
}> {
  const limits = await getSpendingLimits();
  const active = limits.filter((l) => l.is_active);
  const approaching = await getLimitsApproachingThreshold();
  const exceeded = await getExceededLimits();
  
  const totalLimitAmount = active.reduce((sum, l) => sum + l.limit_amount, 0);
  const totalCurrentSpending = active.reduce((sum, l) => sum + l.current_spending, 0);
  const averageUsage = active.length > 0
    ? active.reduce((sum, l) => sum + (l.current_spending / l.limit_amount) * 100, 0) / active.length
    : 0;
  
  return {
    total: limits.length,
    active: active.length,
    approaching: approaching.length,
    exceeded: exceeded.length,
    total_limit_amount: totalLimitAmount,
    total_current_spending: totalCurrentSpending,
    average_usage_percentage: averageUsage,
  };
}

/**
 * Get remaining budget for a limit
 */
export function getRemainingBudget(limit: SpendingLimit): number {
  return Math.max(0, limit.limit_amount - limit.current_spending);
}

/**
 * Get usage percentage for a limit
 */
export function getUsagePercentage(limit: SpendingLimit): number {
  return Math.min(100, (limit.current_spending / limit.limit_amount) * 100);
}

/**
 * Check if transaction would exceed limit
 */
export async function wouldExceedLimit(
  amount: number,
  category?: string
): Promise<{
  would_exceed: boolean;
  affected_limits: SpendingLimit[];
}> {
  const limits = await getActiveLimits();
  const affectedLimits: SpendingLimit[] = [];
  
  for (const limit of limits) {
    if (limit.category && limit.category !== category) continue;
    
    if (limit.current_spending + amount > limit.limit_amount) {
      affectedLimits.push(limit);
    }
  }
  
  return {
    would_exceed: affectedLimits.length > 0,
    affected_limits: affectedLimits,
  };
}

/**
 * Get period display name
 */
export function getPeriodDisplayName(period: "daily" | "weekly" | "monthly"): string {
  switch (period) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
  }
}

/**
 * Get time remaining in period
 */
export function getTimeRemainingInPeriod(limit: SpendingLimit): string {
  const now = Date.now();
  const remaining = limit.period_end - now;
  
  if (remaining < 0) return "Expired";
  
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} remaining`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} remaining`;
  } else {
    return "Less than 1 hour remaining";
  }
}
