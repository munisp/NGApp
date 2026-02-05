import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface CircleMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  joined_at: number;
  contribution_count: number;
  total_contributed: number;
  credit_score_boost: number;
  is_admin: boolean;
  payout_position: number;
  has_received_payout: boolean;
  payout_received_at?: number;
}

export interface CircleContribution {
  id: string;
  circle_id: string;
  member_id: string;
  amount: number;
  due_date: number;
  paid_at?: number;
  status: "pending" | "paid" | "late" | "missed";
  cycle_number: number;
}

export interface CirclePayout {
  id: string;
  circle_id: string;
  recipient_id: string;
  amount: number;
  cycle_number: number;
  paid_at: number;
  status: "completed" | "pending";
}

export interface CircleMessage {
  id: string;
  circle_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: number;
  type: "chat" | "system";
}

export interface LendingCircle {
  id: string;
  name: string;
  description: string;
  contribution_amount: number;
  frequency: "weekly" | "biweekly" | "monthly";
  total_members: number;
  current_members: number;
  max_members: number;
  current_cycle: number;
  total_cycles: number;
  start_date: number;
  next_contribution_date: number;
  next_payout_date: number;
  status: "forming" | "active" | "completed" | "paused";
  members: CircleMember[];
  contributions: CircleContribution[];
  payouts: CirclePayout[];
  messages: CircleMessage[];
  rules: string[];
  created_by: string;
  created_at: number;
}

const CIRCLES_STORAGE_KEY = "lending_circles";

/**
 * Get all lending circles
 */
export async function getLendingCircles(): Promise<LendingCircle[]> {
  try {
    const circlesJson = await AsyncStorage.getItem(CIRCLES_STORAGE_KEY);
    if (!circlesJson) return [];
    return JSON.parse(circlesJson);
  } catch (error) {
    console.error("Failed to get lending circles:", error);
    return [];
  }
}

/**
 * Save lending circles
 */
async function saveLendingCircles(circles: LendingCircle[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CIRCLES_STORAGE_KEY, JSON.stringify(circles));
  } catch (error) {
    console.error("Failed to save lending circles:", error);
    throw error;
  }
}

/**
 * Calculate next contribution date
 */
function calculateNextDate(startDate: number, frequency: LendingCircle["frequency"], cycleNumber: number): number {
  const date = new Date(startDate);
  
  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + (cycleNumber * 7));
      break;
    case "biweekly":
      date.setDate(date.getDate() + (cycleNumber * 14));
      break;
    case "monthly":
      date.setMonth(date.getMonth() + cycleNumber);
      break;
  }
  
  return date.getTime();
}

/**
 * Create lending circle
 */
