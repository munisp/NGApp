/**
 * Access Bank Integration
 * 
 * Implements Access Bank's API for account verification, balance inquiry,
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

export class AccessBankIntegration extends BaseBankIntegration {
  constructor(apiKey: string, apiSecret: string) {
    super({
      bankCode: '044',
      bankName: 'Access Bank',
      apiBaseUrl: process.env.ACCESS_BANK_API_URL || 'https://api.accessbankplc.com/v1',
      apiKey,
      apiSecret,
    });
  }

  protected generateAuthHeaders(): Record<string, string> {
    const timestamp = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(7);
    const signature = this.generateSignature(timestamp, nonce);

    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
    };
  }

  private generateSignature(timestamp: string, nonce: string): string {
    const message = `${this.apiKey}${timestamp}${nonce}`;
    return createHmac('sha512', this.apiSecret)
      .update(message)
      .digest('base64');
  }

  async verifyAccount(accountNumber: string): Promise<BankAccount | null> {
    try {
      const response = await this.makeRequest<{
        responseCode: string;
        responseMessage: string;
        data: {
          accountNumber: string;
          accountName: string;
          accountType: string;
          currency: string;
          bvn?: string;
        };
      }>(`/account/inquiry`, 'POST', {
        accountNumber,
      });

      if (response.responseCode !== '00' || !response.data) {
        return null;
      }

      return {
        accountNumber: response.data.accountNumber,
        accountName: response.data.accountName,
        accountType: this.mapAccountType(response.data.accountType),
        balance: '0.00',
        currency: response.data.currency || 'NGN',
        bvn: response.data.bvn,
      };
    } catch (error) {
      console.error('Access Bank account verification error:', error);
      return null;
    }
  }

  async getBalance(accountNumber: string): Promise<BankBalanceResponse> {
    const response = await this.makeRequest<{
      responseCode: string;
      responseMessage: string;
      data: {
        accountNumber: string;
        availableBalance: string;
        ledgerBalance: string;
        currency: string;
      };
    }>(`/account/balance`, 'POST', {
      accountNumber,
    });

    if (response.responseCode !== '00' || !response.data) {
      throw new Error(response.responseMessage || 'Failed to fetch account balance');
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
      responseCode: string;
      responseMessage: string;
      data: {
        transactions: Array<{
          id: string;
          transactionType: string;
          amount: string;
          currency: string;
          narration: string;
          balanceAfter: string;
          transactionDate: string;
          valueDate: string;
          reference?: string;
        }>;
      };
    }>(`/account/transactions`, 'POST', {
      accountNumber,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      pageSize: limit,
    });

    if (response.responseCode !== '00' || !response.data?.transactions) {
      return [];
    }

    return response.data.transactions.map((txn) => ({
      transactionId: txn.id,
      accountNumber,
      type: txn.transactionType.toLowerCase() === 'c' || txn.transactionType.toLowerCase() === 'credit' ? 'credit' : 'debit',
      amount: txn.amount,
      currency: txn.currency || 'NGN',
      description: txn.narration,
      category: this.categorizeTransaction(txn.narration),
      balance: txn.balanceAfter,
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
        responseCode: string;
        responseMessage: string;
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
      }>('/account/link/request', 'POST', {
        accountNumber: request.accountNumber,
        bvn: request.bvn,
        phoneNumber: request.phoneNumber,
      });

      if (response.responseCode !== '00') {
        return {
          success: false,
          requiresOTP: false,
          message: response.responseMessage || 'Account linking failed',
        };
      }

      const result: AccountLinkingResponse = {
        success: true,
        requiresOTP: response.data.requiresOTP,
        message: response.responseMessage,
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
        responseCode: string;
        responseMessage: string;
        data: {
          account: {
            accountNumber: string;
            accountName: string;
            accountType: string;
            balance: string;
            currency: string;
          };
        };
      }>('/account/link/verify', 'POST', {
        sessionId,
        otp,
      });

      if (response.responseCode !== '00' || !response.data?.account) {
        return {
          success: false,
          requiresOTP: false,
          message: response.responseMessage || 'OTP verification failed',
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
        message: response.responseMessage,
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
        responseCode: string;
        responseMessage: string;
        data: {
          transactionId: string;
          reference: string;
          fee?: string;
        };
      }>('/transfer/initiate', 'POST', {
        sourceAccount: request.fromAccount,
        destinationAccount: request.toAccount,
        destinationBankCode: request.toBankCode,
        amount: request.amount,
        currency: request.currency || 'NGN',
        narration: request.narration,
        reference: request.reference || `ACCTXN${Date.now()}`,
      });

      return {
        success: response.responseCode === '00',
        transactionId: response.data?.transactionId || '',
        reference: response.data?.reference || request.reference || '',
        message: response.responseMessage,
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
        responseCode: string;
        responseMessage: string;
        data: {
          status: string;
        };
      }>(`/transfer/status`, 'POST', {
        transactionId,
      });

      const statusMap: Record<string, 'pending' | 'successful' | 'failed'> = {
        pending: 'pending',
        processing: 'pending',
        successful: 'successful',
        completed: 'successful',
        failed: 'failed',
        reversed: 'failed',
      };

      return {
        status: statusMap[response.data?.status?.toLowerCase()] || 'pending',
        message: response.responseMessage,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: error.message || 'Failed to check transfer status',
      };
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private mapAccountType(type: string): 'savings' | 'current' | 'domiciliary' {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('savings') || lowerType.includes('sav')) return 'savings';
    if (lowerType.includes('current') || lowerType.includes('checking')) return 'current';
    if (lowerType.includes('domiciliary') || lowerType.includes('dom') || lowerType.includes('foreign')) return 'domiciliary';
    return 'savings';
  }

  private categorizeTransaction(narration: string): string {
    const desc = narration.toLowerCase();
    
    if (desc.includes('transfer') || desc.includes('trf')) return 'transfer';
    if (desc.includes('atm') || desc.includes('withdrawal') || desc.includes('wdl')) return 'withdrawal';
    if (desc.includes('pos') || desc.includes('purchase') || desc.includes('payment')) return 'shopping';
    if (desc.includes('bill') || desc.includes('utility')) return 'bills';
    if (desc.includes('salary') || desc.includes('income') || desc.includes('credit alert')) return 'income';
    if (desc.includes('airtime') || desc.includes('data') || desc.includes('recharge')) return 'airtime';
    if (desc.includes('fee') || desc.includes('charge') || desc.includes('commission')) return 'fees';
    
    return 'other';
  }
}
