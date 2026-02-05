/**
 * GTBank (Guaranty Trust Bank) Integration
 * 
 * Implements GTBank's API for account verification, balance inquiry,
 * transaction history, and transfers.
 */

import { createHmac } from 'crypto';
import {
  BaseBankIntegration,
  BankAccount,
  BankTransaction,
  BankTransferRequest,
  BankTransferResponse,
  AccountLinkingRequest,
  AccountLinkingResponse,
  BankBalanceResponse,
} from './base';

export class GTBankIntegration extends BaseBankIntegration {
  constructor(apiKey: string, apiSecret: string) {
    super({
      bankCode: '058',
      bankName: 'GTBank',
      apiBaseUrl: process.env.GTBANK_API_URL || 'https://api.gtbank.com/v1',
      apiKey,
      apiSecret,
    });
  }

  protected generateAuthHeaders(): Record<string, string> {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp);

    return {
      'X-API-Key': this.apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    };
  }

  private generateSignature(timestamp: string): string {
    const message = `${this.apiKey}${timestamp}`;
    return createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  async verifyAccount(accountNumber: string): Promise<BankAccount | null> {
    try {
      const response = await this.makeRequest<{
        success: boolean;
        data: {
          accountNumber: string;
          accountName: string;
          accountType: string;
          currency: string;
          bvn?: string;
        };
      }>(`/accounts/verify/${accountNumber}`, 'GET');

      if (!response.success || !response.data) {
        return null;
      }

      return {
        accountNumber: response.data.accountNumber,
        accountName: response.data.accountName,
        accountType: this.mapAccountType(response.data.accountType),
        balance: '0.00', // Balance not returned in verification
        currency: response.data.currency || 'NGN',
        bvn: response.data.bvn,
      };
    } catch (error) {
      console.error('GTBank account verification error:', error);
      return null;
    }
  }

  async getBalance(accountNumber: string): Promise<BankBalanceResponse> {
    const response = await this.makeRequest<{
      success: boolean;
      data: {
        accountNumber: string;
        availableBalance: string;
        ledgerBalance: string;
        currency: string;
      };
    }>(`/accounts/${accountNumber}/balance`, 'GET');

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch account balance');
    }

    return {
      accountNumber: response.data.accountNumber,
      availableBalance: response.data.availableBalance,
      ledgerBalance: response.data.ledgerBalance,
      currency: response.data.currency || 'NGN',
    };
  }

  async getTransactions(
    accountNumber: string,
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<BankTransaction[]> {
    const response = await this.makeRequest<{
      success: boolean;
      data: {
        transactions: Array<{
          transactionId: string;
          type: string;
          amount: string;
          currency: string;
          description: string;
          balance: string;
          transactionDate: string;
          valueDate: string;
          reference?: string;
        }>;
      };
    }>(`/accounts/${accountNumber}/transactions`, 'POST', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit,
    });

    if (!response.success || !response.data?.transactions) {
      return [];
    }

    return response.data.transactions.map((txn) => ({
      transactionId: txn.transactionId,
      accountNumber,
      type: txn.type.toLowerCase() === 'credit' ? 'credit' : 'debit',
      amount: txn.amount,
      currency: txn.currency || 'NGN',
      description: txn.description,
      category: this.categorizeTransaction(txn.description),
      balance: txn.balance,
      transactionDate: new Date(txn.transactionDate),
      valueDate: new Date(txn.valueDate),
      reference: txn.reference,
    }));
  }

  async initiateAccountLinking(
    request: AccountLinkingRequest
  ): Promise<AccountLinkingResponse> {
    try {
      const response = await this.makeRequest<{
        success: boolean;
        data: {
          sessionId?: string;
          requiresOTP: boolean;
          account?: {
            accountNumber: string;
            accountName: string;
            accountType: string;
            balance: string;
            currency: string;
          };
        };
        message: string;
      }>('/accounts/link/initiate', 'POST', {
        accountNumber: request.accountNumber,
        bvn: request.bvn,
        phoneNumber: request.phoneNumber,
      });

      if (!response.success) {
        return {
          success: false,
          requiresOTP: false,
          message: response.message || 'Account linking failed',
        };
      }

      const result: AccountLinkingResponse = {
        success: true,
        requiresOTP: response.data.requiresOTP,
        message: response.message,
      };

      if (response.data.sessionId) {
        result.sessionId = response.data.sessionId;
      }

      if (response.data.account) {
        result.account = {
          accountNumber: response.data.account.accountNumber,
          accountName: response.data.account.accountName,
          accountType: this.mapAccountType(response.data.account.accountType),
          balance: response.data.account.balance,
          currency: response.data.account.currency || 'NGN',
        };
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        requiresOTP: false,
        message: error.message || 'Account linking failed',
      };
    }
  }

  async completeAccountLinking(
    sessionId: string,
    otp: string
  ): Promise<AccountLinkingResponse> {
    try {
      const response = await this.makeRequest<{
        success: boolean;
        data: {
          account: {
            accountNumber: string;
            accountName: string;
            accountType: string;
            balance: string;
            currency: string;
          };
        };
        message: string;
      }>('/accounts/link/complete', 'POST', {
        sessionId,
        otp,
      });

      if (!response.success || !response.data?.account) {
        return {
          success: false,
          requiresOTP: false,
          message: response.message || 'OTP verification failed',
        };
      }

      return {
        success: true,
        requiresOTP: false,
        account: {
          accountNumber: response.data.account.accountNumber,
          accountName: response.data.account.accountName,
          accountType: this.mapAccountType(response.data.account.accountType),
          balance: response.data.account.balance,
          currency: response.data.account.currency || 'NGN',
        },
        message: response.message,
      };
    } catch (error: any) {
      return {
        success: false,
        requiresOTP: false,
        message: error.message || 'OTP verification failed',
      };
    }
  }

  async initiateTransfer(
    request: BankTransferRequest
  ): Promise<BankTransferResponse> {
    try {
      const response = await this.makeRequest<{
        success: boolean;
        data: {
          transactionId: string;
          reference: string;
          fee?: string;
        };
        message: string;
      }>('/transfers/initiate', 'POST', {
        fromAccount: request.fromAccount,
        toAccount: request.toAccount,
        toBankCode: request.toBankCode,
        amount: request.amount,
        currency: request.currency || 'NGN',
        narration: request.narration,
        reference: request.reference || `TXN${Date.now()}`,
      });

      return {
        success: response.success,
        transactionId: response.data?.transactionId || '',
        reference: response.data?.reference || request.reference || '',
        message: response.message,
        fee: response.data?.fee,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        reference: request.reference || '',
        message: error.message || 'Transfer failed',
      };
    }
  }

  async getTransferStatus(transactionId: string): Promise<{
    status: 'pending' | 'successful' | 'failed';
    message: string;
  }> {
    try {
      const response = await this.makeRequest<{
        success: boolean;
        data: {
          status: string;
        };
        message: string;
      }>(`/transfers/${transactionId}/status`, 'GET');

      const statusMap: Record<string, 'pending' | 'successful' | 'failed'> = {
        pending: 'pending',
        processing: 'pending',
        completed: 'successful',
        successful: 'successful',
        failed: 'failed',
        reversed: 'failed',
      };

      return {
        status: statusMap[response.data?.status?.toLowerCase()] || 'pending',
        message: response.message,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: error.message || 'Failed to check transfer status',
      };
    }
  }

  private mapAccountType(type: string): 'savings' | 'current' | 'domiciliary' {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('savings')) return 'savings';
    if (lowerType.includes('current') || lowerType.includes('checking')) return 'current';
    if (lowerType.includes('domiciliary') || lowerType.includes('foreign')) return 'domiciliary';
    return 'savings'; // default
  }

  private categorizeTransaction(description: string): string {
    const desc = description.toLowerCase();
    
    if (desc.includes('transfer') || desc.includes('trf')) return 'transfer';
    if (desc.includes('atm') || desc.includes('withdrawal')) return 'withdrawal';
    if (desc.includes('pos') || desc.includes('purchase')) return 'shopping';
    if (desc.includes('bill') || desc.includes('payment')) return 'bills';
    if (desc.includes('salary') || desc.includes('income')) return 'income';
    if (desc.includes('airtime') || desc.includes('data')) return 'airtime';
    if (desc.includes('fee') || desc.includes('charge')) return 'fees';
    
    return 'other';
  }
}
