import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Paystack API configuration
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY_STORAGE = '@paystack_secret_key';

export interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  environment: 'test' | 'live';
}

export interface PaystackTransaction {
  reference: string;
  amount: number; // in kobo (smallest currency unit)
  email: string;
  currency: 'NGN' | 'GHS' | 'ZAR' | 'USD';
  metadata?: Record<string, any>;
  channels?: ('card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer')[];
  callback_url?: string;
}

export interface PaystackTransferRecipient {
  type: 'nuban' | 'mobile_money' | 'basa';
  name: string;
  account_number: string;
  bank_code: string;
  currency: 'NGN' | 'GHS' | 'ZAR' | 'USD';
  metadata?: Record<string, any>;
}

export interface PaystackTransfer {
  source: 'balance';
  amount: number; // in kobo
  recipient: string; // recipient code
  reason?: string;
  reference?: string;
}

export interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode: string;
  gateway: string | null;
  pay_with_bank: boolean;
  active: boolean;
  is_deleted: boolean;
  country: string;
  currency: string;
  type: string;
}

class PaystackService {
  private secretKey: string | null = null;
  private publicKey: string | null = null;

  async initialize(config: PaystackConfig): Promise<void> {
    this.publicKey = config.publicKey;
    this.secretKey = config.secretKey;
    
    // Store secret key securely
    await SecureStore.setItemAsync(PAYSTACK_SECRET_KEY_STORAGE, config.secretKey);
  }

  private async getSecretKey(): Promise<string> {
    if (this.secretKey) return this.secretKey;
    
    const stored = await SecureStore.getItemAsync(PAYSTACK_SECRET_KEY_STORAGE);
    if (!stored) {
      throw new Error('Paystack not initialized. Please configure API keys.');
    }
    
    this.secretKey = stored;
    return stored;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
    const secretKey = await this.getSecretKey();
    
    const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok || !data.status) {
      throw new Error(data.message || 'Paystack API request failed');
    }

    return data.data;
  }

  // Initialize transaction
  async initializeTransaction(transaction: PaystackTransaction): Promise<{ authorization_url: string; access_code: string; reference: string }> {
    try {
      const data = await this.makeRequest('/transaction/initialize', 'POST', transaction);
      return data;
    } catch (error: any) {
      console.error('Paystack initialize transaction error:', error);
      throw new Error(error.message || 'Failed to initialize transaction');
    }
  }

  // Verify transaction
  async verifyTransaction(reference: string): Promise<any> {
    try {
      const data = await this.makeRequest(`/transaction/verify/${reference}`);
      return data;
    } catch (error: any) {
      console.error('Paystack verify transaction error:', error);
      throw new Error(error.message || 'Failed to verify transaction');
    }
  }

  // Get list of banks
  async getBanks(country: 'nigeria' | 'ghana' | 'south africa' = 'nigeria'): Promise<PaystackBank[]> {
    try {
      const data = await this.makeRequest(`/bank?country=${country}`);
      return data;
    } catch (error: any) {
      console.error('Paystack get banks error:', error);
      throw new Error(error.message || 'Failed to fetch banks');
    }
  }

  // Resolve account number
  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{ account_number: string; account_name: string; bank_id: number }> {
    try {
      const data = await this.makeRequest(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
      return data;
    } catch (error: any) {
      console.error('Paystack resolve account error:', error);
      throw new Error(error.message || 'Failed to resolve account number');
    }
  }

  // Create transfer recipient
  async createTransferRecipient(recipient: PaystackTransferRecipient): Promise<{ recipient_code: string; details: any }> {
    try {
      const data = await this.makeRequest('/transferrecipient', 'POST', recipient);
      return data;
    } catch (error: any) {
      console.error('Paystack create recipient error:', error);
      throw new Error(error.message || 'Failed to create transfer recipient');
    }
  }

  // Initiate transfer
  async initiateTransfer(transfer: PaystackTransfer): Promise<{ transfer_code: string; status: string; reference: string }> {
    try {
      const data = await this.makeRequest('/transfer', 'POST', transfer);
      return data;
    } catch (error: any) {
      console.error('Paystack initiate transfer error:', error);
      throw new Error(error.message || 'Failed to initiate transfer');
    }
  }

  // Finalize transfer (for OTP verification)
  async finalizeTransfer(transferCode: string, otp: string): Promise<any> {
    try {
      const data = await this.makeRequest('/transfer/finalize_transfer', 'POST', {
        transfer_code: transferCode,
        otp,
      });
      return data;
    } catch (error: any) {
      console.error('Paystack finalize transfer error:', error);
      throw new Error(error.message || 'Failed to finalize transfer');
    }
  }

  // Verify transfer
  async verifyTransfer(reference: string): Promise<any> {
    try {
      const data = await this.makeRequest(`/transfer/verify/${reference}`);
      return data;
    } catch (error: any) {
      console.error('Paystack verify transfer error:', error);
      throw new Error(error.message || 'Failed to verify transfer');
    }
  }

  // Get balance
  async getBalance(): Promise<{ balance: number; currency: string }[]> {
    try {
      const data = await this.makeRequest('/balance');
      return data;
    } catch (error: any) {
      console.error('Paystack get balance error:', error);
      throw new Error(error.message || 'Failed to fetch balance');
    }
  }

  // List transactions
  async listTransactions(params?: { perPage?: number; page?: number; from?: string; to?: string }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams(params as any).toString();
      const data = await this.makeRequest(`/transaction?${queryParams}`);
      return data;
    } catch (error: any) {
      console.error('Paystack list transactions error:', error);
      throw new Error(error.message || 'Failed to fetch transactions');
    }
  }

  // Create virtual account (Dedicated NUBAN)
  async createVirtualAccount(customer: { email: string; first_name: string; last_name: string; phone: string }): Promise<any> {
    try {
      // First create customer
      const customerData = await this.makeRequest('/customer', 'POST', customer);
      
      // Then create dedicated virtual account
      const virtualAccount = await this.makeRequest('/dedicated_account', 'POST', {
        customer: customerData.customer_code,
        preferred_bank: 'wema-bank', // or 'titan-paystack'
      });
      
      return virtualAccount;
    } catch (error: any) {
      console.error('Paystack create virtual account error:', error);
      throw new Error(error.message || 'Failed to create virtual account');
    }
  }

  // Charge authorization (for saved cards)
  async chargeAuthorization(params: {
    authorization_code: string;
    email: string;
    amount: number;
    currency?: string;
    reference?: string;
  }): Promise<any> {
    try {
      const data = await this.makeRequest('/transaction/charge_authorization', 'POST', params);
      return data;
    } catch (error: any) {
      console.error('Paystack charge authorization error:', error);
      throw new Error(error.message || 'Failed to charge authorization');
    }
  }
}

export const paystackService = new PaystackService();
