import AsyncStorage from '@react-native-async-storage/async-storage';
import { fraudDetectionAPI, type FraudCheckRequest, type FraudCheckResponse } from '../api/fraud-detection';

/**
 * Transaction Limits Service
 * Enforces daily, weekly, and per-transaction limits
 */

export interface TransactionLimit {
  daily: number;
  weekly: number;
  perTransaction: number;
  currency: string;
}

export interface TransactionUsage {
  dailyUsed: number;
  weeklyUsed: number;
  lastResetDate: string;
  lastWeekResetDate: string;
  transactions: TransactionRecord[];
}

export interface TransactionRecord {
  id: string;
  amount: number;
  currency: string;
  timestamp: string;
  type: 'send' | 'receive' | 'withdraw' | 'deposit';
  status: 'pending' | 'completed' | 'failed';
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  remainingDaily?: number;
  remainingWeekly?: number;
  limitType?: 'daily' | 'weekly' | 'per_transaction';
  fraudCheck?: FraudCheckResponse;
  requiresManualReview?: boolean;
}

const STORAGE_KEY_PREFIX = 'transaction_limits_';
const STORAGE_KEY_USAGE = 'transaction_usage_';

/**
 * Default transaction limits (can be overridden by server)
 */
const DEFAULT_LIMITS: TransactionLimit = {
  daily: 100000, // $100,000 per day
  weekly: 500000, // $500,000 per week
  perTransaction: 50000, // $50,000 per transaction
  currency: 'USD',
};

class TransactionLimitsService {
  private limits: TransactionLimit = DEFAULT_LIMITS;
  private usage: TransactionUsage | null = null;

  /**
   * Initialize the service and load limits/usage
   */
  async initialize(userId: string): Promise<void> {
    await this.loadLimits(userId);
    await this.loadUsage(userId);
    await this.resetIfNeeded(userId);
  }

