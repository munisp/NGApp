import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SplitBillParticipant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  amount: number;
  paid: boolean;
  paid_at?: number;
}

export interface SplitBill {
  id: string;
  title: string;
  description?: string;
  total_amount: number;
  currency: string;
  split_type: "equal" | "custom" | "percentage";
  participants: SplitBillParticipant[];
  created_by: string;
  created_at: number;
  status: "pending" | "partially_paid" | "completed" | "cancelled";
  reminder_count: number;
  last_reminder_at?: number;
}

const SPLIT_BILLS_STORAGE_KEY = "split_bills";

/**
 * Create a new split bill
 */
export async function createSplitBill(
  title: string,
  totalAmount: number,
  participants: Omit<SplitBillParticipant, "id" | "amount" | "paid">[],
  splitType: "equal" | "custom" | "percentage" = "equal",
  customAmounts?: number[],
  description?: string,
  currency: string = "USD",
  createdBy: string = "current_user"
): Promise<SplitBill> {
  // Calculate amounts based on split type
  let participantsWithAmounts: SplitBillParticipant[];
  
  if (splitType === "equal") {
    const amountPerPerson = totalAmount / participants.length;
    participantsWithAmounts = participants.map((p, index) => ({
      ...p,
      id: `participant_${Date.now()}_${index}`,
      amount: amountPerPerson,
      paid: false,
    }));
  } else if (splitType === "custom" && customAmounts) {
    participantsWithAmounts = participants.map((p, index) => ({
      ...p,
      id: `participant_${Date.now()}_${index}`,
      amount: customAmounts[index] || 0,
      paid: false,
    }));
  } else {
    // Default to equal if custom amounts not provided
    const amountPerPerson = totalAmount / participants.length;
    participantsWithAmounts = participants.map((p, index) => ({
      ...p,
      id: `participant_${Date.now()}_${index}`,
      amount: amountPerPerson,
      paid: false,
    }));
  }
  
  const bill: SplitBill = {
    id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    description,
    total_amount: totalAmount,
    currency,
    split_type: splitType,
    participants: participantsWithAmounts,
    created_by: createdBy,
    created_at: Date.now(),
    status: "pending",
    reminder_count: 0,
  };
  
  const bills = await getSplitBills();
  bills.push(bill);
  await AsyncStorage.setItem(SPLIT_BILLS_STORAGE_KEY, JSON.stringify(bills));
  
  return bill;
}

/**
 * Get all split bills
 */
export async function getSplitBills(): Promise<SplitBill[]> {
  try {
    const billsJson = await AsyncStorage.getItem(SPLIT_BILLS_STORAGE_KEY);
    if (!billsJson) return [];
    return JSON.parse(billsJson);
  } catch (error) {
    console.error("Failed to get split bills:", error);
    return [];
  }
}

/**
 * Get split bill by ID
 */
export async function getSplitBill(billId: string): Promise<SplitBill | null> {
  const bills = await getSplitBills();
  return bills.find((b) => b.id === billId) || null;
}

/**
 * Mark participant as paid
 */
export async function markParticipantPaid(
  billId: string,
  participantId: string
): Promise<boolean> {
  try {
    const bills = await getSplitBills();
    const bill = bills.find((b) => b.id === billId);
    
    if (!bill) return false;
    
    const participant = bill.participants.find((p) => p.id === participantId);
    if (!participant) return false;
    
    participant.paid = true;
    participant.paid_at = Date.now();
    
    // Update bill status
    const allPaid = bill.participants.every((p) => p.paid);
    const somePaid = bill.participants.some((p) => p.paid);
    
    if (allPaid) {
      bill.status = "completed";
    } else if (somePaid) {
      bill.status = "partially_paid";
    }
    
    await AsyncStorage.setItem(SPLIT_BILLS_STORAGE_KEY, JSON.stringify(bills));
    
    return true;
  } catch (error) {
    console.error("Failed to mark participant as paid:", error);
    return false;
  }
}

