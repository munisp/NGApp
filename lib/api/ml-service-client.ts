/**
 * ML Service Client
 * Client library for integrating 5 ML services with mobile UI
 */

import axios, { AxiosInstance } from 'axios';

// ML Service base URLs (update these for production)
const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_BASE_URL || 'http://127.0.0.1';

const PREDICTIVE_ALERTS_URL = `${ML_SERVICE_BASE_URL}:5003`;
const SMART_CATEGORIZATION_URL = `${ML_SERVICE_BASE_URL}:5004`;
const TAX_OPTIMIZATION_URL = `${ML_SERVICE_BASE_URL}:5005`;
const INVESTMENT_RISK_URL = `${ML_SERVICE_BASE_URL}:5006`;
const CREDIT_SCORE_URL = `${ML_SERVICE_BASE_URL}:5007`;

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MLCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }
}

const mlCache = new MLCache();

// Helper function to create axios instance with timeout
function createMLClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// ==================== Predictive Alerts ML ====================

export interface Transaction {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  description: string;
  timestamp: string;
  type: 'debit' | 'credit';
}

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  transaction: Transaction;
  message: string;
  confidence: number;
  anomaly_score: number;
  actionable: boolean;
  actions: string[];
}

export interface PredictiveAlertsResponse {
  alerts: Alert[];
  summary: {
    total_alerts: number;
    by_severity: Record<string, number>;
    requires_action: number;
  };
}

export async function analyzePredictiveAlerts(
  transactions: Transaction[],
  userId: string,
  userContext?: {
    monthly_budget?: number;
    current_spending?: number;
  }
): Promise<PredictiveAlertsResponse> {
  const cacheKey = `alerts_${userId}_${transactions.length}`;
  const cached = mlCache.get<PredictiveAlertsResponse>(cacheKey);
  if (cached) return cached;

  try {
    const client = createMLClient(PREDICTIVE_ALERTS_URL);
    const response = await client.post<PredictiveAlertsResponse>('/analyze', {
      transactions,
      user_id: userId,
      user_context: userContext,
    });

    mlCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Predictive Alerts ML error:', error);
    // Return empty alerts on error
    return {
      alerts: [],
      summary: {
        total_alerts: 0,
        by_severity: {},
        requires_action: 0,
      },
    };
  }
}

// ==================== Smart Categorization ML ====================

export interface CategoryResult {
  category: string;
  subcategory: string;
  confidence: number;
  method: 'merchant_database' | 'llm' | 'user_history' | 'fallback';
  merchant_match?: string;
}

export async function categorizeTransaction(
  merchant: string,
  description: string,
  amount: number,
  userId: string
): Promise<CategoryResult> {
  const cacheKey = `category_${merchant}_${userId}`;
  const cached = mlCache.get<CategoryResult>(cacheKey);
  if (cached) return cached;

  try {
    const client = createMLClient(SMART_CATEGORIZATION_URL);
    const response = await client.post<CategoryResult>('/categorize', {
      merchant,
      description,
      amount,
      user_id: userId,
    });

    mlCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Smart Categorization ML error:', error);
    // Return fallback category
    return {
      category: 'Other',
      subcategory: 'Uncategorized',
      confidence: 0,
      method: 'fallback',
    };
  }
}

export async function batchCategorizeTransactions(
  transactions: Array<{
    merchant: string;
    description: string;
    amount: number;
  }>,
  userId: string
): Promise<CategoryResult[]> {
  try {
    const client = createMLClient(SMART_CATEGORIZATION_URL);
    const response = await client.post<{ results: CategoryResult[] }>('/batch-categorize', {
      transactions,
      user_id: userId,
    });

    return response.data.results;
  } catch (error) {
    console.error('Batch Categorization ML error:', error);
    // Return fallback categories
    return transactions.map(() => ({
      category: 'Other',
      subcategory: 'Uncategorized',
      confidence: 0,
      method: 'fallback' as const,
    }));
  }
}

export async function learnFromCorrection(
  merchant: string,
  correctCategory: string,
  correctSubcategory: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    const client = createMLClient(SMART_CATEGORIZATION_URL);
    const response = await client.post<{ success: boolean }>('/learn', {
      merchant,
      correct_category: correctCategory,
      correct_subcategory: correctSubcategory,
      user_id: userId,
    });

    // Clear cache for this merchant
    mlCache.clear();

    return response.data;
  } catch (error) {
    console.error('Learn from correction error:', error);
    return { success: false };
  }
}

