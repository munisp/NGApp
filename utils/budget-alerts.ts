import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface BudgetAlert {
  id: string;
  category: string;
  budget: number;
  spent: number;
  threshold: number; // percentage (e.g., 80 for 80%)
  alert_type: "approaching" | "exceeded";
  timestamp: number;
  acknowledged: boolean;
}

export interface BudgetAlertSettings {
  enabled: boolean;
  threshold_percentage: number; // default 80%
  notify_on_approach: boolean;
  notify_on_exceed: boolean;
  notification_frequency: "realtime" | "daily" | "weekly";
}

const BUDGET_ALERTS_STORAGE_KEY = "budget_alerts";
const ALERT_SETTINGS_STORAGE_KEY = "budget_alert_settings";

const DEFAULT_SETTINGS: BudgetAlertSettings = {
  enabled: true,
  threshold_percentage: 80,
  notify_on_approach: true,
  notify_on_exceed: true,
  notification_frequency: "realtime",
};

/**
 * Get budget alert settings
 */
export async function getBudgetAlertSettings(): Promise<BudgetAlertSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(ALERT_SETTINGS_STORAGE_KEY);
    if (!settingsJson) {
      await AsyncStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error("Failed to get budget alert settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update budget alert settings
 */
export async function updateBudgetAlertSettings(
  settings: Partial<BudgetAlertSettings>
): Promise<boolean> {
  try {
    const currentSettings = await getBudgetAlertSettings();
    const newSettings = { ...currentSettings, ...settings };
    
    await AsyncStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    
    return true;
  } catch (error) {
    console.error("Failed to update budget alert settings:", error);
    return false;
  }
}

/**
 * Check budget and create alerts if needed
 */
export async function checkBudgetAndAlert(
  category: string,
  budget: number,
  spent: number
): Promise<BudgetAlert | null> {
  try {
    const settings = await getBudgetAlertSettings();
    
    if (!settings.enabled) return null;
    
    const percentage = (spent / budget) * 100;
    
    let alertType: "approaching" | "exceeded" | null = null;
    
    // Check if exceeded
    if (percentage >= 100 && settings.notify_on_exceed) {
      alertType = "exceeded";
    }
    // Check if approaching threshold
    else if (
      percentage >= settings.threshold_percentage &&
      percentage < 100 &&
      settings.notify_on_approach
    ) {
      alertType = "approaching";
    }
    
    if (!alertType) return null;
    
    // Create alert
    const alert: BudgetAlert = {
      id: `alert_${Date.now()}`,
      category,
      budget,
      spent,
      threshold: settings.threshold_percentage,
      alert_type: alertType,
      timestamp: Date.now(),
      acknowledged: false,
    };
    
    // Save alert
    await saveAlert(alert);
    
    // Send notification
    if (settings.notification_frequency === "realtime") {
      await sendBudgetNotification(alert);
    }
    
    return alert;
  } catch (error) {
    console.error("Failed to check budget and alert:", error);
    return null;
  }
}

/**
 * Save budget alert
 */
async function saveAlert(alert: BudgetAlert): Promise<boolean> {
  try {
    const alertsJson = await AsyncStorage.getItem(BUDGET_ALERTS_STORAGE_KEY);
    const alerts: BudgetAlert[] = alertsJson ? JSON.parse(alertsJson) : [];
    
    // Check if similar alert already exists (same category, same type, within last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const existingAlert = alerts.find(
      (a) =>
        a.category === alert.category &&
        a.alert_type === alert.alert_type &&
        a.timestamp > oneHourAgo &&
        !a.acknowledged
    );
    
    if (existingAlert) {
      // Update existing alert
      existingAlert.spent = alert.spent;
      existingAlert.timestamp = alert.timestamp;
    } else {
      // Add new alert
      alerts.push(alert);
    }
    
    // Keep only last 100 alerts
    if (alerts.length > 100) {
      alerts.splice(0, alerts.length - 100);
    }
    
    await AsyncStorage.setItem(BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    
    return true;
  } catch (error) {
    console.error("Failed to save alert:", error);
    return false;
  }
}

/**
 * Send budget notification
 */
async function sendBudgetNotification(alert: BudgetAlert): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    
    let title = "";
    let body = "";
    
    if (alert.alert_type === "approaching") {
      title = `Budget Alert: ${alert.category}`;
      body = `You've spent $${alert.spent.toFixed(2)} of $${alert.budget.toFixed(
        2
      )} (${((alert.spent / alert.budget) * 100).toFixed(0)}%)`;
    } else {
      title = `Budget Exceeded: ${alert.category}`;
      body = `You've exceeded your budget! Spent $${alert.spent.toFixed(
        2
      )} of $${alert.budget.toFixed(2)}`;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { alert_id: alert.id, category: alert.category },
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.error("Failed to send budget notification:", error);
  }
}

/**
 * Get all budget alerts
 */
export async function getBudgetAlerts(): Promise<BudgetAlert[]> {
  try {
    const alertsJson = await AsyncStorage.getItem(BUDGET_ALERTS_STORAGE_KEY);
    if (!alertsJson) return [];
    
    const alerts: BudgetAlert[] = JSON.parse(alertsJson);
    
    // Sort by timestamp descending
    alerts.sort((a, b) => b.timestamp - a.timestamp);
    
    return alerts;
  } catch (error) {
    console.error("Failed to get budget alerts:", error);
    return [];
  }
}

/**
 * Get unacknowledged alerts
 */
export async function getUnacknowledgedAlerts(): Promise<BudgetAlert[]> {
  const alerts = await getBudgetAlerts();
  return alerts.filter((a) => !a.acknowledged);
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  try {
    const alerts = await getBudgetAlerts();
    const alert = alerts.find((a) => a.id === alertId);
    
    if (!alert) return false;
    
    alert.acknowledged = true;
    
    await AsyncStorage.setItem(BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    
    return true;
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return false;
  }
}

/**
 * Acknowledge all alerts
 */
export async function acknowledgeAllAlerts(): Promise<boolean> {
  try {
    const alerts = await getBudgetAlerts();
    
    for (const alert of alerts) {
      alert.acknowledged = true;
    }
    
    await AsyncStorage.setItem(BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    
    return true;
  } catch (error) {
    console.error("Failed to acknowledge all alerts:", error);
    return false;
  }
}

/**
 * Delete alert
 */
export async function deleteAlert(alertId: string): Promise<boolean> {
  try {
    const alerts = await getBudgetAlerts();
    const filtered = alerts.filter((a) => a.id !== alertId);
    
    await AsyncStorage.setItem(BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error("Failed to delete alert:", error);
    return false;
  }
}

/**
 * Clear all alerts
 */
export async function clearAllAlerts(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(BUDGET_ALERTS_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear all alerts:", error);
    return false;
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStatistics(): Promise<{
  total_alerts: number;
  unacknowledged: number;
  approaching: number;
  exceeded: number;
  by_category: Record<string, number>;
}> {
  const alerts = await getBudgetAlerts();
  
  const stats = {
    total_alerts: alerts.length,
    unacknowledged: 0,
    approaching: 0,
    exceeded: 0,
    by_category: {} as Record<string, number>,
  };
  
  for (const alert of alerts) {
    if (!alert.acknowledged) stats.unacknowledged++;
    
    if (alert.alert_type === "approaching") stats.approaching++;
    else stats.exceeded++;
    
    stats.by_category[alert.category] = (stats.by_category[alert.category] || 0) + 1;
  }
  
  return stats;
}

/**
 * Get alerts by category
 */
export async function getAlertsByCategory(category: string): Promise<BudgetAlert[]> {
  const alerts = await getBudgetAlerts();
  return alerts.filter((a) => a.category === category);
}

/**
 * Get alerts by type
 */
export async function getAlertsByType(
  type: "approaching" | "exceeded"
): Promise<BudgetAlert[]> {
  const alerts = await getBudgetAlerts();
  return alerts.filter((a) => a.alert_type === type);
}

/**
 * Format alert message
 */
export function formatAlertMessage(alert: BudgetAlert): string {
  const percentage = ((alert.spent / alert.budget) * 100).toFixed(0);
  
  if (alert.alert_type === "approaching") {
    return `You've spent ${percentage}% of your ${alert.category} budget ($${alert.spent.toFixed(
      2
    )} of $${alert.budget.toFixed(2)})`;
  } else {
    return `You've exceeded your ${alert.category} budget! Spent $${alert.spent.toFixed(
      2
    )} of $${alert.budget.toFixed(2)} (${percentage}%)`;
  }
}

/**
 * Check all budgets and send daily summary
 */
export async function sendDailySummary(
  budgets: Array<{ category: string; budget: number; spent: number }>
): Promise<boolean> {
  try {
    const settings = await getBudgetAlertSettings();
    
    if (!settings.enabled || settings.notification_frequency !== "daily") {
      return false;
    }
    
    let alertCount = 0;
    
    for (const { category, budget, spent } of budgets) {
      const percentage = (spent / budget) * 100;
      
      if (percentage >= settings.threshold_percentage) {
        alertCount++;
      }
    }
    
    if (alertCount === 0) return false;
    
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return false;
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily Budget Summary",
        body: `${alertCount} budget${alertCount > 1 ? "s" : ""} need${
          alertCount === 1 ? "s" : ""
        } your attention`,
      },
      trigger: null,
    });
    
    return true;
  } catch (error) {
    console.error("Failed to send daily summary:", error);
    return false;
  }
}
