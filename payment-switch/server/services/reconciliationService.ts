/**
 * Ledger Reconciliation Service
 * 
 * Provides automated reconciliation between operational database
 * and TigerBeetle ledger with:
 * - Daily reconciliation jobs
 * - Real-time drift detection
 * - Exception queue management
 * - Audit trail generation
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface ReconciliationConfig {
  batchSize: number;
  toleranceAmount: number;
  tolerancePercentage: number;
  maxRetries: number;
  alertThreshold: number;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  accountId: string;
  reference: string;
  timestamp: Date;
  status: string;
  metadata?: Record<string, any>;
}

export interface LedgerEntry {
  id: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  pendingAmount: number;
  timestamp: number;
  code: number;
  flags: number;
  userData: string;
}

export interface ReconciliationResult {
  id: string;
  startTime: Date;
  endTime: Date;
  status: 'success' | 'failed' | 'partial';
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  discrepancies: Discrepancy[];
  summary: ReconciliationSummary;
}

export interface Discrepancy {
  id: string;
  type: 'missing_in_ledger' | 'missing_in_db' | 'amount_mismatch' | 'status_mismatch';
  transactionId: string;
  dbAmount?: number;
  ledgerAmount?: number;
  difference?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'escalated';
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  assignedTo?: string;
}

export interface ReconciliationSummary {
  totalDbAmount: number;
  totalLedgerAmount: number;
  netDifference: number;
  matchRate: number;
  discrepancyCount: number;
  criticalDiscrepancies: number;
}

export interface AccountBalance {
  accountId: string;
  dbBalance: number;
  ledgerBalance: number;
  difference: number;
  lastReconciled: Date;
}

/**
 * Exception Queue for managing discrepancies
 */
export class ExceptionQueue extends EventEmitter {
  private queue: Discrepancy[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    super();
    this.maxSize = maxSize;
  }

  add(discrepancy: Discrepancy): void {
    if (this.queue.length >= this.maxSize) {
      // Remove oldest resolved items first
      const resolvedIndex = this.queue.findIndex(d => d.status === 'resolved');
      if (resolvedIndex >= 0) {
        this.queue.splice(resolvedIndex, 1);
      } else {
        this.queue.shift();
      }
    }

    this.queue.push(discrepancy);
    this.emit('discrepancy', discrepancy);

    if (discrepancy.severity === 'critical') {
      this.emit('critical', discrepancy);
    }
  }

  getPending(): Discrepancy[] {
    return this.queue.filter(d => d.status === 'pending');
  }

  getByStatus(status: Discrepancy['status']): Discrepancy[] {
    return this.queue.filter(d => d.status === status);
  }

  getBySeverity(severity: Discrepancy['severity']): Discrepancy[] {
    return this.queue.filter(d => d.severity === severity);
  }

  resolve(id: string, resolution: string): boolean {
    const discrepancy = this.queue.find(d => d.id === id);
    if (discrepancy) {
      discrepancy.status = 'resolved';
      discrepancy.resolvedAt = new Date();
      discrepancy.resolution = resolution;
      this.emit('resolved', discrepancy);
      return true;
    }
    return false;
  }

  escalate(id: string, assignedTo: string): boolean {
    const discrepancy = this.queue.find(d => d.id === id);
    if (discrepancy) {
      discrepancy.status = 'escalated';
      discrepancy.assignedTo = assignedTo;
      this.emit('escalated', discrepancy);
      return true;
    }
    return false;
  }

  getStats(): {
    total: number;
    pending: number;
    investigating: number;
    resolved: number;
    escalated: number;
    bySeverity: Record<string, number>;
  } {
    const stats = {
      total: this.queue.length,
      pending: 0,
      investigating: 0,
      resolved: 0,
      escalated: 0,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
    };

    for (const d of this.queue) {
      stats[d.status]++;
      stats.bySeverity[d.severity]++;
    }

    return stats;
  }
}

/**
 * Reconciliation Service
 */
