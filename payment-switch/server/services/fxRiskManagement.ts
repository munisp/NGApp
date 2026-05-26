/**
 * FX Risk Management Service
 * 
 * Provides comprehensive FX risk management for:
 * - Rate locking functionality
 * - Hedging hooks for large transactions
 * - Rate volatility alerts
 * - Exposure tracking
 * - Settlement risk management
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface RateLock {
  id: string;
  customerId: string;
  sourceCurrency: string;
  targetCurrency: string;
  lockedRate: number;
  amount: number;
  expiresAt: Date;
  status: RateLockStatus;
  usedAt?: Date;
  transactionId?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export type RateLockStatus = 'active' | 'used' | 'expired' | 'cancelled';

export interface FXExposure {
  currency: string;
  longPosition: number;
  shortPosition: number;
  netPosition: number;
  unrealizedPnL: number;
  lastUpdated: Date;
}

export interface HedgePosition {
  id: string;
  currency: string;
  type: 'forward' | 'option' | 'swap';
  notionalAmount: number;
  strikeRate?: number;
  maturityDate: Date;
  counterparty: string;
  status: 'open' | 'settled' | 'cancelled';
  createdAt: Date;
  settledAt?: Date;
  settlementAmount?: number;
}

export interface VolatilityAlert {
  id: string;
  currencyPair: string;
  threshold: number;
  direction: 'up' | 'down' | 'both';
  currentVolatility: number;
  triggered: boolean;
  triggeredAt?: Date;
  notificationSent: boolean;
  createdAt: Date;
}

export interface RateHistory {
  currencyPair: string;
  rate: number;
  timestamp: Date;
  source: string;
}

export interface FXRiskMetrics {
  totalExposure: number;
  hedgedExposure: number;
  unhedgedExposure: number;
  hedgeRatio: number;
  valueAtRisk: number;
  expectedShortfall: number;
  volatility: number;
}

/**
 * FX Risk Management Service
 */
export class FXRiskManagementService extends EventEmitter {
  private rateLocks: Map<string, RateLock> = new Map();
  private exposures: Map<string, FXExposure> = new Map();
  private hedgePositions: Map<string, HedgePosition> = new Map();
  private volatilityAlerts: Map<string, VolatilityAlert> = new Map();
  private rateHistory: RateHistory[] = [];
  private currentRates: Map<string, number> = new Map();
  
  private config: FXRiskConfig;

  constructor(config?: Partial<FXRiskConfig>) {
    super();
    this.config = {
      defaultLockDurationMinutes: config?.defaultLockDurationMinutes || 15,
      maxLockDurationMinutes: config?.maxLockDurationMinutes || 60,
      hedgeThresholdAmount: config?.hedgeThresholdAmount || 10000000, // 10M NGN
      volatilityAlertThreshold: config?.volatilityAlertThreshold || 0.02, // 2%
      maxUnhedgedExposure: config?.maxUnhedgedExposure || 50000000, // 50M NGN
      rateMarkup: config?.rateMarkup || 0.005 // 0.5%
    };

    // Initialize with some default rates
    this.initializeRates();
    
    // Start rate lock expiration checker
    this.startExpirationChecker();
  }

  /**
   * Initialize default exchange rates
   */
  private initializeRates(): void {
    // Default rates (would be fetched from external API in production)
    this.currentRates.set('BTC/NGN', 150000000);
    this.currentRates.set('ETH/NGN', 8000000);
    this.currentRates.set('USDC/NGN', 1650);
    this.currentRates.set('USDT/NGN', 1650);
    this.currentRates.set('USD/NGN', 1650);
    this.currentRates.set('EUR/NGN', 1800);
    this.currentRates.set('GBP/NGN', 2100);
  }

  /**
   * Get current exchange rate
   */
  getCurrentRate(sourceCurrency: string, targetCurrency: string): number | null {
    const pair = `${sourceCurrency}/${targetCurrency}`;
    const rate = this.currentRates.get(pair);
    
    if (rate) return rate;

    // Try inverse
    const inversePair = `${targetCurrency}/${sourceCurrency}`;
    const inverseRate = this.currentRates.get(inversePair);
    if (inverseRate) return 1 / inverseRate;

    return null;
  }