// ==================== Tax Optimization ML ====================

export interface TaxCalculation {
  annual_income: number;
  personal_allowance: number;
  total_deductions: number;
  taxable_income: number;
  tax_owed: number;
  effective_rate: number;
  currency: string;
}

export interface DetectedDeductions {
  total: number;
  by_category: Record<string, number>;
  transactions: Array<{
    id: string;
    amount: number;
    category: string;
    merchant: string;
    date: string;
  }>;
}

export interface TaxOptimizationResponse {
  tax_calculation: TaxCalculation;
  detected_deductions: DetectedDeductions;
  advice: string;
  disclaimer: string;
}

export async function optimizeTax(
  country: 'nigeria' | 'kenya' | 'ghana' | 'south_africa',
  annualIncome: number,
  transactions: Transaction[]
): Promise<TaxOptimizationResponse> {
  const cacheKey = `tax_${country}_${annualIncome}`;
  const cached = mlCache.get<TaxOptimizationResponse>(cacheKey);
  if (cached) return cached;

  try {
    const client = createMLClient(TAX_OPTIMIZATION_URL);
    const response = await client.post<TaxOptimizationResponse>('/optimize', {
      country,
      annual_income: annualIncome,
      transactions,
    });

    mlCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Tax Optimization ML error:', error);
    throw error;
  }
}

// ==================== Investment Risk ML ====================

export interface PortfolioMetrics {
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  risk_level: number;
  total_value: number;
  weights: Record<string, number>;
}

export interface DiversificationAnalysis {
  score: number;
  status: 'excellent' | 'good' | 'moderate' | 'poor';
  num_assets: number;
  hhi: number;
  max_weight: number;
  is_concentrated: boolean;
  recommendation: string;
}

export interface MonteCarloSimulation {
  initial_value: number;
  years: number;
  simulations: number;
  expected_final_value: number;
  median_final_value: number;
  best_case_p90: number;
  worst_case_p10: number;
  probability_of_loss: number;
  percentiles: Record<string, number>;
}

export interface OptimalAllocation {
  success: boolean;
  risk_tolerance: string;
  optimal_allocation: Record<string, number>;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
}

export interface InvestmentAdviceResponse {
  current_portfolio: {
    metrics: PortfolioMetrics;
    diversification: DiversificationAnalysis;
  };
  advice: string;
  optimal_allocation: OptimalAllocation;
  disclaimer: string;
}

export async function analyzePortfolio(
  holdings: Record<string, number>
): Promise<{
  metrics: PortfolioMetrics;
  diversification: DiversificationAnalysis;
}> {
  const cacheKey = `portfolio_${JSON.stringify(holdings)}`;
  const cached = mlCache.get<{
    metrics: PortfolioMetrics;
    diversification: DiversificationAnalysis;
  }>(cacheKey);
  if (cached) return cached;

  try {
    const client = createMLClient(INVESTMENT_RISK_URL);
    const response = await client.post<{
      metrics: PortfolioMetrics;
      diversification: DiversificationAnalysis;
    }>('/analyze', { holdings });

    mlCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Portfolio Analysis ML error:', error);
    throw error;
  }
}

export async function runMonteCarloSimulation(
  holdings: Record<string, number>,
  years: number = 10,
  simulations: number = 1000
): Promise<MonteCarloSimulation> {
  try {
    const client = createMLClient(INVESTMENT_RISK_URL);
    const response = await client.post<MonteCarloSimulation>('/simulate', {
      holdings,
      years,
      simulations,
    });

    return response.data;
  } catch (error) {
    console.error('Monte Carlo Simulation ML error:', error);
    throw error;
  }
}

export async function optimizePortfolio(
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): Promise<OptimalAllocation> {
  const cacheKey = `optimize_${riskTolerance}`;
  const cached = mlCache.get<OptimalAllocation>(cacheKey);
  if (cached) return cached;

  try {
    const client = createMLClient(INVESTMENT_RISK_URL);
    const response = await client.post<OptimalAllocation>('/optimize', {
      risk_tolerance: riskTolerance,
    });

    mlCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Portfolio Optimization ML error:', error);
    throw error;
  }
}

