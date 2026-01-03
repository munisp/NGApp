// API client for SocialEscrow platform
import type { 
  Escrow, Dispute, Refund, Agent, AgentTransaction, 
  MarketplaceListing, Storefront, KYCSubmission, BankDetails,
  Notification, LoyaltyInfo
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://app-eeeyetyo.fly.dev';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Escrow endpoints
  async createEscrow(data: {
    listing: { id: string; title: string; price: number; currency: string; seller: any; source: string };
    buyer: { name: string; phone: string; address: string };
    paymentMethod: string;
  }): Promise<{ success: boolean; escrow_id: string; amount: number; fee: number; total: number }> {
    return this.request('/api/v1/escrow/create', {
      method: 'POST',
      body: JSON.stringify({ listing: data.listing, buyer: data.buyer, payment_method: data.paymentMethod }),
    });
  }

  async getEscrow(escrowId: string, token?: string): Promise<Escrow> {
    const url = token ? `/api/v1/escrow/${escrowId}?token=${token}` : `/api/v1/escrow/${escrowId}`;
    return this.request(url);
  }

  async acceptEscrow(escrowId: string, bankDetails: BankDetails): Promise<{ success: boolean }> {
    return this.request('/api/v1/escrow/accept', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, bank_details: bankDetails }),
    });
  }

  async shipEscrow(escrowId: string, shipping: { carrier: string; tracking_number: string; estimated_delivery: string }): Promise<{ success: boolean }> {
    return this.request('/api/v1/escrow/ship', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, shipping }),
    });
  }

  async confirmDelivery(escrowId: string, confirmation: { items_received: boolean; items_as_described: boolean; condition: string; rating: number }): Promise<{ success: boolean }> {
    return this.request('/api/v1/escrow/confirm-delivery', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, ...confirmation }),
    });
  }

  async cancelEscrow(escrowId: string, reason: string): Promise<{ success: boolean }> {
    return this.request('/api/v1/escrow/cancel', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, reason }),
    });
  }

  // Bank verification
  async verifyBank(bankCode: string, accountNumber: string): Promise<{ success: boolean; account_name: string }> {
    return this.request('/api/v1/bank/verify', {
      method: 'POST',
      body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber }),
    });
  }

  // Dispute endpoints
  async openDispute(escrowId: string, reason: string, description: string): Promise<{ success: boolean; dispute_id: string }> {
    return this.request('/api/v1/disputes/open', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, reason, description }),
    });
  }

  async getDispute(disputeId: string): Promise<Dispute> {
    return this.request(`/api/v1/disputes/${disputeId}`);
  }

  async submitEvidence(disputeId: string, evidence: { type: string; content: string }): Promise<{ success: boolean }> {
    return this.request(`/api/v1/disputes/${disputeId}/evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
  }

  async getDisputesByUser(userId: string): Promise<Dispute[]> {
    return this.request(`/api/v1/disputes/user/${userId}`);
  }

  // Refund endpoints
  async requestRefund(escrowId: string, reason: string, amount?: number): Promise<{ success: boolean; refund_id: string }> {
    return this.request('/api/v1/escrow/refund', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, reason, amount }),
    });
  }

  async getRefund(refundId: string): Promise<Refund> {
    return this.request(`/api/v1/refunds/${refundId}`);
  }

  // KYC endpoints
  async getKYCLevel(userId: string): Promise<{ level: number; limits: any }> {
    return this.request(`/api/v1/kyc/${userId}/level`);
  }

  async checkKYCLimit(userId: string, amount: number): Promise<{ allowed: boolean; upgrade_required: boolean; required_level: number }> {
    return this.request('/api/v1/kyc/check-limit', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, amount }),
    });
  }

  async submitKYC(userId: string, level: number, documents: { type: string; data: string }[]): Promise<{ success: boolean; submission_id: string }> {
    return this.request('/api/v1/kyc/submit', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, target_level: level, documents }),
    });
  }

  async getKYCStatus(submissionId: string): Promise<KYCSubmission> {
    return this.request(`/api/v1/kyc/status/${submissionId}`);
  }

  // Agent endpoints
  async findNearbyAgents(latitude: number, longitude: number, radius?: number): Promise<Agent[]> {
    return this.request(`/api/v1/agents/nearby?lat=${latitude}&lng=${longitude}&radius=${radius || 5}`);
  }

  async requestAgentTransaction(escrowId: string, type: 'cash_in' | 'cash_out', amount: number, location: { latitude: number; longitude: number }): Promise<{ success: boolean; transaction_id: string; agent_id: string }> {
    return this.request('/api/v1/agents/cash-transaction', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, type, amount, location }),
    });
  }

  async getAgentTransaction(transactionId: string): Promise<AgentTransaction> {
    return this.request(`/api/v1/agents/transaction/${transactionId}`);
  }

  async confirmAgentTransaction(transactionId: string, receipt: string): Promise<{ success: boolean }> {
    return this.request('/api/v1/agents/complete', {
      method: 'POST',
      body: JSON.stringify({ transaction_id: transactionId, receipt }),
    });
  }

  // Marketplace endpoints
  async searchListings(query: string, filters?: { category?: string; minPrice?: number; maxPrice?: number }): Promise<MarketplaceListing[]> {
    const params = new URLSearchParams({ q: query });
    if (filters?.category) params.set('category', filters.category);
    if (filters?.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters?.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    return this.request(`/api/v1/marketplace/search?${params}`);
  }

  async getStorefront(sellerId: string): Promise<Storefront> {
    return this.request(`/api/v1/storefront/${sellerId}`);
  }

  async getSellerListings(sellerId: string): Promise<MarketplaceListing[]> {
    return this.request(`/api/v1/storefront/${sellerId}/listings`);
  }

  // Loyalty endpoints
  async getLoyaltyInfo(userId: string): Promise<LoyaltyInfo> {
    return this.request(`/api/v1/loyalty/${userId}`);
  }

  async getRewards(userId: string): Promise<{ available: any[]; claimed: any[] }> {
    return this.request(`/api/v1/rewards/${userId}`);
  }

  // Notification endpoints
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.request(`/api/v1/notifications/${userId}`);
  }

  async markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/v1/notifications/${notificationId}/read`, { method: 'POST' });
  }

  // Payout endpoints
  async initiatePayout(escrowId: string, sellerId: string): Promise<{ success: boolean; payout_id: string }> {
    return this.request('/api/v1/payout/initiate', {
      method: 'POST',
      body: JSON.stringify({ escrow_id: escrowId, seller_id: sellerId }),
    });
  }

  async getPayoutStatus(payoutId: string): Promise<{ status: string; amount: number; estimated_arrival: string }> {
    return this.request(`/api/v1/payout/${payoutId}/status`);
  }

  // Admin endpoints
  async getAuditTrail(resourceType: string, resourceId: string): Promise<any[]> {
    return this.request(`/api/v1/audit/${resourceType}/${resourceId}`);
  }

  async getPlatformMetrics(): Promise<any> {
    return this.request('/api/v1/metrics');
  }

  async getPlatformSummary(): Promise<any> {
    return this.request('/api/v1/platform/summary');
  }
}

export const api = new ApiClient();
export default api;
