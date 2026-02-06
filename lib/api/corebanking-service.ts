const COREBANKING_URL = process.env.EXPO_PUBLIC_COREBANKING_URL || 'http://127.0.0.1:8113';

export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  account_type: 'checking' | 'savings' | 'wallet' | 'fixed_deposit' | 'joint' | 'family';
  balance: number;
  currency: string;
  status: 'active' | 'suspended' | 'closed' | 'frozen';
  interest_rate: number;
  daily_limit: number;
  created_at: string;
  updated_at: string;
  joint_owners?: string[];
  family_group_id?: string;
}

export interface LedgerEntry {
  id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  description: string;
  reference: string;
  entry_type: string;
  counterpart_id?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  reference: string;
  fee: number;
  exchange_rate?: number;
  created_at: string;
  completed_at?: string;
}

export interface Statement {
  account_id: string;
  account_number: string;
  currency: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_credits: number;
  total_debits: number;
  total_fees: number;
  interest_earned: number;
  entries: LedgerEntry[];
  generated_at: string;
}

export interface VirtualCard {
  id: string;
  account_id: string;
  card_number: string;
  expiry_month: number;
  expiry_year: number;
  cvv: string;
  status: string;
  spend_limit: number;
  total_spent: number;
  created_at: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: string;
}

class CoreBankingService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${COREBANKING_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async createAccount(params: {
    user_id: string;
    account_type: Account['account_type'];
    currency?: string;
    initial_deposit?: number;
    joint_owners?: string[];
    family_group_id?: string;
  }): Promise<Account> {
    return this.request('/accounts/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getAccount(accountId: string): Promise<Account> {
    return this.request(`/accounts/${accountId}`);
  }

  async getUserAccounts(userId: string): Promise<{ accounts: Account[]; total: number }> {
    return this.request(`/accounts/user?user_id=${userId}`);
  }

  async transfer(params: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    currency?: string;
    description?: string;
  }): Promise<Transaction> {
    return this.request('/transfer', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async deposit(params: {
    account_id: string;
    amount: number;
    description?: string;
    channel?: string;
  }): Promise<{ transaction: Transaction; ledger_entry: LedgerEntry; new_balance: number }> {
    return this.request('/deposit', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async withdraw(params: {
    account_id: string;
    amount: number;
    description?: string;
    channel?: string;
  }): Promise<{ transaction: Transaction; ledger_entry: LedgerEntry; new_balance: number }> {
    return this.request('/withdraw', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getStatement(accountId: string, days?: number): Promise<Statement> {
    return this.request(`/statement?account_id=${accountId}&days=${days || 30}`);
  }

  async getLedger(accountId: string, limit?: number): Promise<{ account_id: string; entries: LedgerEntry[]; total: number }> {
    return this.request(`/ledger?account_id=${accountId}&limit=${limit || 50}`);
  }

  async getTransactions(accountId: string, limit?: number): Promise<{ transactions: Transaction[]; total: number }> {
    return this.request(`/transactions?account_id=${accountId}&limit=${limit || 50}`);
  }

  async accrueInterest(): Promise<{ accruals_processed: number; accruals: Array<Record<string, unknown>> }> {
    return this.request('/interest/accrue', { method: 'POST' });
  }

  async createVirtualCard(params: { account_id: string; spend_limit: number }): Promise<VirtualCard> {
    return this.request('/cards/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getExchangeRates(base?: string): Promise<{ base: string; rates: ExchangeRate[] }> {
    return this.request(`/exchange-rates?base=${base || 'NGN'}`);
  }

  async createFamilyGroup(params: { name: string; owner_id: string; members: string[] }): Promise<Record<string, unknown>> {
    return this.request('/family/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async freezeAccount(accountId: string, reason: string): Promise<Record<string, unknown>> {
    return this.request('/accounts/freeze', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, reason }),
    });
  }

  async unfreezeAccount(accountId: string): Promise<Account> {
    return this.request('/accounts/unfreeze', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    });
  }

  async closeAccount(accountId: string, transferTo?: string, reason?: string): Promise<Record<string, unknown>> {
    return this.request('/accounts/close', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, transfer_to: transferTo, reason }),
    });
  }
}

export const coreBankingService = new CoreBankingService();
