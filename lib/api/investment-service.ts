const INVESTMENTS_URL = process.env.EXPO_PUBLIC_INVESTMENTS_URL || 'http://127.0.0.1:8116';

export interface InvestmentProduct {
  id: string;
  name: string;
  type: 'fixed_deposit' | 'money_market' | 'mutual_fund' | 'treasury_bills' | 'bonds' | 'stocks' | 'reit';
  description: string;
  min_amount: number;
  currency: string;
  expected_return: number;
  risk_level: string;
  lock_period_days: number;
  active: boolean;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  total_value: number;
  total_gain: number;
  holdings: Holding[];
  risk_profile: string;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: string;
  product_id: string;
  product_name: string;
  type: InvestmentProduct['type'];
  units: number;
  buy_price: number;
  current_price: number;
  total_value: number;
  gain: number;
  gain_percent: number;
  bought_at: string;
}

export interface FixedDeposit {
  id: string;
  user_id: string;
  principal: number;
  rate: number;
  tenor_days: number;
  maturity_date: string;
  expected_yield: number;
  currency: string;
  status: string;
  auto_rollover: boolean;
  created_at: string;
}

export interface RoboAdvisorProfile {
  user_id: string;
  risk_tolerance: string;
  investment_goal: string;
  time_horizon_years: number;
  monthly_budget: number;
  recommendation: Array<{ asset_class: string; allocation: number; product: string; risk: string }>;
  expected_return: number;
  projected_value: number;
}

class InvestmentService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${INVESTMENTS_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async getProducts(type?: string): Promise<{ products: InvestmentProduct[]; total: number }> {
    const url = type ? `/products?type=${type}` : '/products';
    return this.request(url);
  }

  async buy(params: { user_id: string; product_id: string; amount: number }): Promise<Record<string, unknown>> {
    return this.request('/buy', { method: 'POST', body: JSON.stringify(params) });
  }

  async sell(params: { user_id: string; holding_id: string; units: number }): Promise<Record<string, unknown>> {
    return this.request('/sell', { method: 'POST', body: JSON.stringify(params) });
  }

  async getPortfolio(userId: string): Promise<Portfolio | null> {
    const result = await this.request<Portfolio & { message?: string }>(`/portfolio?user_id=${userId}`);
    if ('message' in result && result.message === 'no portfolio yet') return null;
    return result;
  }

  async getFixedDeposits(userId: string): Promise<{ fixed_deposits: FixedDeposit[]; total: number }> {
    return this.request(`/fixed-deposits?user_id=${userId}`);
  }

  async breakFixedDeposit(fixedDepositId: string, userId: string): Promise<{ fixed_deposit: FixedDeposit; payout: number; penalty_applied: boolean }> {
    return this.request('/fixed-deposits/break', {
      method: 'POST',
      body: JSON.stringify({ fixed_deposit_id: fixedDepositId, user_id: userId }),
    });
  }

  async getRoboAdvisorRecommendation(params: {
    user_id: string;
    risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
    investment_goal: string;
    time_horizon_years: number;
    monthly_budget: number;
  }): Promise<RoboAdvisorProfile> {
    return this.request('/robo-advisor', { method: 'POST', body: JSON.stringify(params) });
  }

  async getDividends(userId: string): Promise<{ dividends: Array<Record<string, unknown>>; total_earned: number }> {
    return this.request(`/dividends?user_id=${userId}`);
  }

  async checkMaturity(): Promise<{ matured: number; details: FixedDeposit[] }> {
    return this.request('/maturity-check');
  }
}

export const investmentService = new InvestmentService();
