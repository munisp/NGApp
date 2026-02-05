import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export interface NotificationAlert {
  id: string;
  type: "stock_price" | "loyalty_reward" | "health_score" | "transaction" | "bill_due" | "goal_milestone";
  title: string;
  body: string;
  data: any;
  timestamp: number;
  read: boolean;
}

export interface NotificationPreferences {
  stockPriceAlerts: boolean;
  loyaltyRewards: boolean;
  healthScoreChanges: boolean;
  transactions: boolean;
  billDue: boolean;
  goalMilestones: boolean;
  pushEnabled: boolean;
}

export interface StockPriceAlert {
  symbol: string;
  targetPrice: number;
  condition: "above" | "below";
  enabled: boolean;
}

const ALERTS_KEY = "@notification_alerts";
const PREFERENCES_KEY = "@notification_preferences";
const STOCK_ALERTS_KEY = "@stock_price_alerts";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

export async function getNotificationAlerts(): Promise<NotificationAlert[]> {
  const data = await AsyncStorage.getItem(ALERTS_KEY);
  if (!data) return [];
  return JSON.parse(data).sort((a: NotificationAlert, b: NotificationAlert) => b.timestamp - a.timestamp);
}

export async function addNotificationAlert(alert: Omit<NotificationAlert, "id" | "timestamp" | "read">): Promise<void> {
  const alerts = await getNotificationAlerts();
  
  const newAlert: NotificationAlert = {
    ...alert,
    id: Date.now().toString(),
    timestamp: Date.now(),
    read: false,
  };

  alerts.unshift(newAlert);
  
  // Keep only last 100 alerts
  if (alerts.length > 100) {
    alerts.splice(100);
  }

  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));

  // Send push notification
  await sendPushNotification(newAlert.title, newAlert.body, newAlert.data);
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  const alerts = await getNotificationAlerts();
  const alert = alerts.find((a) => a.id === alertId);
  
  if (alert) {
    alert.read = true;
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }
}

export async function markAllAlertsAsRead(): Promise<void> {
  const alerts = await getNotificationAlerts();
  alerts.forEach((alert) => (alert.read = true));
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export async function deleteAlert(alertId: string): Promise<void> {
  const alerts = await getNotificationAlerts();
  const filtered = alerts.filter((a) => a.id !== alertId);
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(filtered));
}

export async function clearAllAlerts(): Promise<void> {
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify([]));
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const data = await AsyncStorage.getItem(PREFERENCES_KEY);
  if (!data) {
    const defaultPrefs: NotificationPreferences = {
      stockPriceAlerts: true,
      loyaltyRewards: true,
      healthScoreChanges: true,
      transactions: true,
      billDue: true,
      goalMilestones: true,
      pushEnabled: true,
    };
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(defaultPrefs));
    return defaultPrefs;
  }
  return JSON.parse(data);
}

export async function updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
  const current = await getNotificationPreferences();
  const updated = { ...current, ...preferences };
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
}

export async function getStockPriceAlerts(): Promise<StockPriceAlert[]> {
  const data = await AsyncStorage.getItem(STOCK_ALERTS_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export async function addStockPriceAlert(alert: StockPriceAlert): Promise<void> {
  const alerts = await getStockPriceAlerts();
  alerts.push(alert);
  await AsyncStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(alerts));
}

export async function removeStockPriceAlert(symbol: string): Promise<void> {
  const alerts = await getStockPriceAlerts();
  const filtered = alerts.filter((a) => a.symbol !== symbol);
  await AsyncStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(filtered));
}

export async function updateStockPriceAlert(symbol: string, updates: Partial<StockPriceAlert>): Promise<void> {
  const alerts = await getStockPriceAlerts();
  const alert = alerts.find((a) => a.symbol === symbol);
  
  if (alert) {
    Object.assign(alert, updates);
    await AsyncStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(alerts));
  }
}