export class ReconciliationService extends EventEmitter {
  private config: ReconciliationConfig;
  private exceptionQueue: ExceptionQueue;
  private reconciliationHistory: ReconciliationResult[] = [];
  private isRunning: boolean = false;
  private scheduledJob: NodeJS.Timeout | null = null;

  constructor(config: Partial<ReconciliationConfig> = {}) {
    super();
    this.config = {
      batchSize: config.batchSize || 1000,
      toleranceAmount: config.toleranceAmount || 0.01, // 1 cent
      tolerancePercentage: config.tolerancePercentage || 0.001, // 0.1%
      maxRetries: config.maxRetries || 3,
      alertThreshold: config.alertThreshold || 10
    };
    this.exceptionQueue = new ExceptionQueue();

    // Forward exception queue events
    this.exceptionQueue.on('critical', (d) => this.emit('criticalDiscrepancy', d));
    this.exceptionQueue.on('escalated', (d) => this.emit('discrepancyEscalated', d));
  }

  /**
   * Run full reconciliation between DB and ledger
   */
  async runReconciliation(
    startDate: Date,
    endDate: Date,
    getDbTransactions: (start: Date, end: Date, offset: number, limit: number) => Promise<Transaction[]>,
    getLedgerEntries: (start: Date, end: Date) => Promise<LedgerEntry[]>
  ): Promise<ReconciliationResult> {
    if (this.isRunning) {
      throw new Error('Reconciliation already in progress');
    }

    this.isRunning = true;
    const reconciliationId = crypto.randomUUID();
    const startTime = new Date();

    this.emit('reconciliationStarted', { id: reconciliationId, startDate, endDate });

    try {
      // Fetch all ledger entries for the period
      const ledgerEntries = await getLedgerEntries(startDate, endDate);
      const ledgerMap = new Map<string, LedgerEntry>();
      for (const entry of ledgerEntries) {
        ledgerMap.set(entry.userData, entry);
      }

      let offset = 0;
      let totalTransactions = 0;
      let matchedTransactions = 0;
      const discrepancies: Discrepancy[] = [];
      let totalDbAmount = 0;
      let totalLedgerAmount = 0;

      // Process DB transactions in batches
      while (true) {
        const dbTransactions = await getDbTransactions(
          startDate,
          endDate,
          offset,
          this.config.batchSize
        );

        if (dbTransactions.length === 0) break;

        for (const tx of dbTransactions) {
          totalTransactions++;
          totalDbAmount += tx.amount;

          const ledgerEntry = ledgerMap.get(tx.id);

          if (!ledgerEntry) {
            // Missing in ledger
            const discrepancy = this.createDiscrepancy(
              'missing_in_ledger',
              tx.id,
              tx.amount,
              undefined
            );
            discrepancies.push(discrepancy);
            this.exceptionQueue.add(discrepancy);
          } else {
            totalLedgerAmount += ledgerEntry.amount;
            ledgerMap.delete(tx.id); // Mark as processed

            // Check for amount mismatch
            const difference = Math.abs(tx.amount - ledgerEntry.amount);
            const toleranceCheck = Math.max(
              this.config.toleranceAmount,
              tx.amount * this.config.tolerancePercentage
            );

            if (difference > toleranceCheck) {
              const discrepancy = this.createDiscrepancy(
                'amount_mismatch',
                tx.id,
                tx.amount,
                ledgerEntry.amount
              );
              discrepancies.push(discrepancy);
              this.exceptionQueue.add(discrepancy);
            } else {
              matchedTransactions++;
            }
          }
        }

        offset += this.config.batchSize;
        this.emit('reconciliationProgress', {
          id: reconciliationId,
          processed: totalTransactions,
          matched: matchedTransactions,
          discrepancies: discrepancies.length
        });
      }

      // Check for entries in ledger but not in DB
      for (const [txId, entry] of ledgerMap) {
        totalLedgerAmount += entry.amount;
        const discrepancy = this.createDiscrepancy(
          'missing_in_db',
          txId,
          undefined,
          entry.amount
        );
        discrepancies.push(discrepancy);
        this.exceptionQueue.add(discrepancy);
      }

      const endTime = new Date();
      const unmatchedTransactions = totalTransactions - matchedTransactions;
      const netDifference = totalDbAmount - totalLedgerAmount;
      const matchRate = totalTransactions > 0 
        ? (matchedTransactions / totalTransactions) * 100 
        : 100;

      const result: ReconciliationResult = {
        id: reconciliationId,
        startTime,
        endTime,
        status: discrepancies.length === 0 ? 'success' : 
                matchRate >= 99 ? 'partial' : 'failed',
        totalTransactions,
        matchedTransactions,
        unmatchedTransactions,
        discrepancies,
        summary: {
          totalDbAmount,
          totalLedgerAmount,
          netDifference,
          matchRate,
          discrepancyCount: discrepancies.length,
          criticalDiscrepancies: discrepancies.filter(d => d.severity === 'critical').length
        }
      };

      this.reconciliationHistory.push(result);
      
      // Keep only last 100 results
      if (this.reconciliationHistory.length > 100) {
        this.reconciliationHistory.shift();
      }

      this.emit('reconciliationCompleted', result);

      // Alert if threshold exceeded
      if (discrepancies.length >= this.config.alertThreshold) {
        this.emit('reconciliationAlert', {
          type: 'threshold_exceeded',
          discrepancyCount: discrepancies.length,
          threshold: this.config.alertThreshold,
          result
        });
      }

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run account balance reconciliation
   */
  async reconcileAccountBalances(
    getDbBalances: () => Promise<Map<string, number>>,
    getLedgerBalances: () => Promise<Map<string, number>>
  ): Promise<AccountBalance[]> {
    const dbBalances = await getDbBalances();
    const ledgerBalances = await getLedgerBalances();
    const results: AccountBalance[] = [];

    // Check all DB accounts
    for (const [accountId, dbBalance] of dbBalances) {
      const ledgerBalance = ledgerBalances.get(accountId) || 0;
      const difference = dbBalance - ledgerBalance;

      results.push({
        accountId,
        dbBalance,
        ledgerBalance,
        difference,
        lastReconciled: new Date()
      });

      if (Math.abs(difference) > this.config.toleranceAmount) {
        const discrepancy = this.createDiscrepancy(
          'amount_mismatch',
          `balance:${accountId}`,
          dbBalance,
          ledgerBalance
        );
        this.exceptionQueue.add(discrepancy);
      }

      ledgerBalances.delete(accountId);
    }

    // Check for accounts only in ledger
    for (const [accountId, ledgerBalance] of ledgerBalances) {
      results.push({
        accountId,
        dbBalance: 0,
        ledgerBalance,
        difference: -ledgerBalance,
        lastReconciled: new Date()
      });

      const discrepancy = this.createDiscrepancy(
        'missing_in_db',
        `balance:${accountId}`,
        undefined,
        ledgerBalance
      );
      this.exceptionQueue.add(discrepancy);
    }

    return results;
  }

  /**
   * Schedule daily reconciliation
   */
  scheduleDailyReconciliation(
    hour: number,
    minute: number,
    getDbTransactions: (start: Date, end: Date, offset: number, limit: number) => Promise<Transaction[]>,
    getLedgerEntries: (start: Date, end: Date) => Promise<LedgerEntry[]>
  ): void {
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delay = next.getTime() - now.getTime();

      this.scheduledJob = setTimeout(async () => {
        // Run reconciliation for previous day
        const endDate = new Date();
        endDate.setHours(0, 0, 0, 0);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);

        try {
          await this.runReconciliation(
            startDate,
            endDate,
            getDbTransactions,
            getLedgerEntries
          );
        } catch (error) {
          this.emit('reconciliationError', error);
        }

        scheduleNext();
      }, delay);
    };

    scheduleNext();
    this.emit('reconciliationScheduled', { hour, minute });
  }

