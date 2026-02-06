const MERCHANT_URL = process.env.EXPO_PUBLIC_MERCHANT_URL || 'http://127.0.0.1:8117';

export interface Merchant {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string;
  registration_number: string;
  tax_id: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  currency: string;
  status: 'pending' | 'active' | 'suspended';
  kyb_status: string;
  settlement_account: string;
  fee_rate: number;
  created_at: string;
}

export interface POSTerminal {
  id: string;
  merchant_id: string;
  serial_number: string;
  model: string;
  location: string;
  status: string;
  last_active: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  merchant_id: string;
  customer_id: string;
  items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at?: string;
  invoice_number: string;
  notes: string;
  created_at: string;
}

export interface Settlement {
  id: string;
  merchant_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  transaction_count: number;
  period: string;
  status: string;
  account_number: string;
  settled_at: string;
  created_at: string;
}

export interface MerchantTransaction {
  id: string;
  merchant_id: string;
  customer_id: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  method: string;
  status: string;
  reference: string;
  pos_terminal?: string;
  created_at: string;
}

export interface MerchantAnalytics {
  merchant_id: string;
  period: string;
  total_revenue: number;
  total_fees: number;
  net_revenue: number;
  transaction_count: number;
  avg_transaction_size: number;
  top_products: string[];
  growth_rate: number;
  generated_at: string;
}

class MerchantService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${MERCHANT_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async onboardMerchant(params: {
    user_id: string;
    business_name: string;
    business_type: string;
    registration_number: string;
    tax_id: string;
    email: string;
    phone: string;
    address: string;
    country: string;
    settlement_account: string;
  }): Promise<Merchant> {
    return this.request('/merchants/onboard', { method: 'POST', body: JSON.stringify(params) });
  }

  async approveMerchant(merchantId: string, feeRate?: number): Promise<Merchant> {
    return this.request('/merchants/approve', {
      method: 'POST',
      body: JSON.stringify({ merchant_id: merchantId, fee_rate: feeRate }),
    });
  }

  async registerTerminal(params: {
    merchant_id: string;
    serial_number: string;
    model: string;
    location: string;
  }): Promise<POSTerminal> {
    return this.request('/pos/register', { method: 'POST', body: JSON.stringify(params) });
  }

  async processPOS(params: {
    terminal_id: string;
    amount: number;
    method: string;
    customer_id: string;
  }): Promise<MerchantTransaction> {
    return this.request('/pos/process', { method: 'POST', body: JSON.stringify(params) });
  }

  async createInvoice(params: {
    merchant_id: string;
    customer_id: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
    tax_rate?: number;
    due_days?: number;
    notes?: string;
  }): Promise<Invoice> {
    return this.request('/invoices/create', { method: 'POST', body: JSON.stringify(params) });
  }

  async payInvoice(invoiceId: string, method: string): Promise<Invoice> {
    return this.request('/invoices/pay', {
      method: 'POST',
      body: JSON.stringify({ invoice_id: invoiceId, method }),
    });
  }

  async getInvoices(merchantId: string): Promise<{ invoices: Invoice[]; total: number }> {
    return this.request(`/invoices?merchant_id=${merchantId}`);
  }

  async runSettlement(merchantId: string): Promise<Settlement> {
    return this.request('/settlements/run', {
      method: 'POST',
      body: JSON.stringify({ merchant_id: merchantId }),
    });
  }

  async getTransactions(merchantId: string): Promise<{ transactions: MerchantTransaction[]; total: number }> {
    return this.request(`/transactions?merchant_id=${merchantId}`);
  }

  async getAnalytics(merchantId: string): Promise<MerchantAnalytics> {
    return this.request(`/analytics?merchant_id=${merchantId}`);
  }
}

export const merchantService = new MerchantService();