export async function createLendingCircle(
  circle: Omit<LendingCircle, "id" | "current_members" | "current_cycle" | "total_cycles" | "next_contribution_date" | "next_payout_date" | "status" | "members" | "contributions" | "payouts" | "messages" | "created_at">
): Promise<LendingCircle> {
  const circles = await getLendingCircles();
  
  const newCircle: LendingCircle = {
    ...circle,
    id: `circle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    current_members: 0,
    current_cycle: 0,
    total_cycles: circle.max_members, // Each member gets one payout
    next_contribution_date: circle.start_date,
    next_payout_date: circle.start_date,
    status: "forming",
    members: [],
    contributions: [],
    payouts: [],
    messages: [],
    created_at: Date.now(),
  };
  
  circles.push(newCircle);
  await saveLendingCircles(circles);
  
  return newCircle;
}

/**
 * Join lending circle
 */
export async function joinLendingCircle(
  circleId: string,
  member: Omit<CircleMember, "id" | "joined_at" | "contribution_count" | "total_contributed" | "credit_score_boost" | "is_admin" | "payout_position" | "has_received_payout">
): Promise<{ success: boolean; message: string; circle?: LendingCircle }> {
  const circles = await getLendingCircles();
  const circle = circles.find((c) => c.id === circleId);
  
  if (!circle) {
    return { success: false, message: "Circle not found" };
  }
  
  if (circle.status !== "forming") {
    return { success: false, message: "Circle is not accepting new members" };
  }
  
  if (circle.current_members >= circle.max_members) {
    return { success: false, message: "Circle is full" };
  }
  
  // Check if user already in circle
  if (circle.members.some((m) => m.user_id === member.user_id)) {
    return { success: false, message: "Already a member of this circle" };
  }
  
  const newMember: CircleMember = {
    ...member,
    id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    joined_at: Date.now(),
    contribution_count: 0,
    total_contributed: 0,
    credit_score_boost: 0,
    is_admin: circle.members.length === 0, // First member is admin
    payout_position: circle.members.length + 1,
    has_received_payout: false,
  };
  
  circle.members.push(newMember);
  circle.current_members++;
  
  // Add system message
  addSystemMessage(circle, `${member.name} joined the circle`);
  
  // If circle is full, activate it
  if (circle.current_members === circle.max_members) {
    circle.status = "active";
    addSystemMessage(circle, "Circle is now active! First contribution is due soon.");
    
    // Send notification to all members
    await notifyAllMembers(circle, "Circle Activated", "Your lending circle is now active. First contribution is coming up!");
  }
  
  await saveLendingCircles(circles);
  
  return { success: true, message: "Successfully joined circle", circle };
}

/**
 * Make contribution
 */
export async function makeContribution(
  circleId: string,
  memberId: string,
  amount: number
): Promise<{ success: boolean; message: string; contribution?: CircleContribution }> {
  const circles = await getLendingCircles();
  const circle = circles.find((c) => c.id === circleId);
  
  if (!circle) {
    return { success: false, message: "Circle not found" };
  }
  
  const member = circle.members.find((m) => m.id === memberId);
  if (!member) {
    return { success: false, message: "Member not found" };
  }
  
  if (amount !== circle.contribution_amount) {
    return { success: false, message: `Contribution must be exactly $${circle.contribution_amount.toFixed(2)}` };
  }
  
  // Find pending contribution for current cycle
  const pendingContribution = circle.contributions.find(
    (c) => c.member_id === memberId && c.cycle_number === circle.current_cycle && c.status === "pending"
  );
  
  if (!pendingContribution) {
    return { success: false, message: "No pending contribution found for current cycle" };
  }
  
  // Mark as paid
  pendingContribution.paid_at = Date.now();
  pendingContribution.status = "paid";
  
  // Update member stats
  member.contribution_count++;
  member.total_contributed += amount;
  member.credit_score_boost += 5; // +5 points per contribution
  
  // Check if all contributions for current cycle are complete
  const allPaid = circle.contributions
    .filter((c) => c.cycle_number === circle.current_cycle)
    .every((c) => c.status === "paid");
  
  if (allPaid) {
    // Process payout
    await processPayout(circle);
  }
  
  addSystemMessage(circle, `${member.name} made their contribution for cycle ${circle.current_cycle}`);
  
  await saveLendingCircles(circles);
  
  return { success: true, message: "Contribution recorded successfully", contribution: pendingContribution };
}

/**
 * Process payout for current cycle
 */
async function processPayout(circle: LendingCircle): Promise<void> {
  // Find next member to receive payout
  const recipient = circle.members
    .filter((m) => !m.has_received_payout)
    .sort((a, b) => a.payout_position - b.payout_position)[0];
  
  if (!recipient) {
    // All members have received payout, circle is complete
    circle.status = "completed";
    addSystemMessage(circle, "Circle completed! All members have received their payouts.");
    await notifyAllMembers(circle, "Circle Completed", "Congratulations! Your lending circle has successfully completed all cycles.");
    return;
  }
  
  const payoutAmount = circle.contribution_amount * circle.current_members;
  
  const payout: CirclePayout = {
    id: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    circle_id: circle.id,
    recipient_id: recipient.id,
    amount: payoutAmount,
    cycle_number: circle.current_cycle,
    paid_at: Date.now(),
    status: "completed",
  };
  
  circle.payouts.push(payout);
  recipient.has_received_payout = true;
  recipient.payout_received_at = Date.now();
  recipient.credit_score_boost += 20; // +20 points for receiving payout
  
  addSystemMessage(circle, `${recipient.name} received payout of $${payoutAmount.toFixed(2)} for cycle ${circle.current_cycle}`);
  
  // Send notification to recipient
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Payout Received!",
      body: `You've received $${payoutAmount.toFixed(2)} from ${circle.name}`,
      data: {
        type: "circle_payout",
        circle_id: circle.id,
        payout_id: payout.id,
      },
    },
    trigger: null,
  });
  
  // Move to next cycle
  circle.current_cycle++;
  
  if (circle.current_cycle < circle.total_cycles) {
    // Create contributions for next cycle
    createContributionsForCycle(circle);
    
    // Update next dates
    circle.next_contribution_date = calculateNextDate(circle.start_date, circle.frequency, circle.current_cycle);
    circle.next_payout_date = calculateNextDate(circle.start_date, circle.frequency, circle.current_cycle);
    
    addSystemMessage(circle, `Cycle ${circle.current_cycle} started. Next contribution due ${new Date(circle.next_contribution_date).toLocaleDateString()}`);
    
    // Notify all members
    await notifyAllMembers(circle, "New Cycle Started", `Cycle ${circle.current_cycle} has begun. Contribution due ${new Date(circle.next_contribution_date).toLocaleDateString()}`);
  }
}

/**
 * Create contributions for a cycle
 */
function createContributionsForCycle(circle: LendingCircle): void {
  for (const member of circle.members) {
    const contribution: CircleContribution = {
      id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      circle_id: circle.id,
      member_id: member.id,
      amount: circle.contribution_amount,
      due_date: circle.next_contribution_date,
      status: "pending",
      cycle_number: circle.current_cycle,
    };
    
    circle.contributions.push(contribution);
  }
}

