import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Flutterwave API configuration
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';
const FLUTTERWAVE_SECRET_KEY_STORAGE = '@flutterwave_secret_key';

export interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  encryptionKey: string;
  environment: 'test' | 'live';
}

export interface FlutterwavePayment {
  tx_ref: string;
  amount: number;
  currency: 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'USD' | 'EUR' | 'GBP';
  redirect_url?: string;
  payment_options?: string; // e.g., 'card,banktransfer,ussd,mobilemoney'
  customer: {
    email: string;
    phonenumber?: string;
    name: string;
  };
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: Record<string, any>;
}

export interface FlutterwaveTransfer {
  account_bank: string; // bank code
  account_number: string;
  amount: number;
  currency: 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'USD' | 'EUR' | 'GBP';
  narration?: string;
  reference?: string;
  callback_url?: string;
  debit_currency?: string;
  beneficiary_name?: string;
}

export interface FlutterwaveBulkTransfer {
  title: string;
  bulk_data: FlutterwaveTransfer[];
}

export interface FlutterwaveBank {
  id: number;
  code: string;
  name: string;
}

export interface FlutterwaveVirtualAccount {
  email: string;
  is_permanent: boolean;
  bvn?: string;
  tx_ref: string;
  firstname?: string;
  lastname?: string;
  narration?: string;
}

class FlutterwaveService {
  private secretKey: string | null = null;
  private publicKey: string | null = null;
  private encryptionKey: string | null = null;

  async initialize(config: FlutterwaveConfig): Promise<void> {
    this.publicKey = config.publicKey;
    this.secretKey = config.secretKey;
    this.encryptionKey = config.encryptionKey;
    
    // Store keys securely
    await SecureStore.setItemAsync(FLUTTERWAVE_SECRET_KEY_STORAGE, JSON.stringify({
      secretKey: config.secretKey,
      encryptionKey: config.encryptionKey,
    }));
  }

  private async getSecretKey(): Promise<string> {
    if (this.secretKey) return this.secretKey;
    
    const stored = await SecureStore.getItemAsync(FLUTTERWAVE_SECRET_KEY_STORAGE);
    if (!stored) {
      throw new Error('Flutterwave not initialized. Please configure API keys.');
    }
    
    const keys = JSON.parse(stored);
    this.secretKey = keys.secretKey;
    this.encryptionKey = keys.encryptionKey;
    return keys.secretKey;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
    const secretKey = await this.getSecretKey();
    
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok || data.status !== 'success') {
      throw new Error(data.message || 'Flutterwave API request failed');
    }

