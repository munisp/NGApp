/**
 * Insurance Platform Mobile — API Service Layer
 * Full integration with all platform backend services
 * Handles: auth token refresh, offline queuing, retry logic
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import * as Keychain from 'react-native-keychain';
import NetInfo from '@react-native-community/netinfo';
import Config from 'react-native-config';

// ============================================================
// Types
// ============================================================
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface Policy {
  id: string;
  policyNumber: string;
  type: 'health' | 'life' | 'motor' | 'property' | 'microinsurance';
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  premium: number;
  currency: string;
  startDate: string;
  endDate: string;
  insuredName: string;
  coverageAmount: number;
  beneficiaries: Beneficiary[];
}

export interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
  percentage: number;
}

export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
  type: string;
  amount: number;
  currency: string;
  submittedAt: string;
  description: string;
  documents: ClaimDocument[];
  timeline: ClaimEvent[];
}

export interface ClaimDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface ClaimEvent {
  timestamp: string;
  status: string;
  description: string;
  actor: string;
}

export interface Payment {
  id: string;
  policyId: string;
  amount: number;
  currency: string;
  method: 'card' | 'bank_transfer' | 'mobile_money' | 'crypto';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  reference: string;
}

export interface DashboardSummary {
  activePolicies: number;
  pendingClaims: number;
  totalPremiumPaid: number;
  currency: string;
  nextPaymentDue: string | null;
  nextPaymentAmount: number | null;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'claim' | 'payment' | 'policy' | 'document';
  title: string;
  description: string;
  timestamp: string;
  status: string;
}

export interface NotificationPreferences {
  claimUpdates: boolean;
  paymentReminders: boolean;
  policyRenewals: boolean;
  promotions: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

// ============================================================
// API Client
// ============================================================
class InsuranceApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private offlineQueue: Array<() => Promise<unknown>> = [];

  constructor() {
    this.client = axios.create({
      baseURL: Config.API_BASE_URL || 'https://api.insurance-platform.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'mobile',
        'X-Client-Version': '1.0.0',
      },
    });

    this.setupInterceptors();
    this.setupNetworkListener();
  }

  private setupInterceptors(): void {
    // Request interceptor: attach auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const tokens = await this.getStoredTokens();
        if (tokens) {
          if (Date.now() > tokens.expiresAt - 60000) {
            // Refresh if expiring within 60 seconds
            const refreshed = await this.refreshTokens(tokens.refreshToken);
            config.headers.Authorization = `Bearer ${refreshed.accessToken}`;
          } else {
            config.headers.Authorization = `Bearer ${tokens.accessToken}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor: handle 401 with token refresh
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config as AxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const tokens = await this.getStoredTokens();
            if (tokens) {
              const refreshed = await this.refreshTokens(tokens.refreshToken);
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
              }
              return this.client(originalRequest);
            }
          } catch {
            await this.clearTokens();
            throw new Error('SESSION_EXPIRED');
          }
        }

        return Promise.reject(error);
      },
    );
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      if (state.isConnected && this.offlineQueue.length > 0) {
        this.flushOfflineQueue();
      }
    });
  }

  private async flushOfflineQueue(): Promise<void> {
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    for (const request of queue) {
      try {
        await request();
      } catch (error) {
        console.warn('Offline queue request failed:', error);
      }
    }
  }

  private async getStoredTokens(): Promise<AuthTokens | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'insurance-platform-tokens',
      });
      if (credentials) {
        return JSON.parse(credentials.password) as AuthTokens;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {
      service: 'insurance-platform-tokens',
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  private async clearTokens(): Promise<void> {
    await Keychain.resetGenericPassword({
      service: 'insurance-platform-tokens',
    });
  }

  private async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = axios
      .post<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>(
        `${Config.KEYCLOAK_URL}/realms/insurance/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'insurance-mobile',
          refresh_token: refreshToken,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      .then(async (response) => {
        const tokens: AuthTokens = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresAt: Date.now() + response.data.expires_in * 1000,
        };
        await this.storeTokens(tokens);
        return tokens;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  // ============================================================
  // Authentication
  // ============================================================
  async login(username: string, password: string): Promise<AuthTokens> {
    const response = await axios.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>(
      `${Config.KEYCLOAK_URL}/realms/insurance/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        client_id: 'insurance-mobile',
        username,
        password,
        scope: 'openid profile email roles offline_access',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const tokens: AuthTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };
    await this.storeTokens(tokens);
    return tokens;
  }

  async logout(): Promise<void> {
    const tokens = await this.getStoredTokens();
    if (tokens) {
      await axios
        .post(
          `${Config.KEYCLOAK_URL}/realms/insurance/protocol/openid-connect/logout`,
          new URLSearchParams({
            client_id: 'insurance-mobile',
            refresh_token: tokens.refreshToken,
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        )
        .catch(() => {}); // Best-effort logout
    }
    await this.clearTokens();
  }

  async getUserProfile(): Promise<{
    id: string;
    name: string;
    email: string;
    roles: string[];
    policyHolderId: string;
  }> {
    const response = await this.client.get('/api/v1/users/me');
    return response.data;
  }

  // ============================================================
  // Dashboard
  // ============================================================
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await this.client.get<DashboardSummary>(
      '/api/v1/dashboard/summary',
    );
    return response.data;
  }

  // ============================================================
  // Policies
  // ============================================================
  async getPolicies(params?: {
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ policies: Policy[]; total: number; page: number }> {
    const response = await this.client.get('/api/v1/policies', { params });
    return response.data;
  }

  async getPolicy(policyId: string): Promise<Policy> {
    const response = await this.client.get<Policy>(
      `/api/v1/policies/${policyId}`,
    );
    return response.data;
  }

  async downloadPolicyCertificate(policyId: string): Promise<string> {
    const response = await this.client.get(
      `/api/v1/policies/${policyId}/certificate`,
      { responseType: 'blob' },
    );
    return response.data;
  }

  async renewPolicy(
    policyId: string,
    renewalData: { paymentMethod: string },
  ): Promise<Policy> {
    const response = await this.client.post<Policy>(
      `/api/v1/policies/${policyId}/renew`,
      renewalData,
    );
    return response.data;
  }

  // ============================================================
  // Claims
  // ============================================================
  async getClaims(params?: {
    status?: string;
    policyId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ claims: Claim[]; total: number }> {
    const response = await this.client.get('/api/v1/claims', { params });
    return response.data;
  }

  async getClaim(claimId: string): Promise<Claim> {
    const response = await this.client.get<Claim>(`/api/v1/claims/${claimId}`);
    return response.data;
  }

  async submitClaim(claimData: {
    policyId: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    incidentDate: string;
    documents: Array<{ name: string; type: string; base64: string }>;
  }): Promise<Claim> {
    const formData = new FormData();
    formData.append('policyId', claimData.policyId);
    formData.append('type', claimData.type);
    formData.append('amount', claimData.amount.toString());
    formData.append('currency', claimData.currency);
    formData.append('description', claimData.description);
    formData.append('incidentDate', claimData.incidentDate);

    claimData.documents.forEach((doc, index) => {
      formData.append(`documents[${index}][name]`, doc.name);
      formData.append(`documents[${index}][type]`, doc.type);
      formData.append(`documents[${index}][data]`, doc.base64);
    });

    const response = await this.client.post<Claim>('/api/v1/claims', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minutes for file upload
    });
    return response.data;
  }

  async uploadClaimDocument(
    claimId: string,
    document: { name: string; type: string; uri: string },
  ): Promise<ClaimDocument> {
    const formData = new FormData();
    formData.append('file', {
      uri: document.uri,
      type: document.type,
      name: document.name,
    } as unknown as Blob);

    const response = await this.client.post<ClaimDocument>(
      `/api/v1/claims/${claimId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  // ============================================================
  // Payments
  // ============================================================
  async getPaymentHistory(params?: {
    policyId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ payments: Payment[]; total: number }> {
    const response = await this.client.get('/api/v1/payments', { params });
    return response.data;
  }

  async initiatePayment(paymentData: {
    policyId: string;
    amount: number;
    currency: string;
    method: string;
    returnUrl?: string;
  }): Promise<{
    paymentId: string;
    redirectUrl?: string;
    mobileMoneyPrompt?: string;
    status: string;
  }> {
    const response = await this.client.post('/api/v1/payments/initiate', paymentData);
    return response.data;
  }

  async getPaymentStatus(paymentId: string): Promise<Payment> {
    const response = await this.client.get<Payment>(
      `/api/v1/payments/${paymentId}`,
    );
    return response.data;
  }

  // ============================================================
  // Notifications
  // ============================================================
  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.client.post('/api/v1/notifications/register', {
      token,
      platform,
    });
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const response = await this.client.get<NotificationPreferences>(
      '/api/v1/notifications/preferences',
    );
    return response.data;
  }

  async updateNotificationPreferences(
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const response = await this.client.put<NotificationPreferences>(
      '/api/v1/notifications/preferences',
      preferences,
    );
    return response.data;
  }

  // ============================================================
  // Analytics
  // ============================================================
  async getInsuranceAnalytics(params: {
    period: '1m' | '3m' | '6m' | '1y';
    type?: string;
  }): Promise<{
    premiumTrend: Array<{ date: string; amount: number }>;
    claimFrequency: Array<{ month: string; count: number }>;
    coverageUtilization: number;
    savingsVsMarket: number;
  }> {
    const response = await this.client.get('/api/v1/analytics/personal', {
      params,
    });
    return response.data;
  }
}

// Singleton instance
export const apiClient = new InsuranceApiClient();
