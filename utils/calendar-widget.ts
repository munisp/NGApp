import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CalendarWidgetEvent {
  id: string;
  title: string;
  type: "bill" | "loan" | "goal" | "payment" | "transfer";
  amount: number;
  date: number;
  status: "upcoming" | "due_today" | "overdue" | "completed";
  icon: string;
  color: string;
}

const WIDGET_DATA_STORAGE_KEY = "calendar_widget_data";
const WIDGET_SETTINGS_STORAGE_KEY = "calendar_widget_settings";

export interface WidgetSettings {
  show_bills: boolean;
  show_loans: boolean;
  show_goals: boolean;
  show_payments: boolean;
  days_ahead: number;
  refresh_interval: number; // minutes
}

const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  show_bills: true,
  show_loans: true,
  show_goals: true,
  show_payments: true,
  days_ahead: 7,
  refresh_interval: 30,
};

/**
 * Get widget settings
 */
export async function getWidgetSettings(): Promise<WidgetSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(WIDGET_SETTINGS_STORAGE_KEY);
    if (!settingsJson) {
      await AsyncStorage.setItem(
        WIDGET_SETTINGS_STORAGE_KEY,
        JSON.stringify(DEFAULT_WIDGET_SETTINGS)
      );
      return DEFAULT_WIDGET_SETTINGS;
    }
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error("Failed to get widget settings:", error);
    return DEFAULT_WIDGET_SETTINGS;
  }
}

/**
 * Update widget settings
 */
export async function updateWidgetSettings(
  settings: Partial<WidgetSettings>
): Promise<boolean> {
  try {
    const currentSettings = await getWidgetSettings();
    const newSettings = { ...currentSettings, ...settings };
    
    await AsyncStorage.setItem(
      WIDGET_SETTINGS_STORAGE_KEY,
      JSON.stringify(newSettings)
    );
    
    // Trigger widget refresh
    await refreshWidgetData();
    
    return true;
  } catch (error) {
    console.error("Failed to update widget settings:", error);
    return false;
  }
}

/**
 * Get upcoming financial events for widget
 */
export async function getWidgetEvents(): Promise<CalendarWidgetEvent[]> {
  try {
    const dataJson = await AsyncStorage.getItem(WIDGET_DATA_STORAGE_KEY);
    if (!dataJson) {
      // Generate initial data
      await refreshWidgetData();
      const newDataJson = await AsyncStorage.getItem(WIDGET_DATA_STORAGE_KEY);
      if (!newDataJson) return [];
      return JSON.parse(newDataJson);
    }
    return JSON.parse(dataJson);
  } catch (error) {
    console.error("Failed to get widget events:", error);
    return [];
  }
}

/**
 * Refresh widget data
 */
export async function refreshWidgetData(): Promise<boolean> {
  try {
    const settings = await getWidgetSettings();
    const events: CalendarWidgetEvent[] = [];
    
    const now = Date.now();
    const daysAheadMs = settings.days_ahead * 24 * 60 * 60 * 1000;
    
    // Generate mock events (in production, fetch from API)
    
    // Bills
    if (settings.show_bills) {
      events.push({
        id: "bill_1",
        title: "Electric Bill",
        type: "bill",
        amount: 120.50,
        date: now + 2 * 24 * 60 * 60 * 1000,
        status: "upcoming",
        icon: "💡",
        color: "#FF8B94",
      });
      
      events.push({
        id: "bill_2",
        title: "Internet Bill",
        type: "bill",
        amount: 79.99,
        date: now + 5 * 24 * 60 * 60 * 1000,
        status: "upcoming",
        icon: "🌐",
        color: "#FF8B94",
      });
    }
    
    // Loans
    if (settings.show_loans) {
      events.push({
        id: "loan_1",
        title: "Car Loan Payment",
        type: "loan",
        amount: 450.00,
        date: now + 3 * 24 * 60 * 60 * 1000,
        status: "upcoming",
        icon: "🚗",
        color: "#FFD3B6",
      });
    }
    
    // Goals
    if (settings.show_goals) {
      events.push({
        id: "goal_1",
        title: "Vacation Savings Milestone",
        type: "goal",
        amount: 500.00,
        date: now + 7 * 24 * 60 * 60 * 1000,
        status: "upcoming",
        icon: "🎯",
        color: "#A8E6CF",
      });
    }
    
    // Payments
    if (settings.show_payments) {
      events.push({
        id: "payment_1",
        title: "Rent Payment",
        type: "payment",
        amount: 1500.00,
        date: now + 1 * 24 * 60 * 60 * 1000,
        status: "due_today",
        icon: "🏠",
        color: "#AA96DA",
      });
    }
    
    // Filter by days ahead
    const filteredEvents = events.filter(
      (event) => event.date <= now + daysAheadMs
    );
    
    // Sort by date
    filteredEvents.sort((a, b) => a.date - b.date);
    
    // Update status based on date
    for (const event of filteredEvents) {
      const daysDiff = (event.date - now) / (24 * 60 * 60 * 1000);
      
      if (daysDiff < 0) {
        event.status = "overdue";
      } else if (daysDiff < 1) {
        event.status = "due_today";
      } else {
        event.status = "upcoming";
      }
    }
    
    await AsyncStorage.setItem(WIDGET_DATA_STORAGE_KEY, JSON.stringify(filteredEvents));
    
    return true;
  } catch (error) {
    console.error("Failed to refresh widget data:", error);
    return false;
  }
}