  /**
   * Cancel scheduled reconciliation
   */
  cancelScheduledReconciliation(): void {
    if (this.scheduledJob) {
      clearTimeout(this.scheduledJob);
      this.scheduledJob = null;
    }
  }

  /**
   * Create a discrepancy record
   */
  private createDiscrepancy(
    type: Discrepancy['type'],
    transactionId: string,
    dbAmount?: number,
    ledgerAmount?: number
  ): Discrepancy {
    const difference = dbAmount !== undefined && ledgerAmount !== undefined
      ? Math.abs(dbAmount - ledgerAmount)
      : dbAmount || ledgerAmount || 0;

    let severity: Discrepancy['severity'] = 'low';
    if (difference > 10000) severity = 'critical';
    else if (difference > 1000) severity = 'high';
    else if (difference > 100) severity = 'medium';

    return {
      id: crypto.randomUUID(),
      type,
      transactionId,
      dbAmount,
      ledgerAmount,
      difference,
      severity,
      status: 'pending',
      createdAt: new Date()
    };
  }

  /**
   * Get exception queue
   */
  getExceptionQueue(): ExceptionQueue {
    return this.exceptionQueue;
  }

  /**
   * Get reconciliation history
   */
  getHistory(): ReconciliationResult[] {
    return [...this.reconciliationHistory];
  }

