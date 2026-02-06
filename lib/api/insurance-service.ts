const INSURANCE_URL = process.env.EXPO_PUBLIC_INSURANCE_URL || 'http://127.0.0.1:8115';

export interface InsuranceProduct {
  id: string;
  name: string;
  type: 'health' | 'life' | 'auto' | 'property' | 'travel' | 'crop' | 'micro' | 'business';
  description: string;
  base_premium: number;
  currency: string;
  coverage_amount: number;
  deductible: number;
  features: string[];
  exclusions: string[];
  min_age: number;
  max_age: number;
  waiting_period_days: number;
  active: boolean;
}

export interface Policy {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  type: InsuranceProduct['type'];
  status: 'active' | 'expired' | 'cancelled' | 'pending' | 'lapsed';
  premium: number;
  premium_frequency: 'monthly' | 'quarterly' | 'annually' | 'one_time';
  coverage_amount: number;
  deductible: number;
  currency: string;
  start_date: string;
  end_date: string;
  beneficiaries: Array<Record<string, unknown>>;
  auto_renew: boolean;
  created_at: string;
}

export interface Claim {
  id: string;
  policy_id: string;
  user_id: string;
  type: string;
  description: string;
  amount_claimed: number;
  amount_approved?: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  documents: string[];
  reviewer_notes?: string;
  submitted_at: string;
  reviewed_at?: string;
}

export interface PremiumQuote {
  annual_premium: number;
  premium_per_period: number;
  frequency: string;
  payments_per_year: number;
  coverage_amount: number;
  deductible: number;
  factors: Record<string, number>;
  product: { id: string; name: string; type: string };
  quote_id: string;
  valid_until: string;
}

class InsuranceService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${INSURANCE_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async getProducts(type?: string): Promise<{ products: InsuranceProduct[]; total: number }> {
    const url = type ? `/products?type=${type}` : '/products';
    return this.request(url);
  }

  async getProduct(productId: string): Promise<InsuranceProduct> {
    return this.request(`/products/${productId}`);
  }

  async getQuote(params: {
    product_id: string;
    age: number;
    gender: string;
    pre_existing_conditions?: string[];
    coverage_amount?: number;
    frequency?: 'monthly' | 'quarterly' | 'annually' | 'one_time';
    location?: string;
    occupation_risk?: string;
  }): Promise<PremiumQuote> {
    return this.request('/quotes', { method: 'POST', body: JSON.stringify(params) });
  }

  async createPolicy(params: {
    user_id: string;
    product_id: string;
    premium_frequency: 'monthly' | 'quarterly' | 'annually' | 'one_time';
    coverage_amount?: number;
    beneficiaries?: Array<Record<string, unknown>>;
    auto_renew?: boolean;
    age?: number;
    gender?: string;
    pre_existing_conditions?: string[];
  }): Promise<Policy> {
    return this.request('/policies', { method: 'POST', body: JSON.stringify(params) });
  }

  async getPolicies(userId: string): Promise<{ policies: Policy[]; total: number }> {
    return this.request(`/policies?user_id=${userId}`);
  }

  async getPolicy(policyId: string): Promise<Policy> {
    return this.request(`/policies/${policyId}`);
  }

  async cancelPolicy(policyId: string): Promise<{ policy_id: string; status: string }> {
    return this.request(`/policies/${policyId}/cancel`, { method: 'POST' });
  }

  async renewPolicy(policyId: string): Promise<Policy> {
    return this.request(`/policies/${policyId}/renew`, { method: 'POST' });
  }

  async submitClaim(params: {
    policy_id: string;
    user_id: string;
    type: string;
    description: string;
    amount_claimed: number;
    documents?: string[];
  }): Promise<Claim> {
    return this.request('/claims', { method: 'POST', body: JSON.stringify(params) });
  }

  async getClaims(params?: { user_id?: string; policy_id?: string; status?: string }): Promise<{ claims: Claim[]; total: number }> {
    const queryParts: string[] = [];
    if (params?.user_id) queryParts.push(`user_id=${params.user_id}`);
    if (params?.policy_id) queryParts.push(`policy_id=${params.policy_id}`);
    if (params?.status) queryParts.push(`status=${params.status}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    return this.request(`/claims${query}`);
  }

  async getClaim(claimId: string): Promise<Claim> {
    return this.request(`/claims/${claimId}`);
  }

  async reviewClaim(params: {
    claim_id: string;
    reviewer_id: string;
    status: 'approved' | 'rejected';
    amount_approved?: number;
    notes?: string;
  }): Promise<Claim> {
    return this.request('/claims/review', { method: 'POST', body: JSON.stringify(params) });
  }

  async payPremium(userId: string, policyId: string, amount: number, method?: string): Promise<Record<string, unknown>> {
    return this.request(`/premium/pay?user_id=${userId}&policy_id=${policyId}&amount=${amount}&method=${method || 'wallet'}`, { method: 'POST' });
  }

  async getPremiumHistory(userId: string): Promise<{ payments: Array<Record<string, unknown>>; total: number }> {
    return this.request(`/premium/history?user_id=${userId}`);
  }

  async getAnalytics(): Promise<Record<string, unknown>> {
    return this.request('/analytics/summary');
  }
}

export const insuranceService = new InsuranceService();
