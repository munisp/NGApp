import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface Subscription {
  id: string;
  name: string;
  category:
    | "streaming"
    | "music"
    | "software"
    | "gaming"
    | "fitness"
    | "news"
    | "cloud_storage"
    | "other";
  cost: number;
  billingCycle: "weekly" | "monthly" | "quarterly" | "yearly";
  nextBillingDate: number;
  status: "active" | "paused" | "cancelled";
  autoRenew: boolean;
  lastUsed?: number;
  notes?: string;
  paymentMethod?: string;
}

export interface SubscriptionAlert {
  id: string;
  subscriptionId: string;
  type: "renewal" | "price_change" | "unused" | "cancellation";
  message: string;
  date: number;
  acknowledged: boolean;
}

const SUBSCRIPTIONS_KEY = "subscriptions";
const ALERTS_KEY = "subscription_alerts";

/**
 * Save subscriptions
 */
export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
  } catch (error) {
    console.error("Failed to save subscriptions:", error);
    throw error;
  }
}

/**
 * Load subscriptions
 */
export async function loadSubscriptions(): Promise<Subscription[]> {
  try {
    const data = await AsyncStorage.getItem(SUBSCRIPTIONS_KEY);
    return data ? JSON.parse(data) : getMockSubscriptions();
  } catch (error) {
    console.error("Failed to load subscriptions:", error);
    return getMockSubscriptions();
  }
}

/**
 * Get mock subscriptions for demonstration
 */
function getMockSubscriptions(): Subscription[] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneMonth = 30 * oneDay;

  return [
    {
      id: "1",
      name: "Netflix",
      category: "streaming",
      cost: 15.99,
      billingCycle: "monthly",
      nextBillingDate: now + 5 * oneDay,
      status: "active",
      autoRenew: true,
      lastUsed: now - 2 * oneDay,
    },
    {
      id: "2",
      name: "Spotify Premium",
      category: "music",
      cost: 9.99,
      billingCycle: "monthly",
      nextBillingDate: now + 10 * oneDay,
      status: "active",
      autoRenew: true,
      lastUsed: now - oneDay,
    },
    {
      id: "3",
      name: "Adobe Creative Cloud",
      category: "software",
      cost: 54.99,
      billingCycle: "monthly",
      nextBillingDate: now + 15 * oneDay,
      status: "active",
      autoRenew: true,
      lastUsed: now - 35 * oneDay, // Unused for over 30 days
    },
    {
      id: "4",
      name: "Planet Fitness",
      category: "fitness",
      cost: 22.99,
      billingCycle: "monthly",
      nextBillingDate: now + 20 * oneDay,
      status: "active",
      autoRenew: true,
      lastUsed: now - 40 * oneDay, // Unused for over 30 days
    },
  ];
}

/**
 * Add or update subscription
 */
export async function saveSubscription(subscription: Subscription): Promise<void> {
  try {
    const subscriptions = await loadSubscriptions();
    const index = subscriptions.findIndex((s) => s.id === subscription.id);

    if (index >= 0) {
      subscriptions[index] = subscription;
    } else {
      subscriptions.push(subscription);
    }

    await saveSubscriptions(subscriptions);
    await scheduleRenewalReminder(subscription);
  } catch (error) {
    console.error("Failed to save subscription:", error);
    throw error;
  }
}

/**
 * Delete subscription
 */
