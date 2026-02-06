const TAX_PLANNING_URL = process.env.EXPO_PUBLIC_TAX_PLANNING_URL || 'http://127.0.0.1:8120';

export interface TaxCalculation {
  calculation_id: string;
  user_id: string;
  jurisdiction: string;
  tax_year: number;
  gross_income: number;
  taxable_income: number;
  total_tax: number;
  effective_rate: number;
  brackets: Array<{ bracket: string; rate: number; taxable: number; tax: number }>;
  deductions_applied: Array<{ name: string; amount: number }>;
  net_income: number;
  currency: string;
  calculated_at: string;
}

export interface TaxDeduction {
  id: string;
  name: string;
  category: string;
  description: string;
  max_amount: number;
  jurisdiction: string;
  eligibility: string;
}

export interface TaxBracket {
  jurisdiction: string;
  currency: string;
  brackets: Array<{ min: number; max: number; rate: number }>;
  personal_allowance: number;
}

export interface RetirementPlan {
  plan_id: string;
  user_id: string;
  current_age: number;
  retirement_age: number;
  current_savings: number;
  monthly_contribution: number;
  expected_return: number;
  inflation_rate: number;
  target_monthly_income: number;
  projected_savings_at_retirement: number;
  monthly_income_at_retirement: number;
  savings_gap: number;
  recommended_monthly_contribution: number;
  year_by_year: Array<{
    age: number;
    year: number;
    contributions: number;
    returns: number;
    balance: number;
    inflation_adjusted: number;
  }>;
  currency: string;
  created_at: string;
}

export interface EstatePlan {
  plan_id: string;
  user_id: string;
  total_estate_value: number;
  assets: Array<{ name: string; type: string; value: number; beneficiary: string }>;
  beneficiaries: Array<{
    name: string;
    relationship: string;
    share_percent: number;
    estimated_value: number;
  }>;
  estate_tax: number;
  tax_rate: number;
  net_distributable: number;
  recommendations: string[];
  jurisdiction: string;
  currency: string;
  created_at: string;
}

export interface CapitalGainsResult {
  calculation_id: string;
  user_id: string;
  transactions: Array<{
    asset: string;
    purchase_price: number;
    sale_price: number;
    gain: number;
    holding_period_days: number;
    is_long_term: boolean;
    tax_rate: number;
    tax_amount: number;
  }>;
  total_gains: number;
  total_losses: number;
  net_gain: number;
  total_tax: number;
  jurisdiction: string;
  currency: string;
  calculated_at: string;
}

export interface FinancialHealthScore {
  user_id: string;
  overall_score: number;
  grade: string;
  factors: Array<{ name: string; score: number; weight: number; status: string; recommendation: string }>;
  recommendations: string[];
  calculated_at: string;
}

class TaxPlanningService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${TAX_PLANNING_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async calculateTax(params: {
    user_id: string;
    jurisdiction: string;
    tax_year?: number;
    gross_income: number;
    deductions?: Array<{ name: string; amount: number }>;
    filing_status?: string;
  }): Promise<TaxCalculation> {
    return this.request('/tax/calculate', { method: 'POST', body: JSON.stringify(params) });
  }

  async getDeductions(jurisdiction: string): Promise<{ deductions: TaxDeduction[]; total: number }> {
    return this.request(`/tax/deductions?jurisdiction=${jurisdiction}`);
  }

  async getBrackets(jurisdiction: string): Promise<TaxBracket> {
    return this.request(`/tax/brackets?jurisdiction=${jurisdiction}`);
  }

  async getTaxHistory(userId: string): Promise<{ calculations: TaxCalculation[]; total: number }> {
    return this.request(`/tax/history?user_id=${userId}`);
  }

  async createRetirementPlan(params: {
    user_id: string;
    current_age: number;
    retirement_age: number;
    current_savings: number;
    monthly_contribution: number;
    expected_return?: number;
    inflation_rate?: number;
    target_monthly_income: number;
    currency?: string;
  }): Promise<RetirementPlan> {
    return this.request('/retirement/plan', { method: 'POST', body: JSON.stringify(params) });
  }

  async getRetirementPlan(userId: string): Promise<RetirementPlan | null> {
    try {
      return await this.request(`/retirement/plan?user_id=${userId}`);
    } catch {
      return null;
    }
  }

  async createEstatePlan(params: {
    user_id: string;
    assets: Array<{ name: string; type: string; value: number; beneficiary: string }>;
    jurisdiction?: string;
    currency?: string;
  }): Promise<EstatePlan> {
    return this.request('/estate/plan', { method: 'POST', body: JSON.stringify(params) });
  }

  async getEstatePlan(userId: string): Promise<EstatePlan | null> {
    try {
      return await this.request(`/estate/plan?user_id=${userId}`);
    } catch {
      return null;
    }
  }

  async calculateCapitalGains(params: {
    user_id: string;
    transactions: Array<{
      asset: string;
      purchase_price: number;
      sale_price: number;
      purchase_date: string;
      sale_date: string;
    }>;
    jurisdiction?: string;
    currency?: string;
  }): Promise<CapitalGainsResult> {
    return this.request('/capital-gains/calculate', { method: 'POST', body: JSON.stringify(params) });
  }

  async getFinancialHealthScore(params: {
    user_id: string;
    income: number;
    expenses: number;
    savings: number;
    debt: number;
    investments: number;
    emergency_fund: number;
    insurance_coverage: number;
    retirement_savings: number;
  }): Promise<FinancialHealthScore> {
    return this.request('/financial-health/score', { method: 'POST', body: JSON.stringify(params) });
  }
}

export const taxPlanningService = new TaxPlanningService();