/**
 * Add system message
 */
function addSystemMessage(circle: LendingCircle, message: string): void {
  const systemMessage: CircleMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    circle_id: circle.id,
    sender_id: "system",
    sender_name: "System",
    message,
    timestamp: Date.now(),
    type: "system",
  };
  
  circle.messages.push(systemMessage);
}

/**
 * Add chat message
 */
export async function addChatMessage(
  circleId: string,
  senderId: string,
  senderName: string,
  message: string
): Promise<boolean> {
  const circles = await getLendingCircles();
  const circle = circles.find((c) => c.id === circleId);
  
  if (!circle) return false;
  
  const chatMessage: CircleMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    circle_id: circleId,
    sender_id: senderId,
    sender_name: senderName,
    message,
    timestamp: Date.now(),
    type: "chat",
  };
  
  circle.messages.push(chatMessage);
  await saveLendingCircles(circles);
  
  return true;
}

/**
 * Notify all members
 */
async function notifyAllMembers(circle: LendingCircle, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: "circle_notification",
        circle_id: circle.id,
      },
    },
    trigger: null,
  });
}

/**
 * Get user's circles
 */
export async function getUserCircles(userId: string): Promise<LendingCircle[]> {
  const circles = await getLendingCircles();
  return circles.filter((c) => c.members.some((m) => m.user_id === userId));
}

/**
 * Get active circles
 */
export async function getActiveCircles(): Promise<LendingCircle[]> {
  const circles = await getLendingCircles();
  return circles.filter((c) => c.status === "active");
}

/**
 * Get forming circles (joinable)
 */
export async function getFormingCircles(): Promise<LendingCircle[]> {
  const circles = await getLendingCircles();
  return circles.filter((c) => c.status === "forming" && c.current_members < c.max_members);
}

/**
 * Get member's pending contributions
 */
export function getPendingContributions(circle: LendingCircle, memberId: string): CircleContribution[] {
  return circle.contributions.filter((c) => c.member_id === memberId && c.status === "pending");
}

/**
 * Get member's contribution history
 */
export function getContributionHistory(circle: LendingCircle, memberId: string): CircleContribution[] {
  return circle.contributions.filter((c) => c.member_id === memberId).sort((a, b) => b.cycle_number - a.cycle_number);
}

/**
 * Get circle statistics
 */
export function getCircleStatistics(circle: LendingCircle): {
  total_collected: number;
  total_paid_out: number;
  completion_percentage: number;
  on_time_rate: number;
  average_credit_boost: number;
} {
  const totalCollected = circle.contributions.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amount, 0);
  const totalPaidOut = circle.payouts.reduce((sum, p) => sum + p.amount, 0);
  const completionPercentage = (circle.current_cycle / circle.total_cycles) * 100;
  
  const totalContributions = circle.contributions.length;
  const onTimeContributions = circle.contributions.filter((c) => c.status === "paid" && c.paid_at && c.paid_at <= c.due_date).length;
  const onTimeRate = totalContributions > 0 ? (onTimeContributions / totalContributions) * 100 : 0;
  
  const averageCreditBoost = circle.members.length > 0
    ? circle.members.reduce((sum, m) => sum + m.credit_score_boost, 0) / circle.members.length
    : 0;
  
  return {
    total_collected: totalCollected,
    total_paid_out: totalPaidOut,
    completion_percentage: completionPercentage,
    on_time_rate: onTimeRate,
    average_credit_boost: averageCreditBoost,
  };
}

/**
 * Leave circle (only if not started or no contributions made)
 */
export async function leaveCircle(circleId: string, memberId: string): Promise<{ success: boolean; message: string }> {
  const circles = await getLendingCircles();
  const circle = circles.find((c) => c.id === circleId);
  
  if (!circle) {
    return { success: false, message: "Circle not found" };
  }
  
  const member = circle.members.find((m) => m.id === memberId);
  if (!member) {
    return { success: false, message: "Member not found" };
  }
  
  if (circle.status !== "forming") {
    return { success: false, message: "Cannot leave an active circle" };
  }
  
  // Remove member
  circle.members = circle.members.filter((m) => m.id !== memberId);
  circle.current_members--;
  
  // Reassign payout positions
  circle.members.forEach((m, index) => {
    m.payout_position = index + 1;
  });
  
  addSystemMessage(circle, `${member.name} left the circle`);
  
  await saveLendingCircles(circles);
  
  return { success: true, message: "Successfully left circle" };
}

/**
 * Get frequency display name
 */
export function getFrequencyDisplayName(frequency: LendingCircle["frequency"]): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
  }
}

/**
 * Calculate total payout amount
 */
export function calculateTotalPayout(circle: LendingCircle): number {
  return circle.contribution_amount * circle.max_members;
}