export async function deleteSubscription(subscriptionId: string): Promise<void> {
  try {
    const subscriptions = await loadSubscriptions();
    const filtered = subscriptions.filter((s) => s.id !== subscriptionId);
    await saveSubscriptions(filtered);
    await cancelRenewalReminder(subscriptionId);
  } catch (error) {
    console.error("Failed to delete subscription:", error);
    throw error;
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
  try {
    const subscriptions = await loadSubscriptions();
    return subscriptions.find((s) => s.id === subscriptionId) || null;
  } catch (error) {
    console.error("Failed to get subscription:", error);
    return null;
  }
}

/**
 * Get subscriptions by category
 */
export async function getSubscriptionsByCategory(
  category: Subscription["category"]
): Promise<Subscription[]> {
  try {
    const subscriptions = await loadSubscriptions();
    return subscriptions.filter((s) => s.category === category);
  } catch (error) {
    console.error("Failed to get subscriptions by category:", error);
    return [];
  }
}

/**
 * Calculate monthly cost
 */
export function calculateMonthlyCost(subscription: Subscription): number {
  const multipliers = {
    weekly: 4.33,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  };

  return subscription.cost * multipliers[subscription.billingCycle];
}

/**
 * Calculate annual cost
 */
export function calculateAnnualCost(subscription: Subscription): number {
  const multipliers = {
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    yearly: 1,
  };

  return subscription.cost * multipliers[subscription.billingCycle];
}

/**
 * Calculate total monthly spending
 */
export async function calculateTotalMonthlySpending(): Promise<number> {
  try {
    const subscriptions = await loadSubscriptions();
    return subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + calculateMonthlyCost(s), 0);
  } catch (error) {
    console.error("Failed to calculate total monthly spending:", error);
    return 0;
  }
}

/**
 * Calculate total annual spending
 */
export async function calculateTotalAnnualSpending(): Promise<number> {
  try {
    const subscriptions = await loadSubscriptions();
    return subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + calculateAnnualCost(s), 0);
  } catch (error) {
    console.error("Failed to calculate total annual spending:", error);
    return 0;
  }
}

/**
 * Get spending by category
 */
export async function getSpendingByCategory(): Promise<Record<string, number>> {
  try {
    const subscriptions = await loadSubscriptions();
    const spending: Record<string, number> = {};

    subscriptions
      .filter((s) => s.status === "active")
      .forEach((s) => {
        const monthlyCost = calculateMonthlyCost(s);
        spending[s.category] = (spending[s.category] || 0) + monthlyCost;
      });

    return spending;
  } catch (error) {
    console.error("Failed to get spending by category:", error);
    return {};
  }
}

/**
 * Detect unused subscriptions (not used in 30+ days)
 */
export async function detectUnusedSubscriptions(): Promise<Subscription[]> {
  try {
    const subscriptions = await loadSubscriptions();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return subscriptions.filter(
      (s) =>
        s.status === "active" && s.lastUsed && s.lastUsed < thirtyDaysAgo
    );
  } catch (error) {
    console.error("Failed to detect unused subscriptions:", error);
    return [];
  }
}

/**
 * Get upcoming renewals (within next 7 days)
 */
export async function getUpcomingRenewals(): Promise<Subscription[]> {
  try {
    const subscriptions = await loadSubscriptions();
    const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return subscriptions.filter(
      (s) =>
        s.status === "active" &&
        s.nextBillingDate <= sevenDaysFromNow &&
        s.nextBillingDate > Date.now()
    );
  } catch (error) {
    console.error("Failed to get upcoming renewals:", error);
    return [];
  }
}

/**
 * Schedule renewal reminder notification
 */
async function scheduleRenewalReminder(subscription: Subscription): Promise<void> {
  try {
    const daysBeforeRenewal = 3; // Remind 3 days before renewal
    const reminderDate = new Date(
      subscription.nextBillingDate - daysBeforeRenewal * 24 * 60 * 60 * 1000
    );

    if (reminderDate.getTime() > Date.now() && subscription.status === "active") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Subscription Renewal Reminder",
          body: `${subscription.name} renews in ${daysBeforeRenewal} days ($${subscription.cost})`,
          data: { subscriptionId: subscription.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });
    }
  } catch (error) {
    console.error("Failed to schedule renewal reminder:", error);
  }
}

/**
 * Cancel renewal reminder
 */
async function cancelRenewalReminder(subscriptionId: string): Promise<void> {
  try {
    // In a real app, you would track notification IDs and cancel them here
    console.log(`Cancelled renewal reminder for subscription ${subscriptionId}`);
  } catch (error) {
    console.error("Failed to cancel renewal reminder:", error);
  }
}

/**
 * Save alerts
 */