export async function getInvestmentAdvice(
  holdings: Record<string, number>,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<InvestmentAdviceResponse> {
  try {
    const client = createMLClient(INVESTMENT_RISK_URL);
    const response = await client.post<InvestmentAdviceResponse>('/advise', {
      holdings,
      risk_tolerance: riskTolerance,
    });

    return response.data;
  } catch (error) {
    console.error('Investment Advice ML error:', error);
    throw error;
  }
}

// ==================== Credit Score ML ====================

export interface CreditScoreFactors {
  payment_history: {
    score: number;
    max_score: number;
    percentage: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
  credit_utilization: {
    score: number;
    max_score: number;
    percentage: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
  credit_age: {
    score: number;
    max_score: number;
    months: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
  credit_mix: {
    score: number;
    max_score: number;
    num_accounts: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
  recent_inquiries: {
    score: number;
    max_score: number;
    count: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

export interface CreditScorePrediction {
  credit_score: number;
  rating: {
    grade: string;
    description: string;
  };
  factor_scores: CreditScoreFactors;
  confidence: number;
}

export interface CreditImprovementPlan {
  current_score: number;
  target_score: number;
  improvement_needed: number;
  weak_factors: Array<{
    factor: string;
    status: string;
    score: number;
    max_score: number;
  }>;
  advice: string;
  timeline: {
    estimated_months: number;
    estimated_date: string;
    confidence: 'high' | 'medium' | 'low';
  };
  priority_actions: Array<{
    title: string;
    action: string;
    impact: 'high' | 'medium' | 'low';
    timeframe: string;
  }>;
}

export interface CreditScoreData {
  on_time_payments: number;
  total_payments: number;
  credit_used: number;
  credit_limit: number;
  credit_age_months: number;
  num_accounts: number;
  recent_inquiries: number;
  annual_income?: number;
  monthly_savings?: number;
}

export async function predictCreditScore(
  data: CreditScoreData
): Promise<CreditScorePrediction> {
  const cacheKey = `credit_score_${JSON.stringify(data)}`;
  const cached = mlCache.get<CreditScorePrediction>(cacheKey);
  if (cached) return cached;

  try {
    const client = createMLClient(CREDIT_SCORE_URL);
    const response = await client.post<CreditScorePrediction>('/predict', data);

    mlCache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Credit Score Prediction ML error:', error);
    throw error;
  }
}

export async function getCreditImprovementPlan(
  data: CreditScoreData,
  targetScore?: number
): Promise<{
  current_prediction: CreditScorePrediction;
  improvement_plan: CreditImprovementPlan;
  disclaimer: string;
}> {
  try {
    const client = createMLClient(CREDIT_SCORE_URL);
    const response = await client.post<{
      current_prediction: CreditScorePrediction;
      improvement_plan: CreditImprovementPlan;
      disclaimer: string;
    }>('/improve', {
      ...data,
      target_score: targetScore,
    });

    return response.data;
  } catch (error) {
    console.error('Credit Improvement Plan ML error:', error);
    throw error;
  }
}

// ==================== Health Check ====================

export async function checkMLServicesHealth(): Promise<{
  predictive_alerts: boolean;
  smart_categorization: boolean;
  tax_optimization: boolean;
  investment_risk: boolean;
  credit_score: boolean;
}> {
  const results = {
    predictive_alerts: false,
    smart_categorization: false,
    tax_optimization: false,
    investment_risk: false,
    credit_score: false,
  };

  try {
    const client1 = createMLClient(PREDICTIVE_ALERTS_URL);
    await client1.get('/health');
    results.predictive_alerts = true;
  } catch (e) {
    console.warn('Predictive Alerts ML service unavailable');
  }

  try {
    const client2 = createMLClient(SMART_CATEGORIZATION_URL);
    await client2.get('/health');
    results.smart_categorization = true;
  } catch (e) {
    console.warn('Smart Categorization ML service unavailable');
  }

  try {
    const client3 = createMLClient(TAX_OPTIMIZATION_URL);
    await client3.get('/health');
    results.tax_optimization = true;
  } catch (e) {
    console.warn('Tax Optimization ML service unavailable');
  }

  try {
    const client4 = createMLClient(INVESTMENT_RISK_URL);
    await client4.get('/health');
    results.investment_risk = true;
  } catch (e) {
    console.warn('Investment Risk ML service unavailable');
  }

  try {
    const client5 = createMLClient(CREDIT_SCORE_URL);
    await client5.get('/health');
    results.credit_score = true;
  } catch (e) {
    console.warn('Credit Score ML service unavailable');
  }

  return results;
}

// Export cache for manual clearing if needed
export { mlCache };