export async function checkStockPriceAlerts(symbol: string, currentPrice: number): Promise<void> {
  const alerts = await getStockPriceAlerts();
  const prefs = await getNotificationPreferences();

  if (!prefs.stockPriceAlerts) return;

  for (const alert of alerts) {
    if (alert.symbol === symbol && alert.enabled) {
      const triggered =
        (alert.condition === "above" && currentPrice >= alert.targetPrice) ||
        (alert.condition === "below" && currentPrice <= alert.targetPrice);

      if (triggered) {
        await addNotificationAlert({
          type: "stock_price",
          title: `${symbol} Price Alert`,
          body: `${symbol} is now ${alert.condition} $${alert.targetPrice} at $${currentPrice.toFixed(2)}`,
          data: { symbol, currentPrice, targetPrice: alert.targetPrice },
        });

        // Disable alert after triggering
        alert.enabled = false;
        await AsyncStorage.setItem(STOCK_ALERTS_KEY, JSON.stringify(alerts));
      }
    }
  }
}

export async function sendLoyaltyRewardNotification(rewardName: string, pointsEarned: number): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.loyaltyRewards) return;

  await addNotificationAlert({
    type: "loyalty_reward",
    title: "Loyalty Reward Earned!",
    body: `You earned ${pointsEarned} points from ${rewardName}`,
    data: { rewardName, pointsEarned },
  });
}

export async function sendHealthScoreNotification(oldScore: number, newScore: number): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.healthScoreChanges) return;

  const change = newScore - oldScore;
  const direction = change > 0 ? "increased" : "decreased";

  await addNotificationAlert({
    type: "health_score",
    title: "Financial Health Score Updated",
    body: `Your score ${direction} by ${Math.abs(change).toFixed(1)} points to ${newScore.toFixed(1)}`,
    data: { oldScore, newScore, change },
  });
}

export async function sendTransactionNotification(
  amount: number,
  merchant: string,
  type: "debit" | "credit"
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.transactions) return;

  await addNotificationAlert({
    type: "transaction",
    title: type === "debit" ? "Payment Sent" : "Payment Received",
    body: `${type === "debit" ? "-" : "+"}$${amount.toFixed(2)} ${type === "debit" ? "to" : "from"} ${merchant}`,
    data: { amount, merchant, type },
  });
}

export async function sendBillDueNotification(billName: string, amount: number, dueDate: Date): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.billDue) return;

  const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  await addNotificationAlert({
    type: "bill_due",
    title: "Bill Due Soon",
    body: `${billName} payment of $${amount.toFixed(2)} due in ${daysUntilDue} days`,
    data: { billName, amount, dueDate: dueDate.toISOString(), daysUntilDue },
  });
}

export async function sendGoalMilestoneNotification(
  goalName: string,
  milestone: number,
  currentAmount: number
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.goalMilestones) return;

  await addNotificationAlert({
    type: "goal_milestone",
    title: "Goal Milestone Reached!",
    body: `You've reached ${milestone}% of your ${goalName} goal ($${currentAmount.toFixed(2)})`,
    data: { goalName, milestone, currentAmount },
  });
}

async function sendPushNotification(title: string, body: string, data?: any): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  const prefs = await getNotificationPreferences();
  if (!prefs.pushEnabled) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error("Failed to send push notification:", error);
  }
}

export async function getUnreadCount(): Promise<number> {
  const alerts = await getNotificationAlerts();
  return alerts.filter((a) => !a.read).length;
}

export async function simulateNotifications(): Promise<void> {
  // Simulate various notifications for testing
  await sendTransactionNotification(125.50, "Amazon", "debit");
  await sendLoyaltyRewardNotification("ShopRite", 250);
  await sendHealthScoreNotification(72.5, 75.8);
  await sendBillDueNotification("Electric Bill", 89.99, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  await sendGoalMilestoneNotification("Emergency Fund", 50, 5000);
}
