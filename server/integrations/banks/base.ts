/**
 * Base Bank Integration Framework
 * 
 * Provides a unified interface for integrating with multiple Nigerian banks
 * including GTBank, Access Bank, and Zenith Bank.
 */

export interface BankAccount {
  accountNumber: string;
  accountName: string;
  accountType: 'savings' | 'current' | 'domiciliary';
  balance: string;
  currency: string;
  bvn?: string;
}

export interface BankTransaction {
  transactionId: string;
  accountNumber: string;
  type: 'credit' | 'debit';
  amount: string;
  currency: string;
  description: string;
  category?: string;
  balance: string;
  transactionDate: Date;
  valueDate: Date;
  reference?: string;
}

export interface BankTransferRequest {
  fromAccount: string;
  toAccount: string;
  toBankCode: string;
  amount: string;
  currency: string;
  narration: string;
  reference?: string;
}

export interface BankTransferResponse {
  success: boolean;
  transactionId: string;
  reference: string;
  message: string;
  fee?: string;
}

export interface AccountLinkingRequest {
  accountNumber: string;
  bvn: string;
  phoneNumber: string;
  otp?: string;
}

export interface AccountLinkingResponse {
  success: boolean;
  sessionId?: string;
  requiresOTP: boolean;
  account?: BankAccount;
  message: string;
}

export interface BankBalanceResponse {
  accountNumber: string;
  availableBalance: string;
  ledgerBalance: string;
  currency: string;
}

/**
 * Base class for all bank integrations
 */
export abstract class BaseBankIntegration {
  protected bankCode: string;
  protected bankName: string;
  protected apiBaseUrl: string;
  protected apiKey: string;
  protected apiSecret: string;

  constructor(config: {
    bankCode: string;
    bankName: string;
    apiBaseUrl: string;
    apiKey: string;
    apiSecret: string;
  }) {
    this.bankCode = config.bankCode;
    this.bankName = config.bankName;
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  /**
   * Verify account number and get account details
   */
  abstract verifyAccount(accountNumber: string): Promise<BankAccount | null>;

  /**
   * Get account balance
   */
  abstract getBalance(accountNumber: string): Promise<BankBalanceResponse>;

  /**
   * Get transaction history
   */
  abstract getTransactions(
    accountNumber: string,
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<BankTransaction[]>;

  /**
   * Initiate account linking (may require OTP)
   */
  abstract initiateAccountLinking(
    request: AccountLinkingRequest
  ): Promise<AccountLinkingResponse>;

  /**
   * Complete account linking with OTP
   */
  abstract completeAccountLinking(
    sessionId: string,
    otp: string
  ): Promise<AccountLinkingResponse>;

  /**
   * Initiate money transfer
   */
  abstract initiateTransfer(
    request: BankTransferRequest
  ): Promise<BankTransferResponse>;

  /**
   * Get transfer status
   */
  abstract getTransferStatus(transactionId: string): Promise<{
    status: 'pending' | 'successful' | 'failed';
    message: string;
  }>;

  /**
   * Generate authentication headers for API requests
   */
  protected abstract generateAuthHeaders(): Record<string, string>;

  /**
   * Make authenticated API request
   */
  protected async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.generateAuthHeaders(),
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Bank API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get bank code
   */
  getBankCode(): string {
    return this.bankCode;
  }

  /**
   * Get bank name
   */
  getBankName(): string {
    return this.bankName;
  }
}

/**
 * Bank integration factory
 */
export class BankIntegrationFactory {
  private static integrations: Map<string, BaseBankIntegration> = new Map();

  static registerIntegration(bankCode: string, integration: BaseBankIntegration): void {
    this.integrations.set(bankCode, integration);
  }

  static getIntegration(bankCode: string): BaseBankIntegration | null {
    return this.integrations.get(bankCode) || null;
  }

  static getAllBankCodes(): string[] {
    return Array.from(this.integrations.keys());
  }

  static getAllIntegrations(): BaseBankIntegration[] {
    return Array.from(this.integrations.values());
  }
}
