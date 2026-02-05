import AsyncStorage from '@react-native-async-storage/async-storage';
import { paystackService, PaystackConfig, PaystackTransaction, PaystackTransfer } from './paystack-service';
import { flutterwaveService, FlutterwaveConfig, FlutterwavePayment, FlutterwaveTransfer } from './flutterwave-service';

export type PaymentGateway = 'paystack' | 'flutterwave';

export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  paystack?: PaystackConfig;
  flutterwave?: FlutterwaveConfig;
}

export interface UnifiedPayment {
  amount: number;
  currency: 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'USD' | 'EUR' | 'GBP';
  email: string;
  reference: string;
  description?: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
}

export interface UnifiedTransfer {
  amount: number;
  currency: 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'USD';
  accountNumber: string;
  bankCode: string;
  accountName?: string;
  narration?: string;
  reference?: string;
}

export interface UnifiedBank {
  code: string;
  name: string;
  country: string;
}

class PaymentGatewayService {
  private currentGateway: PaymentGateway = 'paystack';
  private readonly GATEWAY_STORAGE_KEY = '@payment_gateway_preference';

  async initialize(config: PaymentGatewayConfig): Promise<void> {
    this.currentGateway = config.gateway;
    await AsyncStorage.setItem(this.GATEWAY_STORAGE_KEY, config.gateway);

    if (config.gateway === 'paystack' && config.paystack) {
      await paystackService.initialize(config.paystack);
    } else if (config.gateway === 'flutterwave' && config.flutterwave) {
      await flutterwaveService.initialize(config.flutterwave);
    }
  }

  async getCurrentGateway(): Promise<PaymentGateway> {
    const stored = await AsyncStorage.getItem(this.GATEWAY_STORAGE_KEY);
    if (stored) {
      this.currentGateway = stored as PaymentGateway;
    }
    return this.currentGateway;
  }

  async setGateway(gateway: PaymentGateway): Promise<void> {
    this.currentGateway = gateway;
    await AsyncStorage.setItem(this.GATEWAY_STORAGE_KEY, gateway);
  }

  // Unified payment initialization
  async initializePayment(payment: UnifiedPayment): Promise<{ url: string; reference: string }> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        const paystackPayment: PaystackTransaction = {
          reference: payment.reference,
          amount: payment.amount * 100, // Convert to kobo
          email: payment.email,
          currency: payment.currency as any,
          metadata: payment.metadata,
        };