  /**
   * Get latest reconciliation result
   */
  getLatestResult(): ReconciliationResult | null {
    return this.reconciliationHistory[this.reconciliationHistory.length - 1] || null;
  }

  /**
   * Check if reconciliation is running
   */
  isReconciliationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Generate audit report
   */
  generateAuditReport(result: ReconciliationResult): string {
    const lines: string[] = [
      '='.repeat(60),
      'RECONCILIATION AUDIT REPORT',
      '='.repeat(60),
      '',
      `Report ID: ${result.id}`,
      `Generated: ${new Date().toISOString()}`,
      `Period: ${result.startTime.toISOString()} - ${result.endTime.toISOString()}`,
      '',
      '-'.repeat(60),
      'SUMMARY',
      '-'.repeat(60),
      `Status: ${result.status.toUpperCase()}`,
      `Total Transactions: ${result.totalTransactions}`,
      `Matched: ${result.matchedTransactions}`,
      `Unmatched: ${result.unmatchedTransactions}`,
      `Match Rate: ${result.summary.matchRate.toFixed(2)}%`,
      '',
      `Total DB Amount: ${result.summary.totalDbAmount.toFixed(2)}`,
      `Total Ledger Amount: ${result.summary.totalLedgerAmount.toFixed(2)}`,
      `Net Difference: ${result.summary.netDifference.toFixed(2)}`,
      '',
      '-'.repeat(60),
      'DISCREPANCIES',
      '-'.repeat(60),
      `Total: ${result.summary.discrepancyCount}`,
      `Critical: ${result.summary.criticalDiscrepancies}`,
      ''
    ];

    if (result.discrepancies.length > 0) {
      lines.push('Details:');
      for (const d of result.discrepancies.slice(0, 50)) {
        lines.push(`  - [${d.severity.toUpperCase()}] ${d.type}: ${d.transactionId}`);
        if (d.dbAmount !== undefined) lines.push(`    DB Amount: ${d.dbAmount}`);
        if (d.ledgerAmount !== undefined) lines.push(`    Ledger Amount: ${d.ledgerAmount}`);
        if (d.difference !== undefined) lines.push(`    Difference: ${d.difference}`);
      }
      if (result.discrepancies.length > 50) {
        lines.push(`  ... and ${result.discrepancies.length - 50} more`);
      }
    }

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('END OF REPORT');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

// Singleton instance
let reconciliationServiceInstance: ReconciliationService | null = null;

export function getReconciliationService(): ReconciliationService {
  if (!reconciliationServiceInstance) {
    reconciliationServiceInstance = new ReconciliationService();
  }
  return reconciliationServiceInstance;
}

export default ReconciliationService;
