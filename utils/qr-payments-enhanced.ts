import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QRPaymentRequest {
  id: string;
  recipient_name: string;
  recipient_account: string;
  amount: number;
  currency: string;
  description?: string;
  created_at: number;
  expires_at: number;
  status: "pending" | "completed" | "expired" | "cancelled";
}

export interface QRPaymentTransaction {
  id: string;
  payment_request_id: string;
  sender_name: string;
  sender_account: string;
  recipient_name: string;
  recipient_account: string;
  amount: number;
  currency: string;
  description?: string;
  timestamp: number;
  status: "completed" | "failed";
  qr_code_data: string;
}

const QR_REQUESTS_STORAGE_KEY = "qr_payment_requests";
const QR_TRANSACTIONS_STORAGE_KEY = "qr_payment_transactions";

/**
 * Generate QR code data for payment request
 */
export function generateQRCodeData(
  recipientName: string,
  recipientAccount: string,
  amount: number,
  currency: string = "USD",
  description?: string
): string {
  const data = {
    type: "payment_request",
    recipient_name: recipientName,
    recipient_account: recipientAccount,
    amount,
    currency,
    description,
    timestamp: Date.now(),
  };
  
  return JSON.stringify(data);
}

/**
 * Parse QR code data
 */
export function parseQRCodeData(qrData: string): {
  type: string;
  recipient_name: string;
  recipient_account: string;
  amount: number;
  currency: string;
  description?: string;
  timestamp: number;
} | null {
  try {
    const data = JSON.parse(qrData);
    
    if (data.type !== "payment_request") {
      return null;
    }
    
    return {
      type: data.type,
      recipient_name: data.recipient_name,
      recipient_account: data.recipient_account,
      amount: parseFloat(data.amount),
      currency: data.currency || "USD",
      description: data.description,
      timestamp: data.timestamp,
    };
  } catch (error) {
    console.error("Failed to parse QR code data:", error);
    return null;
  }
}

/**
 * Create payment request with QR code
 */