/**
 * Send reminder to unpaid participants
 */
export async function sendReminder(billId: string): Promise<{
  success: boolean;
  reminded_count: number;
  error?: string;
}> {
  try {
    const bills = await getSplitBills();
    const bill = bills.find((b) => b.id === billId);
    
    if (!bill) {
      return { success: false, reminded_count: 0, error: "Bill not found" };
    }
    
    if (bill.reminder_count >= 3) {
      return {
        success: false,
        reminded_count: 0,
        error: "Maximum reminders (3) already sent",
      };
    }
    
    const unpaidParticipants = bill.participants.filter((p) => !p.paid);
    
    if (unpaidParticipants.length === 0) {
      return {
        success: false,
        reminded_count: 0,
        error: "All participants have paid",
      };
    }
    
    // In production, send actual reminders via SMS/email
    // For now, just update the reminder count
    bill.reminder_count++;
    bill.last_reminder_at = Date.now();
    
    await AsyncStorage.setItem(SPLIT_BILLS_STORAGE_KEY, JSON.stringify(bills));
    
    return {
      success: true,
      reminded_count: unpaidParticipants.length,
    };
  } catch (error: any) {
    console.error("Failed to send reminder:", error);
    return {
      success: false,
      reminded_count: 0,
      error: error.message || "Failed to send reminder",
    };
  }
}

/**
 * Cancel split bill
 */
export async function cancelSplitBill(billId: string): Promise<boolean> {
  try {
    const bills = await getSplitBills();
    const bill = bills.find((b) => b.id === billId);
    
    if (!bill) return false;
    
    bill.status = "cancelled";
    
    await AsyncStorage.setItem(SPLIT_BILLS_STORAGE_KEY, JSON.stringify(bills));
    
    return true;
  } catch (error) {
    console.error("Failed to cancel split bill:", error);
    return false;
  }
}

/**
 * Get split bills by status
 */
export async function getSplitBillsByStatus(
  status: "pending" | "partially_paid" | "completed" | "cancelled"
): Promise<SplitBill[]> {
  const bills = await getSplitBills();
  return bills.filter((b) => b.status === status);
}

/**
 * Get split bills created by user
 */
export async function getSplitBillsByCreator(creatorId: string): Promise<SplitBill[]> {
  const bills = await getSplitBills();
  return bills.filter((b) => b.created_by === creatorId);
}

/**
 * Get split bill statistics
 */
export async function getSplitBillStatistics(userId: string): Promise<{
  total_bills: number;
  active_bills: number;
  completed_bills: number;
  total_amount_split: number;
  total_amount_collected: number;
  total_amount_pending: number;
}> {
  const bills = await getSplitBills();
  const userBills = bills.filter((b) => b.created_by === userId);
  
  const activeBills = userBills.filter(
    (b) => b.status === "pending" || b.status === "partially_paid"
  );
  const completedBills = userBills.filter((b) => b.status === "completed");
  
  const totalAmountSplit = userBills.reduce((sum, b) => sum + b.total_amount, 0);
  
  let totalAmountCollected = 0;
  let totalAmountPending = 0;
  
  for (const bill of userBills) {
    for (const participant of bill.participants) {
      if (participant.paid) {
        totalAmountCollected += participant.amount;
      } else {
        totalAmountPending += participant.amount;
      }
    }
  }
  
  return {
    total_bills: userBills.length,
    active_bills: activeBills.length,
    completed_bills: completedBills.length,
    total_amount_split: totalAmountSplit,
    total_amount_collected: totalAmountCollected,
    total_amount_pending: totalAmountPending,
  };
}

/**
 * Calculate split amounts for equal split
 */
export function calculateEqualSplit(totalAmount: number, participantCount: number): number {
  return totalAmount / participantCount;
}

/**
 * Calculate split amounts for percentage split
 */
