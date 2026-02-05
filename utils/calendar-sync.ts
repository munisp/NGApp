import * as Calendar from "expo-calendar";
import { Platform, Alert } from "react-native";

export interface FinancialEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  location?: string;
  alarmOffsets?: number[]; // Minutes before event to trigger alarm
}

/**
 * Request calendar permissions
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    Alert.alert(
      "Calendar Sync",
      "Calendar sync is only available on mobile devices"
    );
    return false;
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Calendar permission is required to sync financial events"
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Calendar permission error:", error);
    return false;
  }
}

/**
 * Get or create the financial events calendar
 */
export async function getOrCreateFinancialCalendar(): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    // Look for existing financial calendar
    let financialCalendar = calendars.find(
      (cal) => cal.title === "Financial Events"
    );

    if (!financialCalendar) {
      // Create new calendar
      const defaultCalendarSource =
        Platform.OS === "ios"
          ? await Calendar.getDefaultCalendarAsync()
          : { isLocalAccount: true, name: "Financial Events" };

      const calendarId = await Calendar.createCalendarAsync({
        title: "Financial Events",
        color: "#0a7ea4",
        entityType: Calendar.EntityTypes.EVENT,
        sourceId:
          Platform.OS === "ios"
            ? (defaultCalendarSource as Calendar.Calendar).source.id
            : undefined,
        source:
          Platform.OS === "android"
            ? (defaultCalendarSource as Calendar.Source)
            : undefined,
        name: "financial-events",
        ownerAccount: "personal",
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });

      return calendarId;
    }

    return financialCalendar.id;
  } catch (error) {
    console.error("Get/create calendar error:", error);
    return null;
  }
}

/**
 * Add a financial event to the calendar
 */
export async function addFinancialEventToCalendar(
  event: FinancialEvent
): Promise<boolean> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return false;
    }

    const calendarId = await getOrCreateFinancialCalendar();
    if (!calendarId) {
      Alert.alert("Error", "Failed to access calendar");
      return false;
    }

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      notes: event.notes,
      location: event.location,
      alarms: event.alarmOffsets?.map((offset) => ({
        relativeOffset: -offset,
        method: Calendar.AlarmMethod.ALERT,
      })),
    });

    console.log("Calendar event created:", eventId);
    return true;
  } catch (error) {
    console.error("Add calendar event error:", error);
    Alert.alert("Error", "Failed to add event to calendar");
    return false;
  }
}

/**
 * Add bill payment to calendar
 */
export async function addBillToCalendar(
  billName: string,
  amount: number,
  dueDate: Date,
  reminderDays: number = 3
): Promise<boolean> {
  const event: FinancialEvent = {
    title: `Bill Due: ${billName}`,
    startDate: dueDate,
    endDate: new Date(dueDate.getTime() + 3600000), // 1 hour duration
    notes: `Payment amount: $${amount.toFixed(2)}\n\nRemember to pay your ${billName} bill.`,
    location: "Mobile Banking App",
    alarmOffsets: [reminderDays * 24 * 60, 24 * 60, 60], // N days, 1 day, 1 hour before
  };

  return addFinancialEventToCalendar(event);
}

/**
 * Add loan payment to calendar
 */
export async function addLoanPaymentToCalendar(
  loanName: string,
  amount: number,
  paymentDate: Date
): Promise<boolean> {
  const event: FinancialEvent = {
    title: `Loan Payment: ${loanName}`,
    startDate: paymentDate,
    endDate: new Date(paymentDate.getTime() + 3600000),
    notes: `Payment amount: $${amount.toFixed(2)}\n\nMonthly loan installment due.`,
    location: "Mobile Banking App",
    alarmOffsets: [3 * 24 * 60, 24 * 60], // 3 days and 1 day before
  };

  return addFinancialEventToCalendar(event);
}

/**
 * Add scheduled transfer to calendar
 */
export async function addScheduledTransferToCalendar(
  recipient: string,
  amount: number,
  transferDate: Date,
  description?: string
): Promise<boolean> {
  const event: FinancialEvent = {
    title: `Scheduled Transfer: ${recipient}`,
    startDate: transferDate,
    endDate: new Date(transferDate.getTime() + 1800000), // 30 min duration
    notes: `Amount: $${amount.toFixed(2)}${description ? `\n\n${description}` : ""}`,
    location: "Mobile Banking App",
    alarmOffsets: [60], // 1 hour before
  };

  return addFinancialEventToCalendar(event);
}

/**
 * Add savings goal milestone to calendar
 */
export async function addGoalMilestoneToCalendar(
  goalName: string,
  targetAmount: number,
  targetDate: Date
): Promise<boolean> {
  const event: FinancialEvent = {
    title: `Goal Deadline: ${goalName}`,
    startDate: targetDate,
    endDate: new Date(targetDate.getTime() + 3600000),
    notes: `Target amount: $${targetAmount.toFixed(2)}\n\nSavings goal deadline.`,
    location: "Mobile Banking App",
    alarmOffsets: [7 * 24 * 60, 3 * 24 * 60, 24 * 60], // 7, 3, and 1 day before
  };

  return addFinancialEventToCalendar(event);
}

/**
 * Bulk sync all financial events to calendar
 */
export async function syncAllFinancialEvents(events: {
  bills?: Array<{ name: string; amount: number; dueDate: Date }>;
  loans?: Array<{ name: string; amount: number; paymentDate: Date }>;
  transfers?: Array<{
    recipient: string;
    amount: number;
    date: Date;
    description?: string;
  }>;
  goals?: Array<{ name: string; targetAmount: number; targetDate: Date }>;
}): Promise<{ success: number; failed: number }> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  // Sync bills
  if (events.bills) {
    for (const bill of events.bills) {
      const result = await addBillToCalendar(
        bill.name,
        bill.amount,
        bill.dueDate
      );
      if (result) success++;
      else failed++;
    }
  }

  // Sync loans
  if (events.loans) {
    for (const loan of events.loans) {
      const result = await addLoanPaymentToCalendar(
        loan.name,
        loan.amount,
        loan.paymentDate
      );
      if (result) success++;
      else failed++;
    }
  }

  // Sync transfers
  if (events.transfers) {
    for (const transfer of events.transfers) {
      const result = await addScheduledTransferToCalendar(
        transfer.recipient,
        transfer.amount,
        transfer.date,
        transfer.description
      );
      if (result) success++;
      else failed++;
    }
  }

  // Sync goals
  if (events.goals) {
    for (const goal of events.goals) {
      const result = await addGoalMilestoneToCalendar(
        goal.name,
        goal.targetAmount,
        goal.targetDate
      );
      if (result) success++;
      else failed++;
    }
  }

  return { success, failed };
}
