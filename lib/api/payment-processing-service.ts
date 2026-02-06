const PAYMENTS_URL = process.env.EXPO_PUBLIC_PAYMENTS_URL || 'http://127.0.0.1:8114';

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: 'card' | 'bank_transfer' | 'mobile_money' | 'ussd' | 'qr' | 'wallet';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  description: string;
  reference: string;
  gateway: string;
  gateway_ref: string;
  recipient_id?: string;
  recipient_name?: string;
  fee: number;
  metadata?: Record<string, string>;
  created_at: string;
  completed_at?: string;
}

export interface MobileMoneyTxn {
  id: string;
  user_id: string;
  provider: string;
  phone_number: string;
  amount: number;
  currency: string;
  direction: string;
  status: string;
  reference: string;
  created_at: string;
}

export interface QRPayment {
  id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  qr_data: string;
  status: string;
  payer_id?: string;
  expires_at: string;
  created_at: string;
}

export interface BillSplit {
  id: string;
  creator_id: string;
  title: string;
  total_amount: number;
  currency: string;
  participants: Array<{ user_id: string; amount: number; paid: boolean; paid_at?: string }>;
  status: string;
  created_at: string;
}

export interface Reconciliation {
  id: string;
  period: string;
  total_payments: number;
  total_amount: number;
  total_fees: number;
  matched: number;
  unmatched: number;
  discrepancies: string[];
  status: string;
  created_at: string;
}

export interface Refund {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

class PaymentProcessingService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${PAYMENTS_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async initiatePayment(params: {
    user_id: string;
    amount: number;
    currency?: string;
    method: Payment['method'];
    description: string;
    gateway?: string;
    recipient_id?: string;
    recipient_name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ payment: Payment; total: number; fee: number; gateway_url: string }> {
    return this.request('/payments/initiate', { method: 'POST', body: JSON.stringify(params) });
  }

  async verifyPayment(paymentId: string, gatewayRef?: string): Promise<Payment> {
    return this.request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId, gateway_ref: gatewayRef }),
    });
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<Refund> {
    return this.request('/payments/refund', {
      method: 'POST',
      body: JSON.stringify({ payment_id: paymentId, amount, reason }),
    });
  }

  async getPaymentHistory(userId: string): Promise<{ payments: Payment[]; total: number }> {
    return this.request(`/payments/history?user_id=${userId}`);
  }

  async getPayment(paymentId: string): Promise<Payment> {
    return this.request(`/payments/${paymentId}`);
  }

  async mobileMoneyTransfer(params: {
    user_id: string;
    provider: string;
    phone_number: string;
    amount: number;
    currency?: string;
    direction: string;
  }): Promise<MobileMoneyTxn> {
    return this.request('/mobile-money/transfer', { method: 'POST', body: JSON.stringify(params) });
  }

  async generateQR(params: { merchant_id: string; amount: number; currency?: string }): Promise<QRPayment> {
    return this.request('/qr/generate', { method: 'POST', body: JSON.stringify(params) });
  }

  async payQR(qrId: string, payerId: string): Promise<QRPayment> {
    return this.request('/qr/pay', { method: 'POST', body: JSON.stringify({ qr_id: qrId, payer_id: payerId }) });
  }

  async createBillSplit(params: {
    creator_id: string;
    title: string;
    total_amount: number;
    currency?: string;
    participants: Array<{ user_id: string; amount: number }>;
  }): Promise<BillSplit> {
    return this.request('/bill-split/create', { method: 'POST', body: JSON.stringify(params) });
  }

  async settleBillShare(splitId: string, userId: string): Promise<BillSplit> {
    return this.request('/bill-split/settle', {
      method: 'POST',
      body: JSON.stringify({ split_id: splitId, user_id: userId }),
    });
  }

  async runReconciliation(): Promise<Reconciliation> {
    return this.request('/reconciliation/run', { method: 'POST' });
  }

  async schedulePayment(params: {
    user_id: string;
    recipient_id: string;
    amount: number;
    currency?: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    description: string;
  }): Promise<Record<string, unknown>> {
    return this.request('/schedule/create', { method: 'POST', body: JSON.stringify(params) });
  }
}

export const paymentProcessingService = new PaymentProcessingService();