    return data.data;
  }

  // Initialize payment
  async initializePayment(payment: FlutterwavePayment): Promise<{ link: string }> {
    try {
      const data = await this.makeRequest('/payments', 'POST', payment);
      return data;
    } catch (error: any) {
      console.error('Flutterwave initialize payment error:', error);
      throw new Error(error.message || 'Failed to initialize payment');
    }
  }

  // Verify transaction
  async verifyTransaction(transactionId: string): Promise<any> {
    try {
      const data = await this.makeRequest(`/transactions/${transactionId}/verify`);
      return data;
    } catch (error: any) {
      console.error('Flutterwave verify transaction error:', error);
      throw new Error(error.message || 'Failed to verify transaction');
    }
  }

  // Get banks
  async getBanks(country: 'NG' | 'GH' | 'KE' | 'ZA' | 'TZ' | 'UG'): Promise<FlutterwaveBank[]> {
    try {
      const data = await this.makeRequest(`/banks/${country}`);
      return data;
    } catch (error: any) {
      console.error('Flutterwave get banks error:', error);
      throw new Error(error.message || 'Failed to fetch banks');
    }
  }

  // Resolve account number
  async resolveAccount(accountNumber: string, accountBank: string): Promise<{ account_number: string; account_name: string }> {
    try {
      const data = await this.makeRequest('/accounts/resolve', 'POST', {
        account_number: accountNumber,
        account_bank: accountBank,
      });
      return data;
    } catch (error: any) {
      console.error('Flutterwave resolve account error:', error);
      throw new Error(error.message || 'Failed to resolve account');
    }
  }

  // Create transfer
  async createTransfer(transfer: FlutterwaveTransfer): Promise<{ id: number; reference: string; status: string }> {
    try {
      const data = await this.makeRequest('/transfers', 'POST', transfer);
      return data;
    } catch (error: any) {
      console.error('Flutterwave create transfer error:', error);
      throw new Error(error.message || 'Failed to create transfer');
    }
  }

  // Create bulk transfer
  async createBulkTransfer(bulkTransfer: FlutterwaveBulkTransfer): Promise<{ id: number; status: string }> {
    try {
      const data = await this.makeRequest('/bulk-transfers', 'POST', bulkTransfer);
      return data;
    } catch (error: any) {
      console.error('Flutterwave create bulk transfer error:', error);
      throw new Error(error.message || 'Failed to create bulk transfer');
    }
  }

  // Get transfer fee
  async getTransferFee(params: { amount: number; currency: string; type?: string }): Promise<{ fee: number }> {
    try {
      const queryParams = new URLSearchParams(params as any).toString();
      const data = await this.makeRequest(`/transfers/fee?${queryParams}`);
      return data;
    } catch (error: any) {
      console.error('Flutterwave get transfer fee error:', error);
      throw new Error(error.message || 'Failed to fetch transfer fee');
    }
  }

  // Verify transfer
  async verifyTransfer(reference: string): Promise<any> {
    try {
      const data = await this.makeRequest(`/transfers?reference=${reference}`);
      return data;
    } catch (error: any) {
      console.error('Flutterwave verify transfer error:', error);
      throw new Error(error.message || 'Failed to verify transfer');
    }
  }

  // Get balance
  async getBalance(currency?: string): Promise<{ currency: string; available_balance: number; ledger_balance: number }[]> {
    try {
      const endpoint = currency ? `/balances/${currency}` : '/balances';
      const data = await this.makeRequest(endpoint);
      return Array.isArray(data) ? data : [data];
    } catch (error: any) {
      console.error('Flutterwave get balance error:', error);
      throw new Error(error.message || 'Failed to fetch balance');
    }
  }

  // List transactions
  async listTransactions(params?: { from?: string; to?: string; page?: number; currency?: string }): Promise<any> {
    try {
      const queryParams = new URLSearchParams(params as any).toString();
      const data = await this.makeRequest(`/transactions?${queryParams}`);
      return data;
    } catch (error: any) {
      console.error('Flutterwave list transactions error:', error);
      throw new Error(error.message || 'Failed to fetch transactions');
    }
  }

  // Create virtual account
  async createVirtualAccount(account: FlutterwaveVirtualAccount): Promise<any> {
    try {
      const data = await this.makeRequest('/virtual-account-numbers', 'POST', account);
      return data;
    } catch (error: any) {
      console.error('Flutterwave create virtual account error:', error);
      throw new Error(error.message || 'Failed to create virtual account');
    }
  }

  // Get virtual accounts
  async getVirtualAccounts(): Promise<any[]> {
    try {
      const data = await this.makeRequest('/virtual-account-numbers');
      return data;
    } catch (error: any) {
      console.error('Flutterwave get virtual accounts error:', error);
      throw new Error(error.message || 'Failed to fetch virtual accounts');
    }
  }

  // Create payment plan (subscription)
  async createPaymentPlan(plan: {
    amount: number;
    name: string;
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
    duration?: number;
    currency?: string;
  }): Promise<any> {
    try {
      const data = await this.makeRequest('/payment-plans', 'POST', plan);
      return data;
    } catch (error: any) {
      console.error('Flutterwave create payment plan error:', error);
      throw new Error(error.message || 'Failed to create payment plan');
    }
  }

  // Charge card (tokenized)
  async chargeCard(params: {
    token: string;
    email: string;
    amount: number;
    currency: string;
    tx_ref: string;
  }): Promise<any> {
    try {
      const data = await this.makeRequest('/tokenized-charges', 'POST', params);
      return data;
    } catch (error: any) {
      console.error('Flutterwave charge card error:', error);
      throw new Error(error.message || 'Failed to charge card');
    }
  }

  // Get exchange rates
  async getExchangeRates(params: {
    amount: number;
    destination_currency: string;
    source_currency: string;
  }): Promise<{ rate: number; source: any; destination: any }> {
    try {
      const data = await this.makeRequest('/transfers/rates', 'POST', params);
      return data;
    } catch (error: any) {
      console.error('Flutterwave get exchange rates error:', error);
      throw new Error(error.message || 'Failed to fetch exchange rates');
    }
  }

  // Mobile money payment (Ghana, Kenya, Uganda, etc.)
  async chargeMobileMoney(params: {
    tx_ref: string;
    amount: number;
    currency: string;
    network: 'MTN' | 'VODAFONE' | 'TIGO' | 'AIRTEL' | 'MPESA' | 'ZAMTEL';
    email: string;
    phone_number: string;
    fullname: string;
  }): Promise<any> {
    try {
      const data = await this.makeRequest('/charges?type=mobile_money_ghana', 'POST', params);
      return data;
    } catch (error: any) {
      console.error('Flutterwave mobile money charge error:', error);
      throw new Error(error.message || 'Failed to charge mobile money');
    }
  }

  // USSD payment (Nigeria)
  async chargeUSSD(params: {
    tx_ref: string;
    amount: number;
    account_bank: string; // bank code
    email: string;
    phone_number: string;
    fullname: string;
  }): Promise<{ ussd_code: string }> {
    try {
      const data = await this.makeRequest('/charges?type=ussd', 'POST', {
        ...params,
        currency: 'NGN',
      });
      return data;
    } catch (error: any) {
      console.error('Flutterwave USSD charge error:', error);
      throw new Error(error.message || 'Failed to generate USSD code');
    }
  }
}

export const flutterwaveService = new FlutterwaveService();
