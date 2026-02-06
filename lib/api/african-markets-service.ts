const AFRICAN_MARKETS_URL = process.env.EXPO_PUBLIC_AFRICAN_MARKETS_URL || 'http://127.0.0.1:8118';

export interface MobileMoneyProvider {
  id: string;
  name: string;
  code: string;
  countries: string[];
  currencies: string[];
  features: string[];
  fee_percent: number;
  min_amount: number;
  max_amount: number;
  active: boolean;
}

export interface MobileMoneyWallet {
  id: string;
  user_id: string;
  provider_id: string;
  provider_name: string;
  phone_number: string;
  balance: number;
  currency: string;
  status: string;
  linked_at: string;
}

export interface MobileMoneyTxn {
  id: string;
  wallet_id: string;
  user_id: string;
  provider: string;
  type: string;
  amount: number;
  fee: number;
  currency: string;
  recipient_phone?: string;
  status: string;
  reference: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  code: string;
  location: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  services: string[];
  rating: number;
  status: string;
  operating_hours: string;
}

export interface CooperativeGroup {
  id: string;
  name: string;
  type: string;
  creator_id: string;
  members: string[];
  contribution_amount: number;
  frequency: string;
  currency: string;
  total_pool: number;
  current_round: number;
  next_payout_member: string;
  status: string;
  created_at: string;
}

export interface USSDSession {
  session_id: string;
  user_id: string;
  menu: string;
  text: string;
  options: Array<{ key: string; label: string }>;
}

export interface AirtimeProduct {
  id: string;
  provider: string;
  country: string;
  denominations: number[];
  data_bundles: Array<{ id: string; name: string; data: string; validity: string; price: number }>;
}

class AfricanMarketsService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${AFRICAN_MARKETS_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  async getProviders(): Promise<{ providers: MobileMoneyProvider[]; total: number }> {
    return this.request('/mobile-money/providers');
  }

  async linkWallet(params: {
    user_id: string;
    provider_id: string;
    phone_number: string;
  }): Promise<MobileMoneyWallet> {
    return this.request('/mobile-money/link', { method: 'POST', body: JSON.stringify(params) });
  }

  async mobileMoneyTransfer(params: {
    wallet_id: string;
    user_id: string;
    type: 'send' | 'withdraw' | 'deposit';
    amount: number;
    recipient_phone?: string;
  }): Promise<MobileMoneyTxn> {
    return this.request('/mobile-money/transfer', { method: 'POST', body: JSON.stringify(params) });
  }

  async getAgents(): Promise<{ agents: Agent[]; total: number }> {
    return this.request('/agents');
  }

  async getNearbyAgents(lat: number, lng: number, radiusKm?: number): Promise<{ agents: Agent[]; total: number }> {
    return this.request(`/agents/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm || 5}`);
  }

  async createCooperative(params: {
    name: string;
    type: string;
    creator_id: string;
    contribution_amount: number;
    frequency: string;
    currency?: string;
    initial_members?: string[];
  }): Promise<CooperativeGroup> {
    return this.request('/cooperative/create', { method: 'POST', body: JSON.stringify(params) });
  }

  async contributeToCooperative(params: {
    group_id: string;
    member_id: string;
    amount: number;
  }): Promise<Record<string, unknown>> {
    return this.request('/cooperative/contribute', { method: 'POST', body: JSON.stringify(params) });
  }

  async listCooperatives(userId: string): Promise<{ groups: CooperativeGroup[]; total: number }> {
    return this.request(`/cooperative/list?user_id=${userId}`);
  }

  async ussdMenu(params: {
    session_id?: string;
    user_id: string;
    input: string;
  }): Promise<USSDSession> {
    return this.request('/ussd', { method: 'POST', body: JSON.stringify(params) });
  }

  async buyAirtime(params: {
    user_id: string;
    provider: string;
    phone_number: string;
    amount: number;
    country?: string;
  }): Promise<Record<string, unknown>> {
    return this.request('/airtime/buy', { method: 'POST', body: JSON.stringify(params) });
  }

  async getAirtimeProducts(): Promise<{ products: AirtimeProduct[]; total: number }> {
    return this.request('/airtime/products');
  }
}

export const africanMarketsService = new AfricanMarketsService();