        const result = await paystackService.initializeTransaction(paystackPayment);
        return {
          url: result.authorization_url,
          reference: result.reference,
        };
      } else {
        const flutterwavePayment: FlutterwavePayment = {
          tx_ref: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          customer: {
            email: payment.email,
            name: payment.customerName || 'Customer',
            phonenumber: payment.customerPhone,
          },
          customizations: {
            title: 'Payment',
            description: payment.description || 'Payment for services',
          },
          meta: payment.metadata,
        };

        const result = await flutterwaveService.initializePayment(flutterwavePayment);
        return {
          url: result.link,
          reference: payment.reference,
        };
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      throw new Error(error.message || 'Failed to initialize payment');
    }
  }

  // Verify transaction
  async verifyTransaction(reference: string): Promise<any> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        return await paystackService.verifyTransaction(reference);
      } else {
        return await flutterwaveService.verifyTransaction(reference);
      }
    } catch (error: any) {
      console.error('Transaction verification error:', error);
      throw new Error(error.message || 'Failed to verify transaction');
    }
  }

  // Get banks
  async getBanks(country: 'nigeria' | 'ghana' | 'kenya' | 'south africa'): Promise<UnifiedBank[]> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        const banks = await paystackService.getBanks(country === 'kenya' ? 'nigeria' : country);
        return banks.map(bank => ({
          code: bank.code,
          name: bank.name,
          country: bank.country,
        }));
      } else {
        const countryCode = {
          'nigeria': 'NG',
          'ghana': 'GH',
          'kenya': 'KE',
          'south africa': 'ZA',
        }[country] as 'NG' | 'GH' | 'KE' | 'ZA';

        const banks = await flutterwaveService.getBanks(countryCode);
        return banks.map(bank => ({
          code: bank.code,
          name: bank.name,
          country: countryCode,
        }));
      }
    } catch (error: any) {
      console.error('Get banks error:', error);
      throw new Error(error.message || 'Failed to fetch banks');
    }
  }

  // Resolve account number
  async resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountNumber: string; accountName: string }> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        const result = await paystackService.resolveAccountNumber(accountNumber, bankCode);
        return {
          accountNumber: result.account_number,
          accountName: result.account_name,
        };
      } else {
        const result = await flutterwaveService.resolveAccount(accountNumber, bankCode);
        return {
          accountNumber: result.account_number,
          accountName: result.account_name,
        };
      }
    } catch (error: any) {
      console.error('Resolve account error:', error);
      throw new Error(error.message || 'Failed to resolve account');
    }
  }

  // Create transfer
  async createTransfer(transfer: UnifiedTransfer): Promise<{ reference: string; status: string }> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        // First create recipient
        const recipient = await paystackService.createTransferRecipient({
          type: 'nuban',
          name: transfer.accountName || 'Recipient',
          account_number: transfer.accountNumber,
          bank_code: transfer.bankCode,
          currency: transfer.currency as 'NGN' | 'GHS' | 'ZAR' | 'USD',
        });

        // Then initiate transfer
        const result = await paystackService.initiateTransfer({
          source: 'balance',
          amount: transfer.amount * 100, // Convert to kobo
          recipient: recipient.recipient_code,
          reason: transfer.narration,
          reference: transfer.reference,
        });

        return {
          reference: result.reference,
          status: result.status,
        };
      } else {
        const flutterwaveTransfer: FlutterwaveTransfer = {
          account_bank: transfer.bankCode,
          account_number: transfer.accountNumber,
          amount: transfer.amount,
          currency: transfer.currency as 'NGN' | 'GHS' | 'ZAR' | 'USD',
          narration: transfer.narration,
          reference: transfer.reference,
          beneficiary_name: transfer.accountName,
        };

        const result = await flutterwaveService.createTransfer(flutterwaveTransfer);
        return {
          reference: result.reference,
          status: result.status,
        };
      }
    } catch (error: any) {
      console.error('Create transfer error:', error);
      throw new Error(error.message || 'Failed to create transfer');
    }
  }

  // Get balance
  async getBalance(): Promise<{ currency: string; balance: number }[]> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        const balances = await paystackService.getBalance();
        return balances.map(b => ({
          currency: b.currency,
          balance: b.balance / 100, // Convert from kobo
        }));
      } else {
        const balances = await flutterwaveService.getBalance();
        return balances.map(b => ({
          currency: b.currency,
          balance: b.available_balance,
        }));
      }
    } catch (error: any) {
      console.error('Get balance error:', error);
      throw new Error(error.message || 'Failed to fetch balance');
    }
  }

  // List transactions
  async listTransactions(params?: { from?: string; to?: string; page?: number }): Promise<any[]> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        return await paystackService.listTransactions(params);
      } else {
        const result = await flutterwaveService.listTransactions(params);
        return result;
      }
    } catch (error: any) {
      console.error('List transactions error:', error);
      throw new Error(error.message || 'Failed to fetch transactions');
    }
  }

  // Create virtual account
  async createVirtualAccount(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  }): Promise<{ accountNumber: string; bankName: string; accountName: string }> {
    const gateway = await this.getCurrentGateway();

    try {
      if (gateway === 'paystack') {
        const result = await paystackService.createVirtualAccount({
          email: params.email,
          first_name: params.firstName,
          last_name: params.lastName,
          phone: params.phone,
        });
        return {
          accountNumber: result.account_number,
          bankName: result.bank_name,
          accountName: result.account_name,
        };
      } else {
        const result = await flutterwaveService.createVirtualAccount({
          email: params.email,
          is_permanent: true,
          tx_ref: `VA-${Date.now()}`,
          firstname: params.firstName,
          lastname: params.lastName,
        });
        return {
          accountNumber: result.account_number,
          bankName: result.bank_name,
          accountName: result.account_name,
        };
      }
    } catch (error: any) {
      console.error('Create virtual account error:', error);
      throw new Error(error.message || 'Failed to create virtual account');
    }
  }

  // Get recommended gateway for country
  getRecommendedGateway(country: 'nigeria' | 'ghana' | 'kenya' | 'south africa'): PaymentGateway {
    // Paystack is best for Nigeria and Ghana
    // Flutterwave has better coverage for Kenya and South Africa
    if (country === 'nigeria' || country === 'ghana') {
      return 'paystack';
    }
    return 'flutterwave';
  }
}

export const paymentGatewayService = new PaymentGatewayService();
