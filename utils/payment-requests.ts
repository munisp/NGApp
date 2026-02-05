import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import * as SMS from "expo-sms";
import * as MailComposer from "expo-mail-composer";

export type RequestStatus = "pending" | "paid" | "cancelled" | "expired";

export interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  recipient_name: string;
  recipient_contact: string; // email or phone
  contact_type: "email" | "sms";
  description: string;
  status: RequestStatus;
  created_at: number;
  expires_at: number;
  paid_at?: number;
  payment_link: string;
  reminder_count: number;
  last_reminder_sent?: number;
}

const REQUESTS_STORAGE_KEY = "payment_requests";
const REQUEST_EXPIRY_DAYS = 30;

/**
 * Generate a unique payment link
 */
function generatePaymentLink(requestId: string): string {
  // In production, this would be a deep link to the app
  // For now, we'll use a placeholder URL
  const baseUrl = "https://pay.fintech.app";
  return `${baseUrl}/request/${requestId}`;
}

/**
 * Get all payment requests
 */
export async function getPaymentRequests(): Promise<PaymentRequest[]> {
  try {
    const requestsJson = await AsyncStorage.getItem(REQUESTS_STORAGE_KEY);
    if (!requestsJson) return [];
    return JSON.parse(requestsJson);
  } catch (error) {
    console.error("Failed to get payment requests:", error);
    return [];
  }
}

/**
 * Save payment requests
 */
async function savePaymentRequests(requests: PaymentRequest[]): Promise<void> {
  try {
    await AsyncStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  } catch (error) {
    console.error("Failed to save payment requests:", error);
    throw error;
  }
}

/**
 * Create a new payment request
 */
export async function createPaymentRequest(request: {
  amount: number;
  currency: string;
  recipient_name: string;
  recipient_contact: string;
  contact_type: "email" | "sms";
  description: string;
}): Promise<PaymentRequest> {
  const requests = await getPaymentRequests();
  
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  const newRequest: PaymentRequest = {
    id: requestId,
    amount: request.amount,
    currency: request.currency,
    recipient_name: request.recipient_name,
    recipient_contact: request.recipient_contact,
    contact_type: request.contact_type,
    description: request.description,
    status: "pending",
    created_at: now,
    expires_at: expiresAt,
    payment_link: generatePaymentLink(requestId),
    reminder_count: 0,
  };
  
  requests.push(newRequest);
  await savePaymentRequests(requests);
  
  return newRequest;
}

/**
 * Update payment request status
 */
export async function updatePaymentRequestStatus(
  requestId: string,
  status: RequestStatus
): Promise<PaymentRequest | null> {
  const requests = await getPaymentRequests();
  const request = requests.find((r) => r.id === requestId);
  
  if (!request) return null;
  
  request.status = status;
  
  if (status === "paid") {
    request.paid_at = Date.now();
  }
  
  await savePaymentRequests(requests);
  return request;
}

/**
 * Cancel a payment request
 */
export async function cancelPaymentRequest(requestId: string): Promise<boolean> {
  const updated = await updatePaymentRequestStatus(requestId, "cancelled");
  return updated !== null;
}

/**
 * Mark payment request as paid
 */
export async function markPaymentRequestPaid(requestId: string): Promise<boolean> {
  const updated = await updatePaymentRequestStatus(requestId, "paid");
  return updated !== null;
}

/**
 * Delete a payment request
 */
export async function deletePaymentRequest(requestId: string): Promise<boolean> {
  const requests = await getPaymentRequests();
  const filtered = requests.filter((r) => r.id !== requestId);
  
  if (filtered.length === requests.length) return false;
  
  await savePaymentRequests(filtered);
  return true;
}

/**
 * Send payment request via SMS
 */
export async function sendPaymentRequestSMS(request: PaymentRequest): Promise<boolean> {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("SMS is not available on this device");
    }
    
    const message = `${request.recipient_name}, you have a payment request for ${request.currency}${request.amount.toFixed(2)} from Fintech App.\n\nReason: ${request.description}\n\nPay here: ${request.payment_link}\n\nThis request expires on ${new Date(request.expires_at).toLocaleDateString()}.`;
    
    const { result } = await SMS.sendSMSAsync(
      [request.recipient_contact],
      message
    );
    
    return result === "sent";
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
}

/**
 * Send payment request via email
 */