/**
 * Get events by status
 */
export async function getEventsByStatus(
  status: "upcoming" | "due_today" | "overdue" | "completed"
): Promise<CalendarWidgetEvent[]> {
  const events = await getWidgetEvents();
  return events.filter((e) => e.status === status);
}

/**
 * Get events by type
 */
export async function getEventsByType(
  type: "bill" | "loan" | "goal" | "payment" | "transfer"
): Promise<CalendarWidgetEvent[]> {
  const events = await getWidgetEvents();
  return events.filter((e) => e.type === type);
}

/**
 * Get events for today
 */
export async function getTodayEvents(): Promise<CalendarWidgetEvent[]> {
  const events = await getWidgetEvents();
  const now = Date.now();
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const todayEnd = new Date(now).setHours(23, 59, 59, 999);
  
  return events.filter((e) => e.date >= todayStart && e.date <= todayEnd);
}

/**
 * Get events for this week
 */
export async function getWeekEvents(): Promise<CalendarWidgetEvent[]> {
  const events = await getWidgetEvents();
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  
  return events.filter((e) => e.date >= now && e.date <= weekEnd);
}

/**
 * Get widget summary
 */
export async function getWidgetSummary(): Promise<{
  total_events: number;
  due_today: number;
  overdue: number;
  upcoming: number;
  total_amount_due: number;
}> {
  const events = await getWidgetEvents();
  
  let dueToday = 0;
  let overdue = 0;
  let upcoming = 0;
  let totalAmountDue = 0;
  
  for (const event of events) {
    switch (event.status) {
      case "due_today":
        dueToday++;
        totalAmountDue += event.amount;
        break;
      case "overdue":
        overdue++;
        totalAmountDue += event.amount;
        break;
      case "upcoming":
        upcoming++;
        break;
    }
  }
  
  return {
    total_events: events.length,
    due_today: dueToday,
    overdue: overdue,
    upcoming: upcoming,
    total_amount_due: totalAmountDue,
  };
}

/**
 * Mark event as completed
 */
export async function markEventCompleted(eventId: string): Promise<boolean> {
  try {
    const events = await getWidgetEvents();
    const event = events.find((e) => e.id === eventId);
    
    if (!event) return false;
    
    event.status = "completed";
    
    await AsyncStorage.setItem(WIDGET_DATA_STORAGE_KEY, JSON.stringify(events));
    
    return true;
  } catch (error) {
    console.error("Failed to mark event completed:", error);
    return false;
  }
}

/**
 * Get next event
 */
export async function getNextEvent(): Promise<CalendarWidgetEvent | null> {
  const events = await getWidgetEvents();
  const now = Date.now();
  
  const upcomingEvents = events.filter(
    (e) => e.date >= now && e.status !== "completed"
  );
  
  if (upcomingEvents.length === 0) return null;
  
  return upcomingEvents.sort((a, b) => a.date - b.date)[0];
}

/**
 * Get events grouped by date
 */
export async function getEventsGroupedByDate(): Promise<
  Record<string, CalendarWidgetEvent[]>
> {
  const events = await getWidgetEvents();
  const grouped: Record<string, CalendarWidgetEvent[]> = {};
  
  for (const event of events) {
    const dateKey = new Date(event.date).toLocaleDateString();
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    
    grouped[dateKey].push(event);
  }
  
  return grouped;
}

/**
 * Format event for display
 */
export function formatWidgetEvent(event: CalendarWidgetEvent): {
  title: string;
  subtitle: string;
  amount_text: string;
  date_text: string;
  status_text: string;
  status_color: string;
} {
  const now = Date.now();
  const daysDiff = Math.ceil((event.date - now) / (24 * 60 * 60 * 1000));
  
  let dateText = "";
  if (daysDiff < 0) {
    dateText = `${Math.abs(daysDiff)} days overdue`;
  } else if (daysDiff === 0) {
    dateText = "Due today";
  } else if (daysDiff === 1) {
    dateText = "Due tomorrow";
  } else {
    dateText = `Due in ${daysDiff} days`;
  }
  
  let statusText = "";
  let statusColor = "";
  
  switch (event.status) {
    case "upcoming":
      statusText = "Upcoming";
      statusColor = "#4ECDC4";
      break;
    case "due_today":
      statusText = "Due Today";
      statusColor = "#FFE66D";
      break;
    case "overdue":
      statusText = "Overdue";
      statusColor = "#FF6B6B";
      break;
    case "completed":
      statusText = "Completed";
      statusColor = "#A8E6CF";
      break;
  }
  
  return {
    title: event.title,
    subtitle: event.type.charAt(0).toUpperCase() + event.type.slice(1),
    amount_text: `$${event.amount.toFixed(2)}`,
    date_text: dateText,
    status_text: statusText,
    status_color: statusColor,
  };
}

/**
 * Clear widget data
 */
export async function clearWidgetData(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(WIDGET_DATA_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear widget data:", error);
    return false;
  }
}

/**
 * Reset widget settings to default
 */
export async function resetWidgetSettings(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(
      WIDGET_SETTINGS_STORAGE_KEY,
      JSON.stringify(DEFAULT_WIDGET_SETTINGS)
    );
    await refreshWidgetData();
    return true;
  } catch (error) {
    console.error("Failed to reset widget settings:", error);
    return false;
  }
}