  /**
   * Update exchange rate
   */
  updateRate(sourceCurrency: string, targetCurrency: string, rate: number, source: string = 'internal'): void {
    const pair = `${sourceCurrency}/${targetCurrency}`;
    const oldRate = this.currentRates.get(pair);
    
    this.currentRates.set(pair, rate);
    
    // Record history
    this.rateHistory.push({
      currencyPair: pair,
      rate,
      timestamp: new Date(),
      source
    });

    // Keep only last 1000 entries per pair
    const pairHistory = this.rateHistory.filter(h => h.currencyPair === pair);
    if (pairHistory.length > 1000) {
      const toRemove = pairHistory.slice(0, pairHistory.length - 1000);
      this.rateHistory = this.rateHistory.filter(h => !toRemove.includes(h));
    }

    // Check volatility alerts
    if (oldRate) {
      const change = Math.abs((rate - oldRate) / oldRate);
      this.checkVolatilityAlerts(pair, change);
    }

    this.emit('rateUpdated', { pair, rate, oldRate, source });
  }

  /**
   * Create a rate lock
   */
  createRateLock(params: {
    customerId: string;
    sourceCurrency: string;
    targetCurrency: string;
    amount: number;
    durationMinutes?: number;
    metadata?: Record<string, any>;
  }): RateLock {
    const duration = Math.min(
      params.durationMinutes || this.config.defaultLockDurationMinutes,
      this.config.maxLockDurationMinutes
    );

    const currentRate = this.getCurrentRate(params.sourceCurrency, params.targetCurrency);
    if (!currentRate) {
      throw new Error(`No rate available for ${params.sourceCurrency}/${params.targetCurrency}`);
    }

    // Apply markup for rate lock
    const lockedRate = currentRate * (1 + this.config.rateMarkup);

    const rateLock: RateLock = {
      id: `RL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      customerId: params.customerId,
      sourceCurrency: params.sourceCurrency,
      targetCurrency: params.targetCurrency,
      lockedRate,
      amount: params.amount,
      expiresAt: new Date(Date.now() + duration * 60 * 1000),
      status: 'active',
      createdAt: new Date(),
      metadata: params.metadata
    };

    this.rateLocks.set(rateLock.id, rateLock);
    this.emit('rateLockCreated', rateLock);

    return rateLock;
  }

  /**
   * Use a rate lock
   */
  useRateLock(rateLockId: string, transactionId: string): RateLock | null {
    const rateLock = this.rateLocks.get(rateLockId);
    if (!rateLock) return null;

    if (rateLock.status !== 'active') {
      throw new Error(`Rate lock ${rateLockId} is not active (status: ${rateLock.status})`);
    }

    if (new Date() > rateLock.expiresAt) {
      rateLock.status = 'expired';
      throw new Error(`Rate lock ${rateLockId} has expired`);
    }

    rateLock.status = 'used';
    rateLock.usedAt = new Date();
    rateLock.transactionId = transactionId;

    this.emit('rateLockUsed', rateLock);
    return rateLock;
  }

  /**
   * Cancel a rate lock
   */
  cancelRateLock(rateLockId: string): RateLock | null {
    const rateLock = this.rateLocks.get(rateLockId);
    if (!rateLock) return null;

    if (rateLock.status !== 'active') {
      throw new Error(`Rate lock ${rateLockId} cannot be cancelled (status: ${rateLock.status})`);
    }

    rateLock.status = 'cancelled';
    this.emit('rateLockCancelled', rateLock);
    return rateLock;
  }

  /**
   * Get rate lock by ID
   */
  getRateLock(rateLockId: string): RateLock | null {
    return this.rateLocks.get(rateLockId) || null;
  }

  /**
   * Get active rate locks for customer
   */
  getCustomerRateLocks(customerId: string): RateLock[] {
    return Array.from(this.rateLocks.values())
      .filter(rl => rl.customerId === customerId && rl.status === 'active');
  }

  /**
   * Update FX exposure
   */
  updateExposure(currency: string, amount: number, type: 'long' | 'short'): FXExposure {
    let exposure = this.exposures.get(currency);
    
    if (!exposure) {
      exposure = {
        currency,
        longPosition: 0,
        shortPosition: 0,
        netPosition: 0,
        unrealizedPnL: 0,
        lastUpdated: new Date()
      };
    }

    if (type === 'long') {
      exposure.longPosition += amount;
    } else {
      exposure.shortPosition += amount;
    }

    exposure.netPosition = exposure.longPosition - exposure.shortPosition;
    exposure.lastUpdated = new Date();

    // Calculate unrealized P&L (simplified)
    const rate = this.getCurrentRate(currency, 'NGN') || 1;
    exposure.unrealizedPnL = exposure.netPosition * rate;

    this.exposures.set(currency, exposure);

    // Check if hedging is needed
    if (Math.abs(exposure.netPosition * rate) > this.config.hedgeThresholdAmount) {
      this.emit('hedgingRequired', exposure);
    }

    // Check max unhedged exposure
    const totalUnhedged = this.calculateUnhedgedExposure();
    if (totalUnhedged > this.config.maxUnhedgedExposure) {
      this.emit('exposureLimitBreached', { totalUnhedged, limit: this.config.maxUnhedgedExposure });
    }

    return exposure;
  }

  /**
   * Get all exposures
   */
  getExposures(): FXExposure[] {
    return Array.from(this.exposures.values());
  }

  /**
   * Create a hedge position
   */
  createHedgePosition(params: {
    currency: string;
    type: 'forward' | 'option' | 'swap';
    notionalAmount: number;
    strikeRate?: number;
    maturityDate: Date;
    counterparty: string;
  }): HedgePosition {
    const hedge: HedgePosition = {
      id: `HDG-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      currency: params.currency,
      type: params.type,
      notionalAmount: params.notionalAmount,
      strikeRate: params.strikeRate,
      maturityDate: params.maturityDate,
      counterparty: params.counterparty,
      status: 'open',
      createdAt: new Date()
    };

    this.hedgePositions.set(hedge.id, hedge);
    this.emit('hedgeCreated', hedge);

    return hedge;
  }