export function calculatePercentageSplit(
  totalAmount: number,
  percentages: number[]
): number[] {
  return percentages.map((p) => (totalAmount * p) / 100);
}

/**
 * Validate custom split amounts
 */
export function validateCustomSplit(
  totalAmount: number,
  customAmounts: number[]
): { valid: boolean; error?: string } {
  const sum = customAmounts.reduce((a, b) => a + b, 0);
  
  if (Math.abs(sum - totalAmount) > 0.01) {
    return {
      valid: false,
      error: `Custom amounts ($${sum.toFixed(2)}) don't match total ($${totalAmount.toFixed(2)})`,
    };
  }
  
  if (customAmounts.some((a) => a <= 0)) {
    return {
      valid: false,
      error: "All amounts must be greater than zero",
    };
  }
  
  return { valid: true };
}

/**
 * Get unpaid participants for a bill
 */
export async function getUnpaidParticipants(
  billId: string
): Promise<SplitBillParticipant[]> {
  const bill = await getSplitBill(billId);
  if (!bill) return [];
  
  return bill.participants.filter((p) => !p.paid);
}

/**
 * Get paid participants for a bill
 */
export async function getPaidParticipants(
  billId: string
): Promise<SplitBillParticipant[]> {
  const bill = await getSplitBill(billId);
  if (!bill) return [];
  
  return bill.participants.filter((p) => p.paid);
}

/**
 * Get bill completion percentage
 */
export async function getBillCompletionPercentage(billId: string): Promise<number> {
  const bill = await getSplitBill(billId);
  if (!bill) return 0;
  
  const paidCount = bill.participants.filter((p) => p.paid).length;
  return (paidCount / bill.participants.length) * 100;
}

/**
 * Get bills requiring reminders
 */
export async function getBillsRequiringReminders(): Promise<SplitBill[]> {
  const bills = await getSplitBills();
  
  return bills.filter((bill) => {
    // Bill must be active (pending or partially paid)
    if (bill.status !== "pending" && bill.status !== "partially_paid") {
      return false;
    }
    
    // Must have unpaid participants
    const hasUnpaid = bill.participants.some((p) => !p.paid);
    if (!hasUnpaid) return false;
    
    // Must not have exceeded reminder limit
    if (bill.reminder_count >= 3) return false;
    
    // Must be at least 24 hours since last reminder (or creation)
    const lastActivity = bill.last_reminder_at || bill.created_at;
    const hoursSinceLastActivity = (Date.now() - lastActivity) / (60 * 60 * 1000);
    
    return hoursSinceLastActivity >= 24;
  });
}

/**
 * Format bill for display
 */
export function formatSplitBill(bill: SplitBill): {
  title: string;
  amount: string;
  status_text: string;
  completion: string;
  participants_text: string;
} {
  const paidCount = bill.participants.filter((p) => p.paid).length;
  const totalCount = bill.participants.length;
  const completion = Math.round((paidCount / totalCount) * 100);
  
  let statusText = "";
  switch (bill.status) {
    case "pending":
      statusText = "Waiting for payments";
      break;
    case "partially_paid":
      statusText = `${paidCount} of ${totalCount} paid`;
      break;
    case "completed":
      statusText = "All paid";
      break;
    case "cancelled":
      statusText = "Cancelled";
      break;
  }
  
  return {
    title: bill.title,
    amount: `${bill.currency} ${bill.total_amount.toFixed(2)}`,
    status_text: statusText,
    completion: `${completion}%`,
    participants_text: `${totalCount} participants`,
  };
}

/**
 * Delete split bill
 */
export async function deleteSplitBill(billId: string): Promise<boolean> {
  try {
    const bills = await getSplitBills();
    const filteredBills = bills.filter((b) => b.id !== billId);
    
    await AsyncStorage.setItem(SPLIT_BILLS_STORAGE_KEY, JSON.stringify(filteredBills));
    
    return true;
  } catch (error) {
    console.error("Failed to delete split bill:", error);
    return false;
  }
}
