import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const WIDGET_DATA_KEY = "@widget_data";
const WIDGET_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface WidgetData {
  balance: {
    total: number;
    currency: string;
    lastUpdated: number;
  };
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: "debit" | "credit";
    date: string;
  }>;
  upcomingBills: Array<{
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    status: "pending" | "paid" | "overdue";
  }>;
  lastUpdated: number;
}

/**
 * Update widget data for home screen widgets
 * This data will be read by native widget extensions
 */
export async function updateWidgetData(data: Partial<WidgetData>): Promise<void> {
  try {
    const existingData = await getWidgetData();
    const updatedData: WidgetData = {
      ...existingData,
      ...data,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(updatedData));

    // Trigger native widget update
    if (Platform.OS === "ios") {
      // iOS: Use WidgetKit reload timeline
      // This would typically be done through a native module
      console.log("[Widget] iOS widget data updated");
    } else if (Platform.OS === "android") {
      // Android: Use AppWidgetManager update
      // This would typically be done through a native module
      console.log("[Widget] Android widget data updated");
    }
  } catch (error) {
    console.error("Failed to update widget data:", error);
    throw error;
  }
}

/**
 * Get current widget data
 */
export async function getWidgetData(): Promise<WidgetData> {
  try {
    const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (!data) {
      return getDefaultWidgetData();
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to get widget data:", error);
    return getDefaultWidgetData();
  }
}

/**
 * Get default widget data structure
 */
function getDefaultWidgetData(): WidgetData {
  return {
    balance: {
      total: 0,
      currency: "USD",
      lastUpdated: Date.now(),
    },
    recentTransactions: [],
    upcomingBills: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Update balance widget
 */
export async function updateBalanceWidget(balance: number, currency: string = "USD"): Promise<void> {
  await updateWidgetData({
    balance: {
      total: balance,
      currency,
      lastUpdated: Date.now(),
    },
  });
}

/**
 * Update recent transactions widget
 */
export async function updateTransactionsWidget(
  transactions: WidgetData["recentTransactions"]
): Promise<void> {
  // Limit to 5 most recent transactions
  const recentTransactions = transactions.slice(0, 5);
  await updateWidgetData({ recentTransactions });
}

/**
 * Update upcoming bills widget
 */
export async function updateBillsWidget(bills: WidgetData["upcomingBills"]): Promise<void> {
  // Sort by due date and limit to 5 upcoming bills
  const upcomingBills = bills
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);
  
  await updateWidgetData({ upcomingBills });
}

/**
 * Check if widget data needs update
 */
export async function shouldUpdateWidget(): Promise<boolean> {
  try {
    const data = await getWidgetData();
    const timeSinceUpdate = Date.now() - data.lastUpdated;
    return timeSinceUpdate >= WIDGET_UPDATE_INTERVAL;
  } catch (error) {
    console.error("Failed to check widget update status:", error);
    return true;
  }
}

/**
 * Refresh all widget data
 */
export async function refreshAllWidgets(
  balance: number,
  transactions: WidgetData["recentTransactions"],
  bills: WidgetData["upcomingBills"]
): Promise<void> {
  await updateWidgetData({
    balance: {
      total: balance,
      currency: "USD",
      lastUpdated: Date.now(),
    },
    recentTransactions: transactions.slice(0, 5),
    upcomingBills: bills
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5),
  });
}

/**
 * Clear widget data
 */
export async function clearWidgetData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WIDGET_DATA_KEY);
  } catch (error) {
    console.error("Failed to clear widget data:", error);
  }
}

/**
 * Format currency for widget display
 */
export function formatWidgetCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for widget display
 */
export function formatWidgetDate(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) {
    return "Today";
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

/**
 * Get widget configuration for iOS
 */
export function getIOSWidgetConfig() {
  return {
    kind: "FintechWidget",
    supportedFamilies: ["systemSmall", "systemMedium", "systemLarge"],
    intentType: "ConfigurationIntent",
  };
}

/**
 * Get widget configuration for Android
 */
export function getAndroidWidgetConfig() {
  return {
    minWidth: 180,
    minHeight: 110,
    updatePeriodMillis: WIDGET_UPDATE_INTERVAL,
    resizeMode: "horizontal|vertical",
  };
}
