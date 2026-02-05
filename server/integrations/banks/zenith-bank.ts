/**
 * Zenith Bank Integration
 * 
 * Implements Zenith Bank's API for account verification, balance inquiry,
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

export class ZenithBankIntegration extends BaseBankIntegration {
  constructor(apiKey: string, apiSecret: string) {
    super({
      bankCode: '057',
      bankName: 'Zenith Bank',
      apiBaseUrl: process.env.ZENITH_BANK_API_URL || 'https://api.zenithbank.com/v2',
      apiKey,
      apiSecret,
    });
  }

  protected generateAuthHeaders(): Record<string, string> {
    const timestamp = Date.now().toString();
    const requestId = `ZEN${timestamp}${Math.random().toString(36).substring(7)}`;
    const signature = this.generateSignature(requestId, timestamp);

    return {
      'X-Auth-Token': this.apiKey,
      'X-Request-ID': requestId,
      'X-Timestamp': timestamp,
      'X-Auth-Signature': signature,
    };
  }

  private generateSignature(requestId: string, timestamp: string): string {
    const message = `${requestId}|${this.apiKey}|${timestamp}`;
    return createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex')
      .toUpperCase();
  }

  async verifyAccount(accountNumber: string): Promise<BankAccount | null> {
    try {
      const response = await this.makeRequest<{
        status: string;
        message: string;
        data: {
          accountNumber: string;
          accountName: string;
          accountType: string;
          currency: string;
          bvn?: string;
        };
      }>(`/accounts/name-enquiry`, 'POST', {
        accountNumber,
      });

      if (response.status !== 'success' || !response.data) {
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
      console.error('Zenith Bank account verification error:', error);
      return null;
    }
  }

  async getBalance(accountNumber: string): Promise<BankBalanceResponse> {
    const response = await this.makeRequest<{
      status: string;
      message: string;
      data: {
        accountNumber: string;
        availableBalance: string;
        ledgerBalance: string;
        currency: string;
      };
    }>(`/accounts/balance-enquiry`, 'POST', {
      accountNumber,
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error(response.message || 'Failed to fetch account balance');
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
      status: string;
      message: string;
      data: {
        transactions: Array<{
          transactionReference: string;
          transactionType: string;
          amount: string;
          currency: string;
          narration: string;
          closingBalance: string;
          transactionDate: string;
          valueDate: string;
          externalReference?: string;
        }>;
      };
    }>(`/accounts/statement`, 'POST', {
      accountNumber,
      fromDate: this.formatDate(startDate),
      toDate: this.formatDate(endDate),
      recordCount: limit,
    });

    if (response.status !== 'success' || !response.data?.transactions) {
      return [];
    }

    return response.data.transactions.map((txn) => ({
      transactionId: txn.transactionReference,
      accountNumber,
      type: txn.transactionType.toUpperCase() === 'CR' || txn.transactionType.toLowerCase() === 'credit' ? 'credit' : 'debit',
      amount: txn.amount,
      currency: txn.currency || 'NGN',
      description: txn.narration,
      category: this.categorizeTransaction(txn.narration),
      balance: txn.closingBalance,
      transactionDate: new Date(txn.transactionDate),
      valueDate: new Date(txn.valueDate),
      reference: txn.externalReference,
    }));
  }

  async initiateAccountLinking(
    request: AccountLinkingRequest
  ): Promise<AccountLinkingResponse> {
    try {
      const response = await this.makeRequest<{
        status: string;
        message: string;
        data: {
          sessionToken?: string;
          otpRequired: boolean;
          accountDetails?: {
            accountNumber: string;
            accountName: string;
            accountType: string;
            balance: string;
            currency: string;
          };
        };
      }>('/accounts/link/initiate', 'POST', {
        accountNumber: request.accountNumber,
        bvn: request.bvn,
        phoneNumber: request.phoneNumber,
      });

      if (response.status !== 'success') {
        return {
          success: false,
          requiresOTP: false,
          message: response.message || 'Account linking failed',
        };
      }

      const result: AccountLinkingResponse = {
        success: true,
        requiresOTP: response.data.otpRequired,
        message: response.message,
      };

      if (response.data.sessionToken) {
        result.sessionId = response.data.sessionToken;
      }

      if (response.data.accountDetails) {
        result.account = {
          accountNumber: response.data.accountDetails.accountNumber,
          accountName: response.data.accountDetails.accountName,
          accountType: this.mapAccountType(response.data.accountDetails.accountType),
          balance: response.data.accountDetails.balance,
          currency: response.data.accountDetails.currency || 'NGN',
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
        status: string;
        message: string;
        data: {
          accountDetails: {
            accountNumber: string;
            accountName: string;
            accountType: string;
            balance: string;
            currency: string;
          };
        };
      }>('/accounts/link/validate', 'POST', {
        sessionToken: sessionId,
        otpCode: otp,
      });

      if (response.status !== 'success' || !response.data?.accountDetails) {
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
          accountNumber: response.data.accountDetails.accountNumber,
          accountName: response.data.accountDetails.accountName,
          accountType: this.mapAccountType(response.data.accountDetails.accountType),
          balance: response.data.accountDetails.balance,
          currency: response.data.accountDetails.currency || 'NGN',
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
        status: string;
        message: string;
        data: {
          transactionId: string;
          transactionReference: string;
          transferFee?: string;
        };
      }>('/transfers/single', 'POST', {
        debitAccount: request.fromAccount,
        beneficiaryAccount: request.toAccount,
        beneficiaryBankCode: request.toBankCode,
        transferAmount: request.amount,
        currencyCode: request.currency || 'NGN',
        paymentNarration: request.narration,
        clientReference: request.reference || `ZENTXN${Date.now()}`,
      });

      return {
        success: response.status === 'success',
        transactionId: response.data?.transactionId || '',
        reference: response.data?.transactionReference || request.reference || '',
        message: response.message,
        fee: response.data?.transferFee,
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
        status: string;
        message: string;
        data: {
          transactionStatus: string;
        };
      }>(`/transfers/status-query`, 'POST', {
        transactionId,
      });

      const statusMap: Record<string, 'pending' | 'successful' | 'failed'> = {
        pending: 'pending',
        processing: 'pending',
        'in-progress': 'pending',
        successful: 'successful',
        completed: 'successful',
        approved: 'successful',
        failed: 'failed',
        rejected: 'failed',
        reversed: 'failed',
      };

      return {
        status: statusMap[response.data?.transactionStatus?.toLowerCase()] || 'pending',
        message: response.message,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        message: error.message || 'Failed to check transfer status',
      };
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapAccountType(type: string): 'savings' | 'current' | 'domiciliary' {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('savings') || lowerType.includes('sav')) return 'savings';
    if (lowerType.includes('current') || lowerType.includes('chq') || lowerType.includes('checking')) return 'current';
    if (lowerType.includes('domiciliary') || lowerType.includes('dom') || lowerType.includes('usd') || lowerType.includes('foreign')) return 'domiciliary';
    return 'savings';
  }

  private categorizeTransaction(narration: string): string {
    const desc = narration.toLowerCase();
    
    if (desc.includes('transfer') || desc.includes('trf') || desc.includes('trsf')) return 'transfer';
    if (desc.includes('atm') || desc.includes('withdrawal') || desc.includes('cash')) return 'withdrawal';
    if (desc.includes('pos') || desc.includes('purchase') || desc.includes('web')) return 'shopping';
    if (desc.includes('bill') || desc.includes('utility') || desc.includes('payment')) return 'bills';
    if (desc.includes('salary') || desc.includes('income') || desc.includes('deposit')) return 'income';
    if (desc.includes('airtime') || desc.includes('data') || desc.includes('recharge') || desc.includes('topup')) return 'airtime';
    if (desc.includes('fee') || desc.includes('charge') || desc.includes('vat') || desc.includes('commission')) return 'fees';
    
    return 'other';
  }
}