  /**
   * Load transaction limits from storage or server
   */
  private async loadLimits(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      if (stored) {
        this.limits = JSON.parse(stored);
      } else {
        // In production, fetch from server
        // const serverLimits = await api.getTransactionLimits(userId);
        // this.limits = serverLimits;
        this.limits = DEFAULT_LIMITS;
        await this.saveLimits(userId);
      }
    } catch (error) {
      console.error('Failed to load transaction limits:', error);
      this.limits = DEFAULT_LIMITS;
    }
  }

  /**
   * Save transaction limits to storage
   */
  private async saveLimits(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${userId}`,
        JSON.stringify(this.limits)
      );
    } catch (error) {
      console.error('Failed to save transaction limits:', error);
    }
  }

  /**
   * Load transaction usage from storage
   */
  private async loadUsage(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY_USAGE}${userId}`);
      if (stored) {
        this.usage = JSON.parse(stored);
      } else {
        this.usage = this.createEmptyUsage();
        await this.saveUsage(userId);
      }
    } catch (error) {
      console.error('Failed to load transaction usage:', error);
      this.usage = this.createEmptyUsage();
    }
  }

  /**
   * Save transaction usage to storage
   */
  private async saveUsage(userId: string): Promise<void> {
    try {
      if (this.usage) {
        await AsyncStorage.setItem(
          `${STORAGE_KEY_USAGE}${userId}`,
          JSON.stringify(this.usage)
        );
      }
    } catch (error) {
      console.error('Failed to save transaction usage:', error);
    }
  }

  /**
   * Create empty usage record
   */
  private createEmptyUsage(): TransactionUsage {
    return {
      dailyUsed: 0,
      weeklyUsed: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
      lastWeekResetDate: this.getWeekStart().toISOString().split('T')[0],
      transactions: [],
    };
  }

  /**
   * Get the start of the current week (Monday)
   */
  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(now.setDate(diff));
  }

  /**
   * Reset daily/weekly limits if needed
   */
  private async resetIfNeeded(userId: string): Promise<void> {
    if (!this.usage) return;

    const today = new Date().toISOString().split('T')[0];
    const weekStart = this.getWeekStart().toISOString().split('T')[0];
    let changed = false;

    // Reset daily limit
    if (this.usage.lastResetDate !== today) {
      this.usage.dailyUsed = 0;
      this.usage.lastResetDate = today;
      // Clean up old transactions (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      this.usage.transactions = this.usage.transactions.filter(
        (t) => new Date(t.timestamp) > thirtyDaysAgo
      );
      changed = true;
    }

    // Reset weekly limit
    if (this.usage.lastWeekResetDate !== weekStart) {
      this.usage.weeklyUsed = 0;
      this.usage.lastWeekResetDate = weekStart;
      changed = true;
    }

    if (changed) {
      await this.saveUsage(userId);
    }
  }

  /**
   * Check if a transaction is within limits and fraud detection
   */
  async checkLimit(
    userId: string,
    amount: number,
    currency: string = 'USD',
    toAccount?: string,
    transactionType?: 'transfer' | 'withdrawal' | 'deposit',
    isInternational?: boolean,
    enableFraudCheck: boolean = true
  ): Promise<LimitCheckResult> {
    await this.initialize(userId);

    if (!this.usage) {
      return {
        allowed: false,
        reason: 'Unable to verify transaction limits',
      };
    }

    // Convert to USD if different currency (simplified - use real exchange rates in production)
    const amountUSD = currency === 'USD' ? amount : amount; // TODO: Add currency conversion

    // Check per-transaction limit
    if (amountUSD > this.limits.perTransaction) {
      return {
        allowed: false,
        reason: `Transaction amount exceeds per-transaction limit of ${this.limits.currency} ${this.limits.perTransaction.toLocaleString()}`,
        limitType: 'per_transaction',
      };
    }

    // Check daily limit
    const newDailyUsed = this.usage.dailyUsed + amountUSD;
    if (newDailyUsed > this.limits.daily) {
      return {
        allowed: false,
        reason: `Transaction would exceed daily limit of ${this.limits.currency} ${this.limits.daily.toLocaleString()}`,
        remainingDaily: Math.max(0, this.limits.daily - this.usage.dailyUsed),
        limitType: 'daily',
      };
    }

    // Check weekly limit
    const newWeeklyUsed = this.usage.weeklyUsed + amountUSD;
    if (newWeeklyUsed > this.limits.weekly) {
      return {
        allowed: false,
        reason: `Transaction would exceed weekly limit of ${this.limits.currency} ${this.limits.weekly.toLocaleString()}`,
        remainingWeekly: Math.max(0, this.limits.weekly - this.usage.weeklyUsed),
        limitType: 'weekly',
      };
    }

    // Transaction is within limits - now check for fraud
    let fraudCheck: FraudCheckResponse | undefined;
    let requiresManualReview = false;

    if (enableFraudCheck) {
      try {
        // Prepare fraud check request
        const now = new Date();
        const fraudRequest: FraudCheckRequest = {
          transaction: {
            transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            amount: amountUSD,
            from_account: userId,
            to_account: toAccount || 'unknown',
            type: transactionType || 'transfer',
            timestamp: now.toISOString(),
            is_international: isInternational || false,
            hour_of_day: now.getHours(),
            day_of_week: now.getDay(),
          },
          account: {
            id: userId,
            account_age_days: 30, // TODO: Get from user profile
            balance: 10000, // TODO: Get from account service
            kyc_verified: true, // TODO: Get from KYC service
            kyb_verified: false, // TODO: Get from KYB service
            risk_score: 0.2, // TODO: Get from risk assessment
            total_transactions: this.usage?.transactions.length || 0,
            avg_transaction_amount: this.calculateAvgAmount(),
          },
          history: this.getRecentTransactionsForFraud(),
        };

        // Call fraud detection API
        fraudCheck = await fraudDetectionAPI.checkFraud(fraudRequest);

        // Check fraud detection result
        if (fraudCheck.recommended_action === 'BLOCK_TRANSACTION') {
          return {
            allowed: false,
            reason: `Transaction blocked due to fraud detection: ${fraudCheck.explanation}`,
            fraudCheck,
          };
        }

        if (fraudCheck.recommended_action === 'MANUAL_REVIEW') {
          requiresManualReview = true;
        }

        if (fraudCheck.recommended_action === 'ADDITIONAL_VERIFICATION') {
          // In production, trigger additional verification flow
          // For now, allow but flag for review
          requiresManualReview = true;
        }
      } catch (error) {
        console.error('Fraud detection check failed:', error);
        // In production, decide whether to fail-open or fail-closed
        // For now, log error and continue (fail-open)
      }
    }

    // Transaction is within limits and passed fraud check
    return {
      allowed: true,
      remainingDaily: this.limits.daily - newDailyUsed,
      remainingWeekly: this.limits.weekly - newWeeklyUsed,
      fraudCheck,
      requiresManualReview,
    };
  }

  /**
   * Record a transaction
   */
  async recordTransaction(
    userId: string,
    transaction: Omit<TransactionRecord, 'id'>
  ): Promise<void> {
    await this.initialize(userId);

    if (!this.usage) return;

    const record: TransactionRecord = {
      ...transaction,
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.usage.transactions.push(record);

    // Update usage counters (only for outgoing transactions)
    if (transaction.type === 'send' || transaction.type === 'withdraw') {
      this.usage.dailyUsed += transaction.amount;
      this.usage.weeklyUsed += transaction.amount;
    }

    await this.saveUsage(userId);
  }

  /**
   * Get current usage statistics
   */
  async getUsageStats(userId: string): Promise<{
    dailyUsed: number;
    dailyLimit: number;
    dailyRemaining: number;
    dailyPercentage: number;
    weeklyUsed: number;
    weeklyLimit: number;
    weeklyRemaining: number;
    weeklyPercentage: number;
    perTransactionLimit: number;
  }> {
    await this.initialize(userId);

    if (!this.usage) {
      return {
        dailyUsed: 0,
        dailyLimit: this.limits.daily,
        dailyRemaining: this.limits.daily,
        dailyPercentage: 0,
        weeklyUsed: 0,
        weeklyLimit: this.limits.weekly,
        weeklyRemaining: this.limits.weekly,
        weeklyPercentage: 0,
        perTransactionLimit: this.limits.perTransaction,
      };
    }

    return {
      dailyUsed: this.usage.dailyUsed,
      dailyLimit: this.limits.daily,
      dailyRemaining: Math.max(0, this.limits.daily - this.usage.dailyUsed),
      dailyPercentage: (this.usage.dailyUsed / this.limits.daily) * 100,
      weeklyUsed: this.usage.weeklyUsed,
      weeklyLimit: this.limits.weekly,
      weeklyRemaining: Math.max(0, this.limits.weekly - this.usage.weeklyUsed),
      weeklyPercentage: (this.usage.weeklyUsed / this.limits.weekly) * 100,
      perTransactionLimit: this.limits.perTransaction,
    };
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(userId: string, limit: number = 10): Promise<TransactionRecord[]> {
    await this.initialize(userId);

    if (!this.usage) return [];

    return this.usage.transactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Update transaction limits (admin function)
   */
  async updateLimits(userId: string, newLimits: Partial<TransactionLimit>): Promise<void> {
    this.limits = { ...this.limits, ...newLimits };
    await this.saveLimits(userId);
  }

  /**
   * Calculate average transaction amount
   */
  private calculateAvgAmount(): number {
    if (!this.usage || this.usage.transactions.length === 0) {
      return 0;
    }
    const total = this.usage.transactions.reduce((sum, t) => sum + t.amount, 0);
    return total / this.usage.transactions.length;
  }

  /**
   * Get recent transactions formatted for fraud detection
   */
  private getRecentTransactionsForFraud(): Array<{
    amount: number;
    type: string;
    timestamp: string;
    is_international: boolean;
    hour_of_day: number;
    hours_ago: number;
  }> {
    if (!this.usage) return [];

    const now = new Date();
    return this.usage.transactions.slice(-20).map((t) => {
      const txDate = new Date(t.timestamp);
      const hoursAgo = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60);
      return {
        amount: t.amount,
        type: t.type,
        timestamp: t.timestamp,
        is_international: false, // TODO: Add to TransactionRecord
        hour_of_day: txDate.getHours(),
        hours_ago: hoursAgo,
      };
    });
  }

  /**
   * Check velocity (transactions per hour)
   */
  async checkVelocity(userId: string, maxPerHour: number = 10): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    reason?: string;
  }> {
    await this.initialize(userId);

    if (!this.usage) {
      return { allowed: true, count: 0, limit: maxPerHour };
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentCount = this.usage.transactions.filter(
      (t) => new Date(t.timestamp) > oneHourAgo
    ).length;

    if (recentCount >= maxPerHour) {
      return {
        allowed: false,
        count: recentCount,
        limit: maxPerHour,
        reason: `Too many transactions. Maximum ${maxPerHour} transactions per hour allowed.`,
      };
    }

    return {
      allowed: true,
      count: recentCount,
      limit: maxPerHour,
    };
  }
}

// Export singleton instance
export const transactionLimitsService = new TransactionLimitsService();