export async function createPaymentRequest(
  recipientName: string,
  recipientAccount: string,
  amount: number,
  currency: string = "USD",
  description?: string,
  expiryMinutes: number = 30
): Promise<QRPaymentRequest> {
  const request: QRPaymentRequest = {
    id: `qr_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    recipient_name: recipientName,
    recipient_account: recipientAccount,
    amount,
    currency,
    description,
    created_at: Date.now(),
    expires_at: Date.now() + expiryMinutes * 60 * 1000,
    status: "pending",
  };
  
  const requests = await getPaymentRequests();
  requests.push(request);
  await AsyncStorage.setItem(QR_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  
  return request;
}

/**
 * Get all payment requests
 */
export async function getPaymentRequests(): Promise<QRPaymentRequest[]> {
  try {
    const requestsJson = await AsyncStorage.getItem(QR_REQUESTS_STORAGE_KEY);
    if (!requestsJson) return [];
    return JSON.parse(requestsJson);
  } catch (error) {
    console.error("Failed to get payment requests:", error);
    return [];
  }
}

/**
 * Get payment request by ID
 */
export async function getPaymentRequest(requestId: string): Promise<QRPaymentRequest | null> {
  const requests = await getPaymentRequests();
  return requests.find((r) => r.id === requestId) || null;
}

/**
 * Update payment request status
 */
export async function updatePaymentRequestStatus(
  requestId: string,
  status: "completed" | "expired" | "cancelled"
): Promise<boolean> {
  try {
    const requests = await getPaymentRequests();
    const request = requests.find((r) => r.id === requestId);
    
    if (!request) return false;
    
    request.status = status;
    await AsyncStorage.setItem(QR_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    
    return true;
  } catch (error) {
    console.error("Failed to update payment request status:", error);
    return false;
  }
}

/**
 * Process QR code payment
 */
export async function processQRPayment(
  qrData: string,
  senderName: string,
  senderAccount: string
): Promise<{ success: boolean; transaction?: QRPaymentTransaction; error?: string }> {
  const paymentData = parseQRCodeData(qrData);
  
  if (!paymentData) {
    return { success: false, error: "Invalid QR code" };
  }
  
  // Check if payment is expired (older than 30 minutes)
  const ageMinutes = (Date.now() - paymentData.timestamp) / (60 * 1000);
  if (ageMinutes > 30) {
    return { success: false, error: "QR code has expired" };
  }
  
  // Create transaction
  const transaction: QRPaymentTransaction = {
    id: `qr_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    payment_request_id: "", // No request ID for direct QR payments
    sender_name: senderName,
    sender_account: senderAccount,
    recipient_name: paymentData.recipient_name,
    recipient_account: paymentData.recipient_account,
    amount: paymentData.amount,
    currency: paymentData.currency,
    description: paymentData.description,
    timestamp: Date.now(),
    status: "completed",
    qr_code_data: qrData,
  };
  
  // Save transaction
  const transactions = await getQRTransactions();
  transactions.push(transaction);
  await AsyncStorage.setItem(QR_TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
  
  return { success: true, transaction };
}

/**
 * Get all QR transactions
 */
export async function getQRTransactions(): Promise<QRPaymentTransaction[]> {
  try {
    const transactionsJson = await AsyncStorage.getItem(QR_TRANSACTIONS_STORAGE_KEY);
    if (!transactionsJson) return [];
    return JSON.parse(transactionsJson);
  } catch (error) {
    console.error("Failed to get QR transactions:", error);
    return [];
  }
}

/**
 * Get QR transactions by account
 */
export async function getQRTransactionsByAccount(
  account: string,
  type: "sent" | "received" | "all" = "all"
): Promise<QRPaymentTransaction[]> {
  const transactions = await getQRTransactions();
  
  if (type === "sent") {
    return transactions.filter((t) => t.sender_account === account);
  } else if (type === "received") {
    return transactions.filter((t) => t.recipient_account === account);
  }
  
  return transactions.filter(
    (t) => t.sender_account === account || t.recipient_account === account
  );
}

/**
 * Get QR transaction statistics
 */
export async function getQRTransactionStatistics(account: string): Promise<{
  total_sent: number;
  total_received: number;
  total_amount_sent: number;
  total_amount_received: number;
  recent_transactions: QRPaymentTransaction[];
}> {
  const allTransactions = await getQRTransactionsByAccount(account);
  
  const sentTransactions = allTransactions.filter((t) => t.sender_account === account);
  const receivedTransactions = allTransactions.filter((t) => t.recipient_account === account);
  
  const totalAmountSent = sentTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalAmountReceived = receivedTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const recentTransactions = allTransactions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
  
  return {
    total_sent: sentTransactions.length,
    total_received: receivedTransactions.length,
    total_amount_sent: totalAmountSent,
    total_amount_received: totalAmountReceived,
    recent_transactions: recentTransactions,
  };
}

/**
 * Check and expire old payment requests
 */
export async function expireOldPaymentRequests(): Promise<number> {
  const requests = await getPaymentRequests();
  const now = Date.now();
  let expiredCount = 0;
  
  for (const request of requests) {
    if (request.status === "pending" && now > request.expires_at) {
      request.status = "expired";
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    await AsyncStorage.setItem(QR_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  }
  
  return expiredCount;
}

/**
 * Cancel payment request
 */
export async function cancelPaymentRequest(requestId: string): Promise<boolean> {
  return await updatePaymentRequestStatus(requestId, "cancelled");
}

/**
 * Get active payment requests
 */
export async function getActivePaymentRequests(account: string): Promise<QRPaymentRequest[]> {
  await expireOldPaymentRequests();
  const requests = await getPaymentRequests();
  return requests.filter(
    (r) => r.recipient_account === account && r.status === "pending"
  );
}

/**
 * Validate QR code data format
 */
export function validateQRCodeData(qrData: string): { valid: boolean; error?: string } {
  try {
    const data = JSON.parse(qrData);
    
    if (data.type !== "payment_request") {
      return { valid: false, error: "Invalid QR code type" };
    }
    
    if (!data.recipient_name || !data.recipient_account) {
      return { valid: false, error: "Missing recipient information" };
    }
    
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      return { valid: false, error: "Invalid payment amount" };
    }
    
    if (!data.timestamp) {
      return { valid: false, error: "Missing timestamp" };
    }
    
    // Check expiry (30 minutes)
    const ageMinutes = (Date.now() - data.timestamp) / (60 * 1000);
    if (ageMinutes > 30) {
      return { valid: false, error: "QR code has expired" };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid QR code format" };
  }
}

/**
 * Format QR transaction for display
 */
export function formatQRTransaction(transaction: QRPaymentTransaction, userAccount: string): {
  type: "sent" | "received";
  counterparty: string;
  amount: string;
  description: string;
} {
  const isSent = transaction.sender_account === userAccount;
  
  return {
    type: isSent ? "sent" : "received",
    counterparty: isSent ? transaction.recipient_name : transaction.sender_name,
    amount: `${transaction.currency} ${transaction.amount.toFixed(2)}`,
    description: transaction.description || "QR Payment",
  };
}

/**
 * Get QR payment summary
 */
export async function getQRPaymentSummary(account: string): Promise<{
  active_requests: number;
  total_transactions: number;
  total_sent: number;
  total_received: number;
  last_transaction_date?: number;
}> {
  const activeRequests = await getActivePaymentRequests(account);
  const stats = await getQRTransactionStatistics(account);
  
  const lastTransaction = stats.recent_transactions[0];
  
  return {
    active_requests: activeRequests.length,
    total_transactions: stats.total_sent + stats.total_received,
    total_sent: stats.total_amount_sent,
    total_received: stats.total_amount_received,
    last_transaction_date: lastTransaction?.timestamp,
  };
}