export async function saveAlerts(alerts: SubscriptionAlert[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch (error) {
    console.error("Failed to save alerts:", error);
    throw error;
  }
}

/**
 * Load alerts
 */
export async function loadAlerts(): Promise<SubscriptionAlert[]> {
  try {
    const data = await AsyncStorage.getItem(ALERTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load alerts:", error);
    return [];
  }
}

/**
 * Generate alerts for subscriptions
 */
export async function generateAlerts(): Promise<SubscriptionAlert[]> {
  try {
    const subscriptions = await loadSubscriptions();
    const alerts: SubscriptionAlert[]= [];

    // Check for upcoming renewals
    const upcoming = await getUpcomingRenewals();
    upcoming.forEach((sub) => {
      const daysUntil = Math.ceil(
        (sub.nextBillingDate - Date.now()) / (24 * 60 * 60 * 1000)
      );
      alerts.push({
        id: `renewal-${sub.id}`,
        subscriptionId: sub.id,
        type: "renewal",
        message: `${sub.name} renews in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`,
        date: Date.now(),
        acknowledged: false,
      });
    });

    // Check for unused subscriptions
    const unused = await detectUnusedSubscriptions();
    unused.forEach((sub) => {
      const daysUnused = Math.floor(
        (Date.now() - (sub.lastUsed || 0)) / (24 * 60 * 60 * 1000)
      );
      alerts.push({
        id: `unused-${sub.id}`,
        subscriptionId: sub.id,
        type: "unused",
        message: `${sub.name} hasn't been used in ${daysUnused} days`,
        date: Date.now(),
        acknowledged: false,
      });
    });

    return alerts;
  } catch (error) {
    console.error("Failed to generate alerts:", error);
    return [];
  }
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  try {
    const alerts = await loadAlerts();
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      await saveAlerts(alerts);
    }
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
  }
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: Subscription["category"]): string {
  const icons: Record<Subscription["category"], string> = {
    streaming: "📺",
    music: "🎵",
    software: "💻",
    gaming: "🎮",
    fitness: "💪",
    news: "📰",
    cloud_storage: "☁️",
    other: "📦",
  };

  return icons[category] || "📦";
}

/**
 * Get category label
 */
export function getCategoryLabel(category: Subscription["category"]): string {
  const labels: Record<Subscription["category"], string> = {
    streaming: "Streaming",
    music: "Music",
    software: "Software",
    gaming: "Gaming",
    fitness: "Fitness",
    news: "News",
    cloud_storage: "Cloud Storage",
    other: "Other",
  };

  return labels[category] || "Other";
}

/**
 * Get status color
 */
export function getStatusColor(status: Subscription["status"], colors: any): string {
  const statusColors: Record<Subscription["status"], string> = {
    active: colors.success,
    paused: colors.warning,
    cancelled: colors.error,
  };

  return statusColors[status] || colors.muted;
}

/**
 * Find alternative services
 */
export interface AlternativeService {
  name: string;
  cost: number;
  features: string[];
  savings: number;
}

export async function findAlternatives(
  subscriptionId: string
): Promise<AlternativeService[]> {
  try {
    const subscription = await getSubscriptionById(subscriptionId);
    if (!subscription) return [];

    // Mock alternatives based on category
    const alternatives: Record<string, AlternativeService[]> = {
      streaming: [
        {
          name: "Hulu",
          cost: 7.99,
          features: ["Ad-supported", "Live TV option", "Original content"],
          savings: subscription.cost - 7.99,
        },
        {
          name: "Disney+",
          cost: 7.99,
          features: ["Family-friendly", "Marvel & Star Wars", "4K streaming"],
          savings: subscription.cost - 7.99,
        },
      ],
      music: [
        {
          name: "Apple Music",
          cost: 10.99,
          features: ["Lossless audio", "Spatial audio", "100M+ songs"],
          savings: subscription.cost - 10.99,
        },
        {
          name: "YouTube Music",
          cost: 9.99,
          features: ["Music videos", "YouTube integration", "Offline playback"],
          savings: subscription.cost - 9.99,
        },
      ],
      software: [
        {
          name: "Canva Pro",
          cost: 12.99,
          features: ["Design templates", "Brand kit", "Team collaboration"],
          savings: subscription.cost - 12.99,
        },
      ],
    };

    return alternatives[subscription.category] || [];
  } catch (error) {
    console.error("Failed to find alternatives:", error);
    return [];
  }
}