  /**
   * Settle a hedge position
   */
  settleHedgePosition(hedgeId: string, settlementAmount: number): HedgePosition | null {
    const hedge = this.hedgePositions.get(hedgeId);
    if (!hedge) return null;

    hedge.status = 'settled';
    hedge.settledAt = new Date();
    hedge.settlementAmount = settlementAmount;

    this.emit('hedgeSettled', hedge);
    return hedge;
  }

  /**
   * Get open hedge positions
   */
  getOpenHedges(): HedgePosition[] {
    return Array.from(this.hedgePositions.values())
      .filter(h => h.status === 'open');
  }

  /**
   * Create volatility alert
   */
  createVolatilityAlert(params: {
    currencyPair: string;
    threshold: number;
    direction: 'up' | 'down' | 'both';
  }): VolatilityAlert {
    const alert: VolatilityAlert = {
      id: crypto.randomUUID(),
      currencyPair: params.currencyPair,
      threshold: params.threshold,
      direction: params.direction,
      currentVolatility: 0,
      triggered: false,
      notificationSent: false,
      createdAt: new Date()
    };

    this.volatilityAlerts.set(alert.id, alert);
    return alert;
  }

  /**
   * Check volatility alerts
   */
  private checkVolatilityAlerts(currencyPair: string, change: number): void {
    for (const alert of this.volatilityAlerts.values()) {
      if (alert.currencyPair !== currencyPair) continue;
      if (alert.triggered) continue;

      alert.currentVolatility = change;

      const shouldTrigger = 
        (alert.direction === 'both' && change >= alert.threshold) ||
        (alert.direction === 'up' && change >= alert.threshold) ||
        (alert.direction === 'down' && change >= alert.threshold);

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        this.emit('volatilityAlertTriggered', alert);
      }
    }
  }

  /**
   * Calculate risk metrics
   */
  calculateRiskMetrics(): FXRiskMetrics {
    let totalExposure = 0;
    let hedgedExposure = 0;

    // Calculate total exposure
    for (const exposure of this.exposures.values()) {
      const rate = this.getCurrentRate(exposure.currency, 'NGN') || 1;
      totalExposure += Math.abs(exposure.netPosition * rate);
    }

    // Calculate hedged exposure
    for (const hedge of this.hedgePositions.values()) {
      if (hedge.status === 'open') {
        const rate = this.getCurrentRate(hedge.currency, 'NGN') || 1;
        hedgedExposure += hedge.notionalAmount * rate;
      }
    }

    const unhedgedExposure = Math.max(0, totalExposure - hedgedExposure);
    const hedgeRatio = totalExposure > 0 ? hedgedExposure / totalExposure : 0;

    // Calculate volatility (simplified - would use proper statistical methods in production)
    const volatility = this.calculateHistoricalVolatility();

    // Calculate VaR (simplified 95% confidence)
    const valueAtRisk = unhedgedExposure * volatility * 1.65;

    // Calculate Expected Shortfall (simplified)
    const expectedShortfall = valueAtRisk * 1.25;

    return {
      totalExposure,
      hedgedExposure,
      unhedgedExposure,
      hedgeRatio,
      valueAtRisk,
      expectedShortfall,
      volatility
    };
  }

  /**
   * Calculate historical volatility
   */
  private calculateHistoricalVolatility(): number {
    if (this.rateHistory.length < 2) return 0;

    // Get last 30 days of rate changes
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentHistory = this.rateHistory.filter(h => h.timestamp > thirtyDaysAgo);

    if (recentHistory.length < 2) return 0;

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < recentHistory.length; i++) {
      const prevRate = recentHistory[i - 1].rate;
      const currRate = recentHistory[i].rate;
      if (prevRate > 0) {
        returns.push((currRate - prevRate) / prevRate);
      }
    }

    if (returns.length === 0) return 0;

    // Calculate standard deviation
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate unhedged exposure
   */
  private calculateUnhedgedExposure(): number {
    const metrics = this.calculateRiskMetrics();
    return metrics.unhedgedExposure;
  }

  /**
   * Start rate lock expiration checker
   */
  private startExpirationChecker(): void {
    setInterval(() => {
      const now = new Date();
      for (const rateLock of this.rateLocks.values()) {
        if (rateLock.status === 'active' && rateLock.expiresAt < now) {
          rateLock.status = 'expired';
          this.emit('rateLockExpired', rateLock);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get rate history
   */
  getRateHistory(currencyPair: string, limit: number = 100): RateHistory[] {
    return this.rateHistory
      .filter(h => h.currencyPair === currencyPair)
      .slice(-limit);
  }

  /**
   * Generate FX risk report
   */
  generateRiskReport(): string {
    const metrics = this.calculateRiskMetrics();
    const exposures = this.getExposures();
    const openHedges = this.getOpenHedges();
    const activeRateLocks = Array.from(this.rateLocks.values())
      .filter(rl => rl.status === 'active');

    const lines: string[] = [
      '='.repeat(60),
      'FX RISK MANAGEMENT REPORT',
      '='.repeat(60),
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '-'.repeat(60),
      'RISK METRICS',
      '-'.repeat(60),
      `Total Exposure: ${metrics.totalExposure.toLocaleString()} NGN`,
      `Hedged Exposure: ${metrics.hedgedExposure.toLocaleString()} NGN`,
      `Unhedged Exposure: ${metrics.unhedgedExposure.toLocaleString()} NGN`,
      `Hedge Ratio: ${(metrics.hedgeRatio * 100).toFixed(1)}%`,
      `Value at Risk (95%): ${metrics.valueAtRisk.toLocaleString()} NGN`,
      `Expected Shortfall: ${metrics.expectedShortfall.toLocaleString()} NGN`,
      `Historical Volatility: ${(metrics.volatility * 100).toFixed(2)}%`,
      ''
    ];

    if (exposures.length > 0) {
      lines.push('-'.repeat(60));
      lines.push('CURRENCY EXPOSURES');
      lines.push('-'.repeat(60));
      for (const exp of exposures) {
        lines.push(`${exp.currency}:`);
        lines.push(`  Long: ${exp.longPosition.toLocaleString()}`);
        lines.push(`  Short: ${exp.shortPosition.toLocaleString()}`);
        lines.push(`  Net: ${exp.netPosition.toLocaleString()}`);
        lines.push(`  Unrealized P&L: ${exp.unrealizedPnL.toLocaleString()} NGN`);
      }
      lines.push('');
    }

    if (openHedges.length > 0) {
      lines.push('-'.repeat(60));
      lines.push('OPEN HEDGE POSITIONS');
      lines.push('-'.repeat(60));
      for (const hedge of openHedges) {
        lines.push(`${hedge.id}: ${hedge.type} ${hedge.currency}`);
        lines.push(`  Notional: ${hedge.notionalAmount.toLocaleString()}`);
        lines.push(`  Maturity: ${hedge.maturityDate.toISOString()}`);
        lines.push(`  Counterparty: ${hedge.counterparty}`);
      }
      lines.push('');
    }

    if (activeRateLocks.length > 0) {
      lines.push('-'.repeat(60));
      lines.push('ACTIVE RATE LOCKS');
      lines.push('-'.repeat(60));
      for (const lock of activeRateLocks) {
        lines.push(`${lock.id}: ${lock.sourceCurrency}/${lock.targetCurrency}`);
        lines.push(`  Amount: ${lock.amount.toLocaleString()}`);
        lines.push(`  Locked Rate: ${lock.lockedRate}`);
        lines.push(`  Expires: ${lock.expiresAt.toISOString()}`);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));
    lines.push('END OF REPORT');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

interface FXRiskConfig {
  defaultLockDurationMinutes: number;
  maxLockDurationMinutes: number;
  hedgeThresholdAmount: number;
  volatilityAlertThreshold: number;
  maxUnhedgedExposure: number;
  rateMarkup: number;
}

// Singleton instance
let fxRiskServiceInstance: FXRiskManagementService | null = null;

export function getFXRiskManagementService(): FXRiskManagementService {
  if (!fxRiskServiceInstance) {
    fxRiskServiceInstance = new FXRiskManagementService();
  }
  return fxRiskServiceInstance;
}

export default FXRiskManagementService;