export async function sendPaymentRequestEmail(request: PaymentRequest): Promise<boolean> {
  try {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Email composer is not available on this device");
    }
    
    const subject = `Payment Request: ${request.currency}${request.amount.toFixed(2)}`;
    const body = `
Hi ${request.recipient_name},

You have received a payment request for ${request.currency}${request.amount.toFixed(2)}.

Reason: ${request.description}

To complete the payment, please click the link below:
${request.payment_link}

This payment request will expire on ${new Date(request.expires_at).toLocaleDateString()}.

Thank you,
Fintech App
    `.trim();
    
    const { status } = await MailComposer.composeAsync({
      recipients: [request.recipient_contact],
      subject,
      body,
    });
    
    return status === "sent";
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Send payment request (auto-detect method)
 */
export async function sendPaymentRequest(request: PaymentRequest): Promise<boolean> {
  if (request.contact_type === "sms") {
    return await sendPaymentRequestSMS(request);
  } else {
    return await sendPaymentRequestEmail(request);
  }
}

/**
 * Send reminder for payment request
 */
export async function sendPaymentRequestReminder(requestId: string): Promise<boolean> {
  const requests = await getPaymentRequests();
  const request = requests.find((r) => r.id === requestId);
  
  if (!request || request.status !== "pending") {
    return false;
  }
  
  // Check if we can send a reminder (max 3 reminders, 1 per day)
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  if (request.reminder_count >= 3) {
    throw new Error("Maximum reminders sent (3)");
  }
  
  if (request.last_reminder_sent && request.last_reminder_sent > oneDayAgo) {
    throw new Error("Please wait 24 hours before sending another reminder");
  }
  
  // Send reminder
  const sent = await sendPaymentRequest(request);
  
  if (sent) {
    request.reminder_count++;
    request.last_reminder_sent = now;
    await savePaymentRequests(requests);
  }
  
  return sent;
}

/**
 * Share payment request link
 */
export async function sharePaymentRequest(request: PaymentRequest): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is not available on this device");
    }
    
    const message = `Payment request for ${request.currency}${request.amount.toFixed(2)}: ${request.payment_link}`;
    
    // Create a temporary text file to share
    // In production, this would be a proper share sheet
    await Sharing.shareAsync(request.payment_link, {
      dialogTitle: `Share Payment Request`,
    });
    
    return true;
  } catch (error) {
    console.error("Failed to share payment request:", error);
    return false;
  }
}

/**
 * Get pending payment requests
 */
export async function getPendingPaymentRequests(): Promise<PaymentRequest[]> {
  const requests = await getPaymentRequests();
  return requests.filter((r) => r.status === "pending");
}

/**
 * Get expired payment requests
 */
export async function getExpiredPaymentRequests(): Promise<PaymentRequest[]> {
  const requests = await getPaymentRequests();
  const now = Date.now();
  
  const expired = requests.filter(
    (r) => r.status === "pending" && r.expires_at < now
  );
  
  // Auto-update status to expired
  for (const request of expired) {
    await updatePaymentRequestStatus(request.id, "expired");
  }
  
  return expired;
}

/**
 * Get payment request statistics
 */
export async function getPaymentRequestStats(): Promise<{
  total: number;
  pending: number;
  paid: number;
  cancelled: number;
  expired: number;
  total_amount_requested: number;
  total_amount_received: number;
  average_days_to_payment: number;
}> {
  const requests = await getPaymentRequests();
  
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    paid: requests.filter((r) => r.status === "paid").length,
    cancelled: requests.filter((r) => r.status === "cancelled").length,
    expired: requests.filter((r) => r.status === "expired").length,
    total_amount_requested: requests.reduce((sum, r) => sum + r.amount, 0),
    total_amount_received: requests
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.amount, 0),
    average_days_to_payment: 0,
  };
  
  // Calculate average days to payment
  const paidRequests = requests.filter((r) => r.status === "paid" && r.paid_at);
  if (paidRequests.length > 0) {
    const totalDays = paidRequests.reduce((sum, r) => {
      const days = (r.paid_at! - r.created_at) / (24 * 60 * 60 * 1000);
      return sum + days;
    }, 0);
    stats.average_days_to_payment = totalDays / paidRequests.length;
  }
  
  return stats;
}

/**
 * Check and update expired requests
 */
export async function updateExpiredRequests(): Promise<number> {
  const expired = await getExpiredPaymentRequests();
  return expired.length;
}

/**
 * Get payment requests by status
 */
export async function getPaymentRequestsByStatus(status: RequestStatus): Promise<PaymentRequest[]> {
  const requests = await getPaymentRequests();
  return requests.filter((r) => r.status === status);
}

/**
 * Get recent payment requests
 */
export async function getRecentPaymentRequests(limit: number = 10): Promise<PaymentRequest[]> {
  const requests = await getPaymentRequests();
  return requests
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}
